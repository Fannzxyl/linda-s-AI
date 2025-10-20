import asyncio
import json
import logging
import re
import base64
from io import BytesIO
from typing import AsyncGenerator, Dict, List, Tuple, Optional, Any

import httpx
from PIL import Image 
# Hapus impor google.genai.types karena kita menggunakan dictionary standar

# Impor dari folder induk (app)
from ..config import get_settings 
from ..schemas import Message

logger = logging.getLogger(__name__)
_CONNECTED_FLAG = False

# ==============================================================================
# FUNGSI HELPER UTAMA (MULTIMODAL & UTILITY)
# ==============================================================================

def _build_image_part_dict(image_base64: str) -> Optional[Dict[str, Any]]:
    """Mengonversi string Base64 menjadi Dict Python untuk payload API (JSON serializable)."""
    
    if "," in image_base64:
        header, encoded = image_base64.split(",", 1)
        mime_type = header.split(":")[1].split(";")[0]
    else:
        encoded = image_base64
        mime_type = "image/jpeg" # Default fallback
    
    try:
        image_bytes = base64.b64decode(encoded)
        Image.open(BytesIO(image_bytes)) # Verifikasi gambar
        
        return {
            "inlineData": {
                "data": encoded,  # Mengirim Base64 string terenkripsi
                "mimeType": mime_type 
            }
        }

    except Exception as e:
        logger.error("Gagal memproses gambar Base64: %s", e)
        return None


def prepare_system_prompt(
    persona_default: str,
    persona_override: str | None = None,
    memory_snippet: str | None = None,
) -> str:
    """Return the final system prompt with optional overrides and memory context."""
    persona = (persona_override or persona_default).strip()

    parts = [persona]
    if memory_snippet:
        parts.append(
            "Catatan konteks dari obrolan sebelumnya: " + memory_snippet.strip() +
            "\nGunakan konteks ini secara natural dalam percakapan, jangan sebutkan sebagai daftar memori."
        )
    return "\n\n".join(parts)


def _build_payload(
    messages: List[Message], 
    system_prompt: str,
    image_base64: Optional[str] = None, 
) -> Dict:
    """Map internal message schema to Gemini request payload (Multimodal support)."""
    
    image_part = None
    if image_base64:
        image_part = _build_image_part_dict(image_base64)
        
    contents: List[Dict[str, object]] = []
    
    last_user_content_index = -1
    for i in reversed(range(len(messages))):
        if messages[i].role == "user":
            last_user_content_index = i
            break

    for i, message in enumerate(messages):
        if message.role == "system": continue

        role = "user" if message.role == "user" else "model"
        parts: List[Dict[str, str] | Dict[str, Any]] = [{"text": message.content}] 

        if i == last_user_content_index and image_part:
            parts.insert(0, image_part) 
            
        contents.append({"role": role, "parts": parts})

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

# ==============================================================================
# FUNGSI LLM UTAMA
# ==============================================================================

async def call_gemini_stream(
    messages: List[Message],
    system_prompt: str,
    *,
    image_base64: Optional[str] = None,
    delay_seconds: float = 0.0,
) -> AsyncGenerator[str, None]:
    """Stream response tokens from Gemini API and yield per chunk."""

    settings = get_settings()
    model = settings.gemini_model.strip() 
    
    payload = _build_payload(messages, system_prompt, image_base64) 
    candidate_models = [model]
    last_error: Exception | None = None

    for idx, current_model in enumerate(candidate_models): 
        url = f"{settings.gemini_base_url}/{current_model}:streamGenerateContent"
        params = {"key": settings.gemini_api_key, "alt": "sse"}

        attempt = 0
        backoff = settings.backoff_factor
        
        while True:
            try:
                if not settings.gemini_api_key:
                     raise ValueError("GEMINI_API_KEY tidak ditemukan atau kosong di .env.")

                async with httpx.AsyncClient(timeout=settings.request_timeout) as client:
                    async with client.stream("POST", url, params=params, json=payload) as response:
                        
                        response.raise_for_status() 
                        
                        aggregated_raw = ""
                        first_chunk = True
                        # PANGGILAN SUKSES KE FUNGSI HELPER DI BAWAH
                        async for payload_json in _read_sse_payloads(response): 
                            if payload_json == "[DONE]":
                                break
                            chunks = _extract_text(payload_json)
                            for token in chunks:
                                if not token: continue
                                delta_raw, aggregated_raw = _compute_delta(token, aggregated_raw)
                                if not delta_raw: continue
                                
                                cleaned = _sanitize_delta(delta_raw)
                                if not cleaned: continue
                                
                                if first_chunk and delay_seconds > 0:
                                    await asyncio.sleep(delay_seconds)
                                    delay_seconds = 0.0
                                
                                if first_chunk:
                                    cleaned = cleaned.lstrip()
                                    first_chunk = False
                                    
                                if cleaned:
                                    yield cleaned
                        
                        _log_connected(current_model)
                        return 

            except httpx.HTTPStatusError as exc:
                attempt += 1
                last_error = exc
                _log_http_error(exc)
            
            except (httpx.HTTPError, httpx.ReadTimeout, ValueError) as exc:
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
        f"Gemini API failed after trying model '{model}' ({settings.max_retries + 1} attempts). "
        f"Last status: {status if status is not None else 'unavailable'}. "
        "CEK: 1. Nama model di .env (harus 'gemini-2.5-flash'). 2. Kunci API Anda."
    )
    raise RuntimeError(message) from last_error

# ==============================================================================
# FUNGSI HELPER STREAMING (DIPINDAHKAN AGAR TIDAK ADA NAMEERROR)
# ==============================================================================

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