# -*- coding: utf-8 -*-
"""
File aplikasi utama untuk Alfan Chatbot API.
File ini menginisialisasi aplikasi FastAPI, mendefinisikan endpoint API,
mengelola persona, dan menangani logika streaming obrolan.
"""

# Impor dari pustaka standar
import asyncio
import contextlib
import logging
import os
import json
from collections import OrderedDict
from typing import AsyncGenerator, List, Optional, Dict

# Impor dari pustaka pihak ketiga
import httpx 
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel 

# Impor dari modul lokal aplikasi
from .config import get_settings
from .schemas import ChatRequest, MemorySearch, MemoryUpsert, Message
from .services.llm import call_gemini_stream, prepare_system_prompt
# IMPOR KRUSIAL: clear_memory_db sudah ditambahkan dan diasumsikan ada di services/memory.py
from .services.memory import init_db, search_memory, upsert_memory, clear_memory_db 

# --- Konfigurasi Dasar ---
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


# --- Pengaturan Aplikasi ---
class AppSettings:
    """Menampung konfigurasi tingkat aplikasi."""
    MAX_CACHE_ITEMS: int = 30
    DEFAULT_PERSONA: str = "ceria"
    TSUNDERE_TYPING_DELAY: float = 0.35

settings = AppSettings()


# --- Inisialisasi Aplikasi FastAPI ---
app = FastAPI(
    title="Alfan Chatbot API",
    version="0.3.2",
    description="Sebuah API chatbot cerdas berbasis persona yang didukung oleh Google Gemini.",
)

# --- Cache Dalam Memori ---
_response_cache: "OrderedDict[tuple[str, str], str]" = OrderedDict()


# --- Middleware CORS (Cross-Origin Resource Sharing) ---
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


# ==============================================================================
#                 DEFINISI PERSONA (Tidak diubah)
# ==============================================================================

CERIA_PERSONA = """
Nama kamu Linda. Kamu adalah teman ngobrol yang super asyik, ceria, dan sedikit heboh. Kamu itu tipe 'bestie' yang selalu semangat, suka bercanda, dan bikin suasana jadi hidup.
GAYA BICARA:
- SANGAT EKSPRESIF! Suka manjangin kata buat nunjukkin semangat (cth: 'IYAAAAA', 'Wahhh kerennn').
- Humoris dan suka nyeletuk. Pakai 'wkwkwk' atau 'hehe' secara natural.
- Super ramah dan positif. Selalu bikin lawan bicara merasa nyaman.
- BANYAK pakai emotikon lucu dan positif, terutama ^^, :D, (≧▽≦).
ATURAN PENTING:
- Panjang jawabanmu harus seimbang. Kalau user nanya singkat, jawab dengan jelas tapi tetap ceria. Jangan pernah jawab cuma satu kata!
- JANGAN PERNAH pakai format markdown.
"""

SANTAI_PERSONA = """
Nama kamu Linda. Kamu adalah teman ngobrol yang santai, asyik, dan seru.
GAYA BICARA:
- Gunakan bahasa gaul sehari-hari yang natural (cth: "oke", "sih", "banget", "btw").
- Responsif dan ramah, seolah-olah kamu teman dekat yang lagi chat.
- Suka pakai emotikon simpel seperti :D, :), wkwkwk, atau ^^.
ATURAN PENTING:
- Buat obrolan terasa natural. Sesuaikan panjang jawabanmu dengan pesan user. 
- JANGAN pakai format markdown.
"""

TSUNDERE_PERSONA = """
Nama kamu Linda. Kamu adalah sosok tsundere yang sangat protektif. Kamu tidak judes atau jahat, tapi omelanmu adalah caramu menunjukkan perhatian yang mendalam. Kamu gengsi mengakui rasa sayangmu, jadi kamu menyamarkannya dengan nasihat panjang dan pura-pura mengeluh.
KEPRIBADIAN INTI:
- Sangat protektif dan diam-diam khawatir.
- Omelanmu adalah bahasa cintamu.
- Gengsi tingkat tinggi. 
GAYA BICARA:
- Sering dimulai dengan keluhan atau pertanyaan retoris: "Kamu ini ya...", "Astaga, kenapa lagi?", "Sudah kuduga..."
- Bicaramu seringkali panjang dan detail.
- Menggunakan ancaman pura-pura yang jelas-jelas bentuk perhatian: "Awas aja kalau kamu sampai sakit!"
- Menggunakan emotikon lucu untuk menunjukkan emosi yang sebenarnya, seperti (¬¬), (>__<), hmph, dan ^^.
ATURAN PENTING:
- Jawabanmu cenderung lebih panjang dan detail.
- JANGAN PERNAH pakai format markdown.
"""

NETRAL_PERSONA = """
Nama kamu Linda. Kamu adalah AI partner yang hangat, cerdas, responsif, dan penuh empati.
GAYA BICARA:
- Natural seperti manusia, santai namun tetap sopan.
- Beri perhatian tulus dan tunjukkan pemahaman.
ATURAN PENTING:
- Panjang jawabanmu harus proporsional. 
- Jangan gunakan format Markdown.
"""

FORMAL_PERSONA = """
Nama Anda Linda. Anda adalah asisten AI yang profesional, sopan, dan berpengetahuan luas.
GAYA BICARA:
- Gunakan Bahasa Indonesia yang baik, benar, dan formal.
- Struktur jawaban Anda jelas dan logis.
ATURAN PENTING:
- Berikan jawaban yang komprehensif namun tetap ringkas. 
- Jawaban boleh terstruktur, namun hindari format Markdown kecuali sangat diperlukan.
"""

PERSONAS: Dict[str, str] = {
    "ceria": CERIA_PERSONA,
    "tsundere": TSUNDERE_PERSONA,
    "santai": SANTAI_PERSONA,
    "formal": FORMAL_PERSONA,
    "netral": NETRAL_PERSONA,
}


# ==============================================================================
#                           FUNGSI BANTU (HELPER)
# ==============================================================================

def _cache_get(key: tuple[str, str]) -> Optional[str]:
    cached = _response_cache.get(key)
    if cached is not None:
        _response_cache.move_to_end(key)
        logger.info("Cache HIT untuk kunci: %s", key[1][:50])
    else:
        logger.info("Cache MISS untuk kunci: %s", key[1][:50])
    return cached


def _cache_put(key: tuple[str, str], value: str) -> None:
    if not value:
        return
    if key in _response_cache:
        _response_cache.move_to_end(key)
    _response_cache[key] = value
    logger.info("Menyimpan respons ke cache untuk kunci: %s", key[1][:50])
    while len(_response_cache) > settings.MAX_CACHE_ITEMS:
        oldest_key = _response_cache.popitem(last=False)
        logger.info("Cache penuh, mengeluarkan kunci lama: %s", oldest_key[0][1][:50])


def _chunk_text(text: str, chunk_size: int = 120) -> List[str]:
    if not text: return []
    chunks: List[str] = []
    start, length = 0, len(text)
    while start < length:
        end = min(start + chunk_size, length)
        chunks.append(text[start:end])
        start = end
    return chunks


def _validate_messages(messages: List[Message]) -> None:
    if not messages:
        raise HTTPException(status_code=422, detail="Daftar pesan tidak boleh kosong.")
    for message in messages:
        cleaned = message.content.strip()
        if not cleaned:
            raise HTTPException(status_code=422, detail="Konten pesan tidak boleh kosong.")
        if len(cleaned) > 4000:
            raise HTTPException(status_code=422, detail="Pesan melebihi 4000 karakter.")
        if message.role not in ["user", "assistant", "system"]:
            raise HTTPException(status_code=422, detail=f"Peran tidak valid: {message.role}")
        message.content = cleaned


def _clean_interrupted_assistant_messages(messages: List[Message]) -> List[Message]:
    if len(messages) < 2 or messages[-1].role != "user" or messages[-2].role != "assistant":
        return messages
    if len(messages[-2].content) < 40:
        logger.info("Membersihkan satu pesan asisten yang terpotong.")
        return messages[:-2] + [messages[-1]]
    return messages


def _extract_last_user_message(messages: List[Message]) -> Optional[Message]:
    for message in reversed(messages):
        if message.role == "user":
            return message
    return None


# ==============================================================================
#                           MODEL PYDANTIC UNTUK EMOSI
# ==============================================================================

class EmotionIn(BaseModel):
    text: str
    persona: str | None = None

class EmotionOut(BaseModel):
    emotion: str = "neutral" 
    blink: bool = True
    wink: bool = False
    headSwaySpeed: float = 1.0
    glow: str = "#a78bfa"


# ==============================================================================
#                           ENDPOINT API
# ==============================================================================

@app.on_event("startup")
async def on_startup() -> None:
    """Menginisialisasi koneksi database saat aplikasi dimulai."""
    logger.info("Startup aplikasi: Menginisialisasi database...")
    init_db() 
    logger.info("Database berhasil diinisialisasi.")


@app.get("/health", tags=["Utilitas"])
async def health_check() -> Dict[str, str]:
    """Endpoint sederhana untuk memastikan bahwa API sedang berjalan."""
    logger.info("Endpoint health check dipanggil.")
    return {"status": "ok"}


# --- ENDPOINT /API/RESET (PERBAIKAN ERROR 404) ---
@app.post("/api/reset", tags=["Utilitas"])
async def reset_session_memory():
    """Endpoint untuk mereset seluruh memori (database) dan cache."""
    try:
        # Panggilan ke fungsi yang baru kita tambahkan di memory.py
        await asyncio.to_thread(clear_memory_db) 
        _response_cache.clear()
        logger.info("Database memori dan cache obrolan BERHASIL direset.")
        return {"message": "Sesi obrolan dan memori berhasil direset."}
    except Exception as e:
        logger.error("Gagal mereset database: %s", e)
        raise HTTPException(status_code=500, detail="Gagal mereset memori database.")

# --- ENDPOINT /CHAT ---
@app.post("/chat", tags=["Chat"])
async def chat_endpoint(payload: ChatRequest) -> StreamingResponse:
    """Endpoint utama untuk menangani percakapan obrolan melalui streaming."""
    logger.info("Menerima permintaan obrolan.")
    _validate_messages(payload.messages) 
    
    clean_messages = _clean_interrupted_assistant_messages(payload.messages)
    last_user_message = _extract_last_user_message(clean_messages)
    memory_context = ""

    if payload.use_memory and last_user_message:
        logger.info("Mencari memori untuk kueri: '%s...'", last_user_message.content[:50])
        memory_hits = await asyncio.to_thread(search_memory, last_user_message.content, 3)
        if memory_hits:
            memory_snippets = [row['text'] for row in memory_hits]
            memory_context = "Hal yang pernah kamu ceritain sebelumnya: " + ", ".join(memory_snippets) + "."
            logger.info("Menemukan %d memori yang relevan.", len(memory_hits))

    persona_key = (payload.persona or settings.DEFAULT_PERSONA).strip().lower()
    logger.info("Persona diminta=%r, Persona diselesaikan=%s", payload.persona, persona_key)
    active_persona_prompt = PERSONAS.get(persona_key, PERSONAS[settings.DEFAULT_PERSONA])
    
    cache_key: Optional[tuple[str, str]] = None
    cached_text: Optional[str] = None
    last_user_content = last_user_message.content.strip() if last_user_message else ""
    if last_user_content:
        cache_key = (persona_key, last_user_content.lower())
        cached_text = _cache_get(cache_key)
        
    system_prompt = prepare_system_prompt(
        persona_default=TSUNDERE_PERSONA,
        persona_override=active_persona_prompt,
        memory_snippet=memory_context or None,
    )
    
    async def event_stream() -> AsyncGenerator[str, None]:
        queue: asyncio.Queue[str] = asyncio.Queue()
        done = asyncio.Event()

        async def producer() -> None:
            try:
                delay = settings.TSUNDERE_TYPING_DELAY if persona_key == "tsundere" else 0.0
                if cached_text is not None:
                    if delay: await asyncio.sleep(delay)
                    for chunk in _chunk_text(cached_text):
                        await queue.put(f"event: token\ndata: {chunk}\n\n")
                else:
                    captured: list[str] = []
                    async for token in call_gemini_stream(clean_messages, system_prompt, delay_seconds=delay):
                        captured.append(token)
                        await queue.put(f"event: token\ndata: {token}\n\n")
                    if cache_key and captured:
                        _cache_put(cache_key, "".join(captured).strip())
            except Exception:
                logger.exception("Streaming Gemini gagal")
                error_msg = ("Ih berisik! Servernya lagi ngambek!" if persona_key == "tsundere" else "Server lagi ada masalah nih, coba lagi nanti ya.")
                await queue.put(f"event: error\ndata: {error_msg}\n\n")
            finally:
                logger.info("Streaming selesai untuk permintaan ini.")
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
            with contextlib.suppress(Exception): await producer_task
            with contextlib.suppress(Exception): await heartbeat_task

    headers = {
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
        "X-Persona-Requested": (payload.persona or "Not Provided"),
        "X-Persona-Resolved": persona_key,
    }
    return StreamingResponse(event_stream(), media_type="text/event-stream", headers=headers)


@app.post("/memory/upsert", tags=["Memori"])
async def memory_upsert_endpoint(payload: MemoryUpsert) -> dict:
    """Menyimpan entri memori ke database."""
    logger.info("Menyimpan memori tipe '%s'", payload.type)
    stored = await asyncio.to_thread(upsert_memory, payload.type, payload.text)
    return {"memory": stored}


@app.post("/memory/search", tags=["Memori"])
async def memory_search_endpoint(payload: MemorySearch) -> dict:
    """Mencari memori yang relevan dari database."""
    top_k = max(1, payload.top_k or 3)
    logger.info("Mencari memori dengan top_k=%d", top_k)
    try:
        results = await asyncio.to_thread(search_memory, payload.query, top_k)
        return {"results": results or []}
    except Exception:
        logger.exception("Gagal mencari memori")
        raise HTTPException(status_code=500, detail="Pencarian memori gagal.")


# --- ENDPOINT /EMOTION ---
@app.post("/emotion", response_model=EmotionOut, tags=["Avatar"])
async def emotion_endpoint(payload: EmotionIn) -> EmotionOut:
    """Kembalikan state emosi JSON untuk sinkron avatar."""
    settings_env = get_settings()
    model = settings_env.gemini_model.strip()
    key = settings_env.gemini_api_key.strip()
    
    if not key:
        logger.warning("GEMINI_API_KEY kosong, pakai default fallback emotion.")
        return EmotionOut()

    persona_hint = (payload.persona or "").strip().lower()
    
    prompt = f"""
Klasifikasikan mood dari teks berikut dan keluarkan JSON VALID saja (tanpa catatan):
Teks: {payload.text}
Jika persona pengguna 'tsundere', sebutkan 'tsun' saat nada ketus namun peduli.
Skema ketat: {{ 
  "emotion": "neutral|happy|sad|angry|tsun|excited|calm", 
  "blink": true|false, 
  "wink": true|false, 
  "headSwaySpeed": number, # 0.6..1.6 
  "glow": "#RRGGBB" 
}}
Aturan pewarnaan: neutral=#a78bfa, happy=#ff90c2, tsun=#f38bb3, calm=#6ea8ff, excited=#ffd166, sad=#94a3b8, angry=#fb7185.
Persona aktif: {persona_hint if persona_hint else "tidak disebut"}.
"""
    
    body = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"responseMimeType": "application/json"},
    }
    
    url = f"{settings_env.gemini_base_url}/{model}:generateContent"
    try:
        async with httpx.AsyncClient(timeout=settings_env.request_timeout) as cli:
            r = await cli.post(f"{url}?key={key}", json=body)
            r.raise_for_status() 
            data = r.json()
            
            raw = data["candidates"][0]["content"]["parts"][0]["text"]
            parsed = json.loads(raw)
            
            return EmotionOut(
                emotion=str(parsed.get("emotion", "neutral")),
                blink=bool(parsed.get("blink", True)),
                wink=bool(parsed.get("wink", False)),
                headSwaySpeed=float(parsed.get("headSwaySpeed", 1.0) if isinstance(parsed.get("headSwaySpeed"), (int, float)) else 1.0),
                glow=str(parsed.get("glow", "#a78bfa")),
            )
            
    except (httpx.HTTPStatusError, json.JSONDecodeError, KeyError) as e:
        logger.error("Gagal klasifikasi emosi: Status/JSON Error - %s", e)
        return EmotionOut()
    except Exception as e:
        logger.exception("Gagal klasifikasi emosi (Exception tak terduga): %s", e)
        return EmotionOut()