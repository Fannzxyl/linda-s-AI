# backend/app/config.py
import os
from functools import lru_cache
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv, dotenv_values

BASE_DIR = Path(__file__).resolve().parent.parent
ENV_PATH = BASE_DIR / ".env"

# Muat .env dan paksa override
load_dotenv(dotenv_path=str(ENV_PATH), override=True)

# Kalau masih belum ada di os.environ, injek manual dari file .env
ENV_VALUES = dotenv_values(str(ENV_PATH)) if ENV_PATH.exists() else {}

if ENV_VALUES:
    normalised = {}
    for key, value in ENV_VALUES.items():
        clean_key = key.lstrip("\ufeff")
        normalised[clean_key] = value
        if value is not None and clean_key not in os.environ:
            os.environ[clean_key] = str(value)
    ENV_VALUES = normalised

def _read_env(name: str, default: Optional[str] = None) -> Optional[str]:
    val = os.getenv(name)
    if val is None or str(val).strip() == "":
        val = ENV_VALUES.get(name, default)
    if val is None:
        return default
    cleaned = str(val).strip()
    return cleaned if cleaned else default

class Settings:
    def __init__(self) -> None:
        self.gemini_api_key: str = _read_env("GEMINI_API_KEY") or ""
        self.gemini_model: str = _read_env("GEMINI_MODEL") or ""
        self.gemini_base_url: str = _read_env(
            "GEMINI_BASE_URL",
            "https://generativelanguage.googleapis.com/v1beta/models",
        ) or ""
        # angka
        self.request_timeout: float = float(_read_env("REQUEST_TIMEOUT", "45"))
        self.max_retries: int = int(_read_env("MAX_RETRIES", "3"))
        self.backoff_factor: float = float(_read_env("BACKOFF_FACTOR", "1.6"))
        # path db
        self.memory_db_path: Path = Path(
            _read_env("MEMORY_DB_PATH", str(BASE_DIR / "memory.db"))
        )

        # Validasi minimal
        if not self.gemini_api_key:
            raise RuntimeError("GEMINI_API_KEY kosong. Cek backend/.env kamu.")
        if not self.gemini_model:
            raise RuntimeError("GEMINI_MODEL kosong. Isi di backend/.env.")
        if not self.gemini_base_url:
            raise RuntimeError("GEMINI_BASE_URL kosong.")

@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
