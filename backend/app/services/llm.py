import asyncio
import json
import logging
import re
from typing import AsyncGenerator, Dict, List, Tuple

import httpx

from ..config import get_settings
from ..schemas import Message

logger = logging.getLogger(__name__)
_CONNECTED_FLAG = False


# ### PERBAIKAN KRUSIAL: FUNGSI INI DIGANTI TOTAL ###
# Logika baru ini memastikan hanya SATU persona yang aktif: override, atau default jika override tidak ada.
# Persona tidak lagi digabungkan, sehingga menyelesaikan masalah utama.
def prepare_system_prompt(
    persona_default: str,
    persona_override: str | None = None,
    memory_snippet: str | None = None,
) -> str:
    """Return the final system prompt with optional overrides and memory context."""
    # Pakai override kalau ada; JANGAN gabung dengan default.
    persona = (persona_override or persona_default).strip()

    parts = [persona]
    if memory_snippet:
        # Menggabungkan memori dengan format yang lebih natural
        parts.append(
            "Catatan konteks dari obrolan sebelumnya: " + memory_snippet.strip() +
            "\nGunakan konteks ini secara natural dalam percakapan, jangan sebutkan sebagai daftar memori."
        )
    return "\n\n".join(parts)


async def call_gemini_stream(
    messages: List[Message],
    system_prompt: str,
    *,
    delay_seconds: float = 0.0,
) -> AsyncGenerator[str, None]:
    """Stream response tokens from Gemini API and yield per chunk."""

    settings = get_settings()
    payload = _build_payload(messages, system_prompt)
    candidate_models = _model_variants(settings.gemini_model.strip())

    last_error: Exception | None = None

    for idx, model in enumerate(candidate_models):
        url = f"{settings.gemini_base_url}/{model}:streamGenerateContent"
        params = {"key": settings.gemini_api_key, "alt": "sse"}

        attempt = 0
        backoff = settings.backoff_factor
        while True:
            try:
                async with httpx.AsyncClient(timeout=settings.request_timeout) as client:
                    async with client.stream("POST", url, params=params, json=payload) as response:
                        if response.status_code == 404 and idx < len(candidate_models) - 1:
                            last_error = httpx.HTTPStatusError("Model variant not found", request=response.request, response=response)
                            _log_http_error(last_error)
                            break
                        response.raise_for_status()
                        aggregated_raw = ""
                        first_chunk = True
                        async for payload_json in _read_sse_payloads(response):
                            if payload_json == "[DONE]":
                                break
                            chunks = _extract_text(payload_json)
                            for token in chunks:
                                if not token:
                                    continue
                                delta_raw, aggregated_raw = _compute_delta(token, aggregated_raw)
                                if not delta_raw:
                                    continue
                                cleaned = _sanitize_delta(delta_raw)
                                if not cleaned:
                                    continue
                                if first_chunk and delay_seconds > 0:
                                    await asyncio.sleep(delay_seconds)
                                    delay_seconds = 0.0
                                if first_chunk:
                                    cleaned = cleaned.lstrip()
                                    first_chunk = False
                                if cleaned:
                                    yield cleaned
                        _log_connected(model)
                return
            except httpx.HTTPStatusError as exc:
                if exc.response.status_code == 404 and idx < len(candidate_models) - 1:
                    last_error = exc
                    _log_http_error(exc)
                    break
                attempt += 1
                last_error = exc
                _log_http_error(exc)
            except (httpx.HTTPError, httpx.ReadTimeout) as exc:
                attempt += 1
                last_error = exc
                logger.warning("Gemini request error: %s", exc)

            if attempt > settings.max_retries:
                break
            sleep_for = backoff**attempt
            await asyncio.sleep(sleep_for)

    status = None
    if isinstance(last_error, httpx.HTTPStatusError) and last_error.response:
        status = last_error.response.status_code
    message = (
        f"Gemini API failed after trying variants {candidate_models}. "
        f"Last status: {status if status is not None else 'unavailable'}"
    )
    raise RuntimeError(message) from last_error


def _build_payload(messages: List[Message], system_prompt: str) -> Dict:
    """Map internal message schema to Gemini request payload."""
    # Gemini modern models prefer system instruction as a top-level field.
    contents: List[Dict[str, object]] = []
    for message in messages:
        # Skip legacy system message, it's handled by system_prompt
        if message.role == "system":
            continue
        role = "user" if message.role == "user" else "model"
        contents.append({"role": role, "parts": [{"text": message.content}]})

    payload: Dict[str, object] = {
        "system_instruction": {"parts": [{"text": system_prompt}]},
        "contents": contents,
        "generationConfig": {
            "temperature": 0.65,
            "topP": 0.9,
            "topK": 32,
            "maxOutputTokens": 600,
            "responseMimeType": "text/plain",
        },
    }
    return payload


async def _read_sse_payloads(response: httpx.Response) -> AsyncGenerator[str, None]:
    buffer = []
    async for raw_line in response.aiter_lines():
        if raw_line.startswith(":"): continue
        if raw_line.startswith("event"): continue
        if raw_line.startswith("data:"):
            buffer.append(raw_line[len("data:") :].strip())
            continue
        if raw_line == "":
            if not buffer: continue
            payload = "\n".join(buffer).strip()
            buffer.clear()
            if payload: yield payload
            continue
        buffer.append(raw_line.strip())
    if buffer:
        payload = "\n".join(buffer).strip()
        if payload: yield payload


def _model_variants(model: str) -> List[str]:
    variants = []
    base = model or "gemini-1.5-flash"
    def add_variant(value: str):
        if value not in variants: variants.append(value)
    add_variant(base)
    if not base.endswith("-latest"): add_variant(f"{base}-latest")
    return variants


def _compute_delta(chunk: str, prior: str) -> Tuple[str, str]:
    if not prior: return chunk, chunk
    if chunk.startswith(prior):
        delta = chunk[len(prior) :]
        return (delta, chunk) if delta else ("", chunk)
    if prior.startswith(chunk): return "", prior
    return chunk, prior + chunk


def _sanitize_delta(text: str) -> str:
    cleaned = text.replace("\r", "")
    for symbol in ["**", "__", "_", "`", "~~"]: cleaned = cleaned.replace(symbol, "")
    cleaned = re.sub(r"^#{1,6}\s*", "", cleaned, flags=re.MULTILINE)
    cleaned = re.sub(r"\*\s*", "", cleaned)
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)
    cleaned = re.sub(r"[ \t]+\n", "\n", cleaned)
    return cleaned


def _log_http_error(exc: httpx.HTTPStatusError) -> None:
    safe_url = exc.request.url.copy_with(query=None) if exc.request else "unknown_url"
    logger.warning("Gemini request failed: %s -> %s", safe_url, exc.response.status_code if exc.response else "no-response")


def _log_connected(model: str) -> None:
    global _CONNECTED_FLAG
    if not _CONNECTED_FLAG:
        logger.info("Gemini connected via model %s [ok]", model)
        _CONNECTED_FLAG = True


def _extract_text(line: str) -> List[str]:
    try: data = json.loads(line)
    except json.JSONDecodeError: return []
    chunks: List[str] = []
    for candidate in data.get("candidates", []):
        content = candidate.get("content", {})
        parts = content.get("parts", []) if isinstance(content, dict) else []
        for part in parts:
            text = part.get("text") if isinstance(part, dict) else None
            if text: chunks.append(text)
    return chunks

# Sisa fungsi lainnya tetap sama, tidak perlu diubah.
# summarize_for_memory, _split_sentences, etc.
def summarize_for_memory(user_text: str) -> Tuple[str, str]:
    normalized = " ".join(user_text.split())
    lower_text = normalized.lower()
    if any(keyword in lower_text for keyword in ("todo", "kerjakan", "ingat untuk", "harus")): category = "todo"
    elif any(keyword in lower_text for keyword in ("suka", "favorit", "kesukaan", "prefer")): category = "preference"
    else: category = "fact"
    sentences = _split_sentences(normalized)
    summary = " ".join(sentences[:3]) if sentences else normalized
    if not summary.endswith("."): summary = summary.rstrip(".") + "."
    return category, summary


def _split_sentences(text: str) -> List[str]:
    final, buffer, terminators = [], [], {".", "?", "!"}
    for char in text:
        buffer.append(char)
        if char in terminators:
            sentence = "".join(buffer).strip()
            if sentence: final.append(sentence)
            buffer = []
    if buffer:
        sentence = "".join(buffer).strip()
        if sentence: final.append(sentence)
    return final