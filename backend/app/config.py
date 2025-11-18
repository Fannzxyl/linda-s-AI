import os
from functools import lru_cache
from pathlib import Path
from typing import Optional

# Catatan: Asumsi dependensi pydantic_settings dan dotenv sudah ada

# Muat .env dan paksa override
# (Kode pemuatan .env dan _read_env disini)
from dotenv import load_dotenv, dotenv_values
BASE_DIR = Path(__file__).resolve().parent.parent
ENV_PATH = BASE_DIR / ".env"
load_dotenv(dotenv_path=str(ENV_PATH), override=True)
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
# -----------------------------------------------------

class Settings:
    def __init__(self) -> None:
        # Biarkan kosong, akan diisi dari Header
        self.gemini_api_key: str = _read_env("GEMINI_API_KEY") or "" 
        
        # Nama Model Default
        self.gemini_model: str = _read_env("GEMINI_MODEL") or "gemini-1.5-flash"
        
        # PERBAIKAN FINAL URL: Hanya sampai v1beta (llm.py akan menambahkan /models)
        self.gemini_base_url: str = _read_env(
            "GEMINI_BASE_URL",
            "https://generativelanguage.googleapis.com/v1beta", 
        ) or "https://generativelanguage.googleapis.com/v1beta"
        
        # Hapus trailing slash agar URL di llm.py menjadi https://.../v1beta/models/...
        self.gemini_base_url = self.gemini_base_url.rstrip("/")
        
        # Angka
        self.request_timeout: float = float(_read_env("REQUEST_TIMEOUT", "45"))
        self.max_retries: int = int(_read_env("MAX_RETRIES", "3"))
        self.backoff_factor: float = float(_read_env("BACKOFF_FACTOR", "1.6"))
        
        # Path DB
        self.memory_db_path: Path = Path(
            _read_env("MEMORY_DB_PATH", str(BASE_DIR / "memory.db"))
        )
        
        # Opsional: Beri warning jika tidak ada key, tapi jangan error (sudah diperbaiki)
        if not self.gemini_api_key:
            logger.warning("⚠️ Server berjalan tanpa API Key ENV. Menunggu Key dari Frontend.")


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Mengembalikan instance Settings yang di-cache."""
    return Settings()