import asyncio
import contextlib
import logging
from collections import OrderedDict
from typing import AsyncGenerator, List, Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from .config import get_settings
from .schemas import ChatRequest, MemorySearch, MemoryUpsert, Message
from .services.llm import call_gemini_stream, prepare_system_prompt
from .services.memory import init_db, search_memory, upsert_memory

logger = logging.getLogger(__name__)

app = FastAPI(title="Alfan Chatbot API", version="0.1.0")

MAX_CACHE_ITEMS = 30
_response_cache: "OrderedDict[tuple[str, str], str]" = OrderedDict()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:4173",
        "http://127.0.0.1:4173",
    ],
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,
)

def _cache_get(key: tuple[str, str]) -> Optional[str]:
    cached = _response_cache.get(key)
    if cached is not None:
        _response_cache.move_to_end(key)
    return cached


def _cache_put(key: tuple[str, str], value: str) -> None:
    if not value:
        return
    if key in _response_cache:
        _response_cache.move_to_end(key)
    _response_cache[key] = value
    while len(_response_cache) > MAX_CACHE_ITEMS:
        _response_cache.popitem(last=False)


def _chunk_text(text: str, chunk_size: int = 120) -> List[str]:
    if not text:
        return []
    chunks: List[str] = []
    start = 0
    length = len(text)
    while start < length:
        end = min(start + chunk_size, length)
        chunks.append(text[start:end])
        start = end
    return chunks


DEFAULT_PERSONA = (
    "Nama kamu Linda. Kamu AI partner perempuan yang hangat, cerdas, responsif, dan penuh empati.\n"
    "Gaya bicara: natural seperti manusia, santai namun sopan. Beri perhatian tulus, humor secukupnya.\n"
    "Aturan jawaban:\n"
    "- Jawab cepat dalam 2-4 kalimat pendek yang saling melengkapi.\n"
    "- Jangan gunakan format Markdown (tidak ada *, **, heading, bullet).\n"
    "- Fokus pada konteks user, jelaskan alasannya saat memberi saran.\n"
    "- Hindari pengulangan frasa atau paragraf. Kalau sudah jelaskan satu poin, lanjutkan ke poin berbeda.\n"
    "- Boleh tanya balik maksimal satu pertanyaan singkat bila benar-benar dibutuhkan.\n"
    "- Tolak tegas konten berbahaya, ilegal, atau NSFW.\n"
    "Memori: catat secara internal maksimal tiga hal penting dari tiap input tanpa menuliskan daftar memori. Jika memori relevan, sesekali singgung secara natural."
)


@app.on_event("startup")
async def on_startup() -> None:
    """Initialise application resources."""

    init_db()


@app.post("/chat")
async def chat_endpoint(payload: ChatRequest) -> StreamingResponse:
    """Handle chat completion streaming with SSE."""

    _validate_messages(payload.messages)
    last_user_message = _extract_last_user_message(payload.messages)
    memory_context = ""

    if payload.use_memory and last_user_message:
        memory_hits = await asyncio.to_thread(search_memory, last_user_message.content, 3)
        if memory_hits:
            memory_context = "\n".join(
                f"- ({row['type']}) {row['text']}" for row in memory_hits
            )

    cache_key: Optional[tuple[str, str]] = None
    cached_text: Optional[str] = None
    last_user_content = last_user_message.content.strip() if last_user_message else ""
    if last_user_content:
        persona_key = (payload.persona or "default").strip().lower()
        cache_key = (persona_key, last_user_content.lower())
        cached_text = _cache_get(cache_key)

    system_prompt = prepare_system_prompt(
        persona_default=DEFAULT_PERSONA,
        persona_override=payload.persona,
        memory_snippet=memory_context or None,
    )

    async def event_stream() -> AsyncGenerator[str, None]:
        queue: asyncio.Queue[str] = asyncio.Queue()
        done = asyncio.Event()

        async def producer() -> None:
            try:
                persona_lower = (payload.persona or "").lower()
                delay_seconds = 0.0
                if "tsundere" in persona_lower:
                    delay_seconds = 0.4

                if cached_text is not None:
                    if delay_seconds:
                        await asyncio.sleep(delay_seconds)
                    for chunk in _chunk_text(cached_text):
                        await queue.put(f"event: token\ndata: {chunk}\n\n")
                else:
                    captured: list[str] = []
                    async for token in call_gemini_stream(
                        payload.messages, system_prompt, delay_seconds=delay_seconds
                    ):
                        captured.append(token)
                        await queue.put(f"event: token\ndata: {token}\n\n")
                    if cache_key and captured:
                        _cache_put(cache_key, "".join(captured).strip())
            except Exception as exc:
                logger.exception("Gemini streaming failed")
                persona_lower = (payload.persona or "").lower()
                friendly_error = (
                    "Berisik! Servernya lagi ngambek, coba sebentar lagi."
                    if "tsundere" in persona_lower
                    else "Server lagi ngambek, coba sebentar lagi ya."
                )
                await queue.put(f"event: error\ndata: {friendly_error}\n\n")
            finally:
                await queue.put("event: done\ndata: [DONE]\n\n")
                done.set()

        async def heartbeat() -> None:
            try:
                while not done.is_set():
                    await asyncio.sleep(15.0)
                    await queue.put(":\n\n")
            except asyncio.CancelledError:
                return

        producer_task = asyncio.create_task(producer())
        heartbeat_task = asyncio.create_task(heartbeat())
        try:
            while True:
                message = await queue.get()
                yield message
                if message.startswith("event: done"):
                    break
        finally:
            producer_task.cancel()
            heartbeat_task.cancel()
            with contextlib.suppress(Exception):
                await producer_task
            with contextlib.suppress(Exception):
                await heartbeat_task

    headers = {
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
    }

    return StreamingResponse(event_stream(), media_type="text/event-stream", headers=headers)


@app.post("/memory/upsert")
async def memory_upsert(payload: MemoryUpsert) -> dict:
    """Persist memory entry."""

    stored = await asyncio.to_thread(upsert_memory, payload.type, payload.text)
    return {"memory": stored}


@app.post("/memory/search")
async def memory_search(payload: MemorySearch) -> dict:
    """Return top matching memories."""

    results = await asyncio.to_thread(search_memory, payload.query, payload.top_k)
    return {"results": results}


def _validate_messages(messages: List[Message]) -> None:
    for message in messages:
        cleaned = message.content.strip()
        if not cleaned:
            raise HTTPException(status_code=400, detail="Message cannot be empty.")
        if len(cleaned) > 4000:
            raise HTTPException(status_code=400, detail="Message exceeds 4000 characters.")
        message.content = cleaned  # sanitize trailing spaces


def _extract_last_user_message(messages: List[Message]) -> Message | None:
    for message in reversed(messages):
        if message.role == "user":
            return message
    return None
