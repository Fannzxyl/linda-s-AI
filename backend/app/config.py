# backend/app/config.py (Kode FINAL yang Diperbaiki)
import os
from functools import lru_cache
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv, dotenv_values

# Asumsi lokasi BASE_DIR: C:\Alfan\linda-s-AI\backend
BASE_DIR = Path(__file__).resolve().parent.parent
ENV_PATH = BASE_DIR / ".env"

# Muat .env dan paksa override
load_dotenv(dotenv_path=str(ENV_PATH), override=True)

# Baca semua nilai .env, untuk fallback jika os.getenv gagal
ENV_VALUES = dotenv_values(str(ENV_PATH)) if ENV_PATH.exists() else {}

if ENV_VALUES:
    normalised = {}
    for key, value in ENV_VALUES.items():
        clean_key = key.lstrip("\ufeff") # Menghapus karakter BOM (Byte Order Mark) jika ada
        normalised[clean_key] = value
        if value is not None and clean_key not in os.environ:
            os.environ[clean_key] = str(value)
    ENV_VALUES = normalised

def _read_env(name: str, default: Optional[str] = None) -> Optional[str]:
    """Baca variabel dari os.environ, dengan fallback ke ENV_VALUES jika kosong."""
    val = os.getenv(name)
    if val is None or str(val).strip() == "":
        val = ENV_VALUES.get(name, default)
    if val is None:
        return default
    cleaned = str(val).strip()
    return cleaned if cleaned else default

class Settings:
    def __init__(self) -> None:
        # Pemuatan Variabel dari Environment atau .env
        self.gemini_api_key: str = _read_env("GEMINI_API_KEY") or ""
        self.gemini_model: str = _read_env("GEMINI_MODEL") or "gemini-2.5-flash"
        
        # PERBAIKAN KRUSIAL: Menambahkan '/models' ke BASE_URL.
        # Ini memperbaiki error 404 Not Found.
        self.gemini_base_url: str = _read_env(
            "GEMINI_BASE_URL",
            "https://generativelanguage.googleapis.com/v1beta/models", # <-- PATH SUDAH BENAR
        ) or "https://generativelanguage.googleapis.com/v1beta/models"
        
        # Angka
        self.request_timeout: float = float(_read_env("REQUEST_TIMEOUT", "45"))
        self.max_retries: int = int(_read_env("MAX_RETRIES", "3"))
        self.backoff_factor: float = float(_read_env("BACKOFF_FACTOR", "1.6"))
        
        # Path DB
        self.memory_db_path: Path = Path(
            _read_env("MEMORY_DB_PATH", str(BASE_DIR / "memory.db"))
        )

        # Validasi krusial
        if not self.gemini_api_key:
            raise RuntimeError("GEMINI_API_KEY kosong. Aplikasi TIDAK DAPAT terhubung ke Gemini.")
        
        # Baris ini tidak lagi diperlukan karena BASE_URL sudah benar
        # if self.gemini_base_url.endswith("/"):
        #     self.gemini_base_url = self.gemini_base_url.rstrip("/")

@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Mengembalikan instance Settings yang di-cache."""
    return Settings()