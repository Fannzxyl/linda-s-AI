# backend/app/services/llm.py (VERSI FINAL DENGAN SAFETY SETTINGS DAN LOGIKA MODEL YANG BENAR)

import asyncio
import json
import logging
import re
import base64
from io import BytesIO
from typing import AsyncGenerator, Dict, List, Tuple, Optional, Any

import httpx
from PIL import Image

from ..config import get_settings
from ..schemas import Message

logger = logging.getLogger(__name__)
_CONNECTED_FLAG = False

# --- CONSTANTS UNTUK SAFETY SETTINGS (Google API Safety Harms) ---
# Menggunakan nilai INT yang setara dengan HarmCategory dan HarmBlockThreshold
HARM_CATEGORIES = {
    "HARASSMENT": 1,
    "HATE_SPEECH": 2,
    "SEXUALLY_EXPLICIT": 3,
    "DANGEROUS_CONTENT": 4,
}

# BLOCK_NONE = 4 (Izinkan semua, tidak disarankan)
# BLOCK_LOW_AND_ABOVE = 1 
# BLOCK_MEDIUM_AND_ABOVE = 2 
# BLOCK_ONLY_HIGH = 3 (Default Google)

# KITA PERKETAT: Block konten yang terdeteksi Medium (2) atau lebih tinggi
BLOCK_THRESHOLD = 2 


def _build_image_part_dict(image_base64: str) -> Optional[Dict[str, Any]]:
    if "," in image_base64:
        header, encoded = image_base64.split(",", 1)
        mime_type = header.split(":")[1].split(";")[0]
    else:
        encoded = image_base64
        mime_type = "image/jpeg"
    try:
        # Pengecekan PIL hanya untuk memastikan base64-nya valid gambar
        image_bytes = base64.b64decode(encoded)
        Image.open(BytesIO(image_bytes))
        return {"inlineData": {"data": encoded, "mimeType": mime_type}}
    except Exception as e:
        logger.error("Gagal memproses gambar Base64: %s", e)
        return None

def prepare_system_prompt(
    persona_default: str, persona_override: str | None = None, memory_snippet: str | None = None
) -> str:
    persona = (persona_override or persona_default).strip()
    parts = [persona]
    if memory_snippet:
        parts.append(
            "Catatan konteks dari obrolan sebelumnya: " + memory_snippet.strip() +
            "\nGunakan konteks ini secara natural dalam percakapan, jangan sebutkan sebagai daftar memori."
        )
    return "\n\n".join(parts)

def _build_payload(
    messages: List[Message], system_prompt: str, image_base64: Optional[str] = None
) -> Dict:
    image_part = _build_image_part_dict(image_base64) if image_base64 else None
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

    # --- PENAMBAHAN SAFETY SETTINGS (LEVEL 2) ---
    safety_settings = [
        {"category": f"HARM_CATEGORY_{category}", "threshold": BLOCK_THRESHOLD}
        for category in HARM_CATEGORIES.keys()
    ]
    # ---------------------------------------------

    return {
        "system_instruction": {"parts": [{"text": system_prompt}]},
        "contents": contents,
        "config": {
            "temperature": 0.65, 
            "topP": 0.9, 
            "topK": 32,
            "maxOutputTokens": 600, 
            "responseMimeType": "text/plain",
        },
        "safetySettings": safety_settings, # <-- DITAMBAHKAN DI SINI
    }


async def call_gemini_stream(
    messages: List[Message],
    system_prompt: str,
    *,
    image_base64: Optional[str] = None,
    delay_seconds: float = 0.0,
    api_key: Optional[str] = None,
) -> AsyncGenerator[str, None]:
    """Stream response tokens from Gemini API and yield per chunk."""

    settings = get_settings()

    # --- Tentukan API Key yang akan digunakan ---
    final_api_key = api_key or settings.gemini_api_key
    if not final_api_key:
        raise ValueError("GEMINI_API_KEY tidak ditemukan atau kosong. Key harus disediakan via .env atau header permintaan.")

    # --- PERBAIKAN DARI ANDA: Menggunakan logika fallback model yang benar ---
    model = settings.gemini_model.strip()
    
    # Logic penentuan model tetap dipertahankan
    allowed_models = {"gemini-2.0-flash", "gemini-2.5-flash", "gemini-2.0-pro", "gemini-1.5-flash"}
    if model not in allowed_models:
        model = "gemini-1.5-flash" # Fallback ke model dasar yang paling umum

    base_url = settings.gemini_base_url.strip() if settings.gemini_base_url else \
        "https://generativelanguage.googleapis.com/v1beta/models"

    payload = _build_payload(messages, system_prompt, image_base64)
    candidate_models = [model]
    last_error: Exception | None = None

    for current_model in candidate_models:
        url = f"{base_url}/{current_model}:streamGenerateContent"
        # --- Gunakan API Key yang sudah ditentukan ---
        params = {"key": final_api_key, "alt": "sse"}

        attempt = 0
        backoff = settings.backoff_factor
        
        while True:
            try:
                async with httpx.AsyncClient(timeout=settings.request_timeout) as client:
                    async with client.stream("POST", url, params=params, json=payload) as response:
                        # --- PERBAIKAN: Tangani error 401 (Unauthorized) secara eksplisit ---
                        if response.status_code == 401:
                            raise httpx.HTTPStatusError(
                                "API Key tidak valid atau ditolak.",
                                request=response.request,
                                response=response,
                            )
                        
                        # Note: Status 400 bisa jadi karena safety block. Kita biarkan raise_for_status yang menanganinya.
                        response.raise_for_status()
                        
                        aggregated_raw = ""
                        first_chunk = True
                        async for payload_json in _read_sse_payloads(response): 
                            if payload_json == "[DONE]": break
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
        "CEK: 1. Nama model di .env. 2. Kunci API Anda. 3. Billing Akun Google Cloud."
    )
    raise RuntimeError(message) from last_error


async def _read_sse_payloads(response: httpx.Response) -> AsyncGenerator[str, None]:
    buffer = []
    async for raw_line in response.aiter_lines():
        if raw_line.startswith(":") or raw_line.startswith("event"): continue
        if raw_line.startswith("data:"):
            buffer.append(raw_line[len("data:") :].strip())
            continue
        if raw_line == "":
            if buffer:
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
    try:
        data = json.loads(line)
    except json.JSONDecodeError:
        return []
    chunks: List[str] = []
    for candidate in data.get("candidates", []):
        content = candidate.get("content", {})
        parts = content.get("parts", []) if isinstance(content, dict) else []
        for part in parts:
            text = part.get("text") if isinstance(part, dict) else None
            if text:
                chunks.append(text)
    return chunks

def summarize_for_memory(user_text: str) -> Tuple[str, str]:
    normalized = " ".join(user_text.split())
    lower_text = normalized.lower()
    if any(keyword in lower_text for keyword in ("todo", "kerjakan", "ingat untuk", "harus")):
        category = "todo"
    elif any(keyword in lower_text for keyword in ("suka", "favorit", "kesukaan", "prefer")):
        category = "preference"
    else:
        category = "fact"
    sentences = _split_sentences(normalized)
    summary = " ".join(sentences[:3]) if sentences else normalized
    if not summary.endswith("."):
        summary = summary.rstrip(".") + "."
    return category, summary

def _split_sentences(text: str) -> List[str]:
    final, buffer, terminators = [], [], {".", "?", "!"}
    for char in text:
        buffer.append(char)
        if char in terminators:
            sentence = "".join(buffer).strip()
            if sentence:
                final.append(sentence)
            buffer = []
    if buffer:
        sentence = "".join(buffer).strip()
        if sentence:
            final.append(sentence)
    return final