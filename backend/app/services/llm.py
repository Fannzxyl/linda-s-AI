# backend/app/services/llm.py

import asyncio
import json
import logging
import re
import base64
import time
from datetime import datetime 
from io import BytesIO
from typing import AsyncGenerator, Dict, List, Tuple, Optional, Any

import httpx
from PIL import Image

from app.config import get_settings
from app.schemas import Message

# --- IMPORT FITUR SEARCH ---
try:
    from app.services.search import search_google
except ImportError:
    logging.warning("Modul search_google tidak ditemukan. Fitur browsing dimatikan.")
    def search_google(q): return ""

logging.getLogger("httpx").setLevel(logging.WARNING)
logger = logging.getLogger(__name__)
_CONNECTED_FLAG = False

# ==============================================================================
#                           HELPER FUNCTIONS
# ==============================================================================

def _mask_key(text: str) -> str:
    return re.sub(r'key=AIza[a-zA-Z0-9_\-]+', 'key=AIza***HIDDEN***', str(text))

def _build_image_part_dict(image_base64: str) -> Optional[Dict[str, Any]]:
    if "," in image_base64:
        header, encoded = image_base64.split(",", 1)
        mime_type = header.split(":")[1].split(";")[0]
    else:
        encoded = image_base64
        mime_type = "image/jpeg"
    try:
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
        
    return {
        "system_instruction": {"parts": [{"text": system_prompt}]},
        "contents": contents,
        "generationConfig": {
            "temperature": 0.7, # Agak serius dikit biar gak halu
            "topP": 0.95,
            "topK": 40,
            "maxOutputTokens": 8192,
            "responseMimeType": "text/plain",
        },
    }

# ==============================================================================
#                           CORE FUNCTION (SMART SEARCH)
# ==============================================================================

async def call_gemini_stream(
    messages: List[Message],
    system_prompt: str,
    *,
    image_base64: Optional[str] = None,
    delay_seconds: float = 0.0,
    api_key: Optional[str] = None,
) -> AsyncGenerator[str, None]:
    
    settings = get_settings()
    final_api_key = api_key or settings.gemini_api_key
    
    if not final_api_key:
        raise ValueError("API Key kosong! Masukkan di Frontend atau .env")

    # --- 1. SUNTIK TANGGAL HARI INI ---
    # Biar Linda sadar waktu
    today = datetime.now().strftime("%A, %d %B %Y")
    time_context = f"\n[INFO WAKTU SAAT INI]: {today}. Jika user bertanya tentang 'sekarang' atau 'terbaru', gunakan tanggal ini sebagai acuan."
    system_prompt += time_context

    # --- 2. LOGIKA SEARCH (MATA-MATA INTERNET) ---
    last_user_msg = messages[-1].content.lower() if messages else ""
    
    # Trigger words diperbanyak
    trigger_words = ["siapa", "kapan", "dimana", "berita", "terbaru", "skor", "cuaca", "harga", "cari", "search", "info", "presiden", "pemilu", "juara"]
    
    should_search = any(word in last_user_msg for word in trigger_words) and not image_base64
    
    if should_search:
        search_context = search_google(last_user_msg)
        if search_context:
            logger.info("🔍 Info internet ditemukan, memaksa Linda baca...")
            
            # --- UPDATE: PROMPT LEBIH GALAK ---
            # Kita taruh hasil search di PALING ATAS instruksi biar dibaca duluan
            search_instruction = f"""
            !!! DATA INTERNET TERBARU (REAL-TIME) !!!
            {search_context}
            
            INSTRUKSI PENTING:
            1. Gunakan data di atas untuk menjawab pertanyaan user.
            2. Data di atas LEBIH AKURAT daripada ingatanmu sendiri.
            3. Jika data di atas bilang Presiden adalah Prabowo, MAKA JAWAB PRABOWO (abaikan ingatan lamamu tentang Jokowi).
            4. Jawab tetap dengan gaya persona yang aktif.
            """
            system_prompt = search_instruction + "\n\n" + system_prompt

    # --- 3. DAFTAR MODEL ---
    candidate_models = [
        ("gemini-2.5-flash", "v1beta"),     
        ("gemini-1.5-flash", "v1beta"),     
        ("gemini-1.5-flash", "v1"),         
        ("gemini-1.5-flash-8b", "v1beta"),  
        ("gemini-1.5-pro", "v1beta"),       
    ]
    
    payload = _build_payload(messages, system_prompt, image_base64)
    last_error = "Belum mencoba"

    for model_name, api_version in candidate_models:
        base_url = f"https://generativelanguage.googleapis.com/{api_version}/models"
        url = f"{base_url}/{model_name}:streamGenerateContent"
        params = {"key": final_api_key, "alt": "sse"}
        
        logger.info(f"Menghubungi: {model_name} ({api_version})...")

        try:
            async with httpx.AsyncClient(timeout=settings.request_timeout) as client:
                async with client.stream("POST", url, params=params, json=payload) as response:
                    
                    status = response.status_code
                    
                    if status == 404:
                        logger.warning(f"Model {model_name} 404. Skip.")
                        continue 
                    
                    if status == 429 or status >= 500:
                        logger.warning(f"Model {model_name} {status}. Istirahat 1 detik...")
                        await asyncio.sleep(1)
                        last_error = f"Server Error ({status})"
                        continue

                    if status == 401:
                        raise httpx.HTTPStatusError("API Key Salah/Expired.", request=response.request, response=response)

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
                                
                    _log_connected(f"{model_name} ({api_version})")
                    return 

        except httpx.HTTPStatusError as exc:
            last_error = f"HTTP Error {exc.response.status_code}"
            safe_url = _mask_key(str(exc.request.url))
            logger.warning(f"Request failed: {safe_url} -> {exc.response.status_code}")
        except Exception as exc:
            last_error = str(exc)
            logger.warning(f"Error koneksi ke {model_name}: {exc}")

    error_msg = str(last_error)
    if "429" in error_msg:
        raise RuntimeError("Kuota API Key habis (429). Ganti key baru!")
    
    raise RuntimeError(f"Gagal menghubungi semua model Gemini. Terakhir: {error_msg}")

# ... (Sisa fungsi internal di bawah tetap sama, gak perlu diubah) ...
# Pastikan fungsi _read_sse_payloads, _compute_delta, dll tetap ada di bawah sini
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
    return text.replace("\r", "")

def _log_connected(model: str) -> None:
    global _CONNECTED_FLAG
    if not _CONNECTED_FLAG:
        logger.info(f"Gemini connected via model {model} [ok]")
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