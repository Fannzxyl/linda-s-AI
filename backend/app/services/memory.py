import sqlite3
import textwrap
from pathlib import Path
from typing import Dict, List, Any

# Perbaikan Impor 1: Naik satu level (..) untuk mengakses config.py di folder 'app'
from ..config import get_settings

# Perbaikan Impor 2: Naik satu level (..) untuk mengakses schemas.py di folder 'app'
from ..schemas import MemorySearch, MemoryUpsert 

# Perbaikan Impor 3: Sibling Import (langsung) untuk mengakses llm.py di folder yang sama (services)
# Catatan: Baris ini diperlukan JIKA fungsi llm dipanggil di dalam memory.py (meskipun tidak tampak dalam kode Anda)
# Namun, agar menghindari impor sirkular yang tidak perlu, SAYA HAPUS impor llm di sini.
# Jika Anda tetap ingin mengimpornya, gunakan: from .llm import call_gemini_stream, prepare_system_prompt

# --- PENTING: Saya HAPUS semua impor yang tidak perlu di memory.py, termasuk dari .llm ---

# --- Fungsi Database ---

def _get_db_path() -> Path:
    path = get_settings().memory_db_path
    path.parent.mkdir(parents=True, exist_ok=True)
    return path


def init_db() -> None:
    """Create the memories table if it does not exist."""

    db_path = _get_db_path()
    with sqlite3.connect(db_path) as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS memories (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                type TEXT NOT NULL,
                text TEXT NOT NULL,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(type, text)
            );
            """
        )
        conn.commit()


def _compact_text(raw_text: str) -> str:
    """Trim whitespace and shorten long memories to 140 characters."""

    normalized = " ".join(raw_text.split())
    if len(normalized) <= 140:
        return normalized
    return textwrap.shorten(normalized, width=140, placeholder="…")


def upsert_memory(memory_type: str, text: str) -> Dict[str, Any]:
    """Insert or replace a memory entry and return the stored row."""

    # Gunakan skema Pydantic untuk validasi input sebelum diproses
    # Pydantic otomatis memvalidasi saat endpoint dipanggil, tapi ini bagus untuk keamanan
    
    compacted = _compact_text(text)
    db_path = _get_db_path()
    with sqlite3.connect(db_path) as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO memories(type, text)
            VALUES(?, ?)
            ON CONFLICT(type, text) DO UPDATE SET created_at = excluded.created_at
            """,
            (memory_type, compacted),
        )
        conn.commit()
        cursor.execute(
            """
            SELECT id, type, text, created_at
            FROM memories
            WHERE type = ? AND text = ?
            """,
            (memory_type, compacted),
        )
        row = cursor.fetchone()
    if not row:
        # Jika terjadi kegagalan unik, ini akan terangkat (meskipun sudah ditangani ON CONFLICT)
        raise RuntimeError("Failed to persist memory.")
    return {
        "id": row[0],
        "type": row[1],
        "text": row[2],
        "created_at": row[3],
    }


def search_memory(query: str, top_k: int = 5) -> List[Dict[str, Any]]:
    """Search memory entries by query string, returning the newest first."""

    db_path = _get_db_path()
    like_query = f"%{query.strip()}%"
    with sqlite3.connect(db_path) as conn:
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT id, type, text, created_at
            FROM memories
            WHERE text LIKE ? OR type LIKE ?
            ORDER BY datetime(created_at) DESC
            LIMIT ?
            """,
            (like_query, like_query, top_k),
        )
        rows = cursor.fetchall()
    # Mengonversi Row objek menjadi dict Python standar
    return [dict(row) for row in rows]


def clear_memory_db() -> bool:
    """Menghapus semua entri dari tabel memori. Diperlukan untuk endpoint /api/reset."""
    db_path = _get_db_path()
    with sqlite3.connect(db_path) as conn:
        # Menghapus semua baris
        conn.execute("DELETE FROM memories")
        conn.commit()
    return True