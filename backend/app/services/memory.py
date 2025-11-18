# -*- coding: utf-8 -*-
"""
Service layer untuk mengelola memori jangka panjang chatbot (dengan Lazy Loading).
"""

import logging
import sqlite3
import textwrap
from pathlib import Path
from typing import Any, Dict, List, Optional

# --- Impor Pustaka Pihak Ketiga (Wajib Diinstal: faiss-cpu, sentence-transformers, numpy) ---
import faiss
import numpy as np
from sentence_transformers import SentenceTransformer

# --- Impor Lokal ---
from ..config import get_settings

# --- Konfigurasi Logging ---
logger = logging.getLogger(__name__)

# --- Variabel Global untuk Lazy Loading ---
MODEL_NAME = "all-MiniLM-L6-v2"
embedding_model: Optional[SentenceTransformer] = None
index: Optional[faiss.Index] = None
is_initialized = False

# ==============================================================================
#                          FUNGSI BANTU PATH & TEKS
# ==============================================================================

def _get_db_path() -> Path:
    """Mendapatkan path ke file database SQLite dari pengaturan."""
    # Asumsi pengaturan `memory_db_path` sudah benar
    path = get_settings().memory_db_path
    path.parent.mkdir(parents=True, exist_ok=True)
    return path

def _get_index_path() -> Path:
    """Mendapatkan path ke file indeks FAISS."""
    db_path = _get_db_path()
    return db_path.parent / "memory_index.faiss"

def _compact_text(raw_text: str) -> str:
    """Membersihkan spasi dan memotong teks agar tidak terlalu panjang."""
    normalized = " ".join(raw_text.split())
    if len(normalized) <= 140:
        return normalized
    return textwrap.shorten(normalized, width=140, placeholder="…")

# ==============================================================================
#                      INISIALISASI (Lazy & Safe)
# ==============================================================================

def init_memory_system(): # <-- PERBAIKAN: Mengganti nama fungsi agar sesuai dengan import di app/main.py
    """
    HANYA menginisialisasi tabel database SQLite saat startup.
    Fungsi ini ringan dan aman untuk dipanggil saat aplikasi dimulai.
    """
    db_path = _get_db_path()
    try:
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
        logger.info("Database memori berhasil divalidasi/dibuat.")
    except Exception as e:
        logger.error("Gagal menginisialisasi database memori: %s", e)
        raise

def _lazy_init_model_and_index():
    """
    Fungsi internal untuk memuat model dan indeks FAISS saat pertama kali diperlukan.
    """
    global embedding_model, index, is_initialized
    if is_initialized:
        return

    logger.info("LAZY INIT: Memulai inisialisasi sistem memori (Model + Indeks)...")

    # 1. Muat Model Embedding
    try:
        logger.info("Memuat model embedding '%s'...", MODEL_NAME)
        embedding_model = SentenceTransformer(MODEL_NAME)
        logger.info("Model embedding berhasil dimuat.")
    except Exception as e:
        logger.error("Gagal total memuat model SentenceTransformer: %s", e)
        raise RuntimeError(f"Tidak bisa memuat model '{MODEL_NAME}'. Pastikan koneksi internet ada dan library terinstal.") from e

    # 2. Muat atau Bangun Ulang Indeks FAISS
    index_path = _get_index_path()
    if index_path.exists():
        try:
            logger.info("Memuat indeks FAISS dari %s...", index_path)
            index = faiss.read_index(str(index_path))
            logger.info("Indeks FAISS berhasil dimuat. Terdapat %d vektor.", index.ntotal)
        except Exception as e:
            logger.error("Gagal memuat file indeks FAISS, akan coba membangun ulang: %s", e)
            _rebuild_index_from_db()
    else:
        logger.warning("File indeks FAISS tidak ditemukan. Membangun ulang dari database...")
        _rebuild_index_from_db()
    
    is_initialized = True
    logger.info("LAZY INIT: Inisialisasi sistem memori selesai.")


def _rebuild_index_from_db():
    """Membangun ulang indeks FAISS dari awal berdasarkan data di SQLite."""
    global index, embedding_model
    if embedding_model is None:
        raise RuntimeError("Model embedding belum diinisialisasi.")

    db_path = _get_db_path()
    with sqlite3.connect(db_path) as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id, text FROM memories ORDER BY id")
        rows = cursor.fetchall()

    dimension = embedding_model.get_sentence_embedding_dimension()
    index = faiss.IndexIDMap(faiss.IndexFlatL2(dimension))

    if not rows:
        logger.info("Database memori kosong, indeks FAISS baru yang kosong telah dibuat.")
        return

    logger.info("Membangun ulang indeks untuk %d memori...", len(rows))
    ids, texts = zip(*rows)
    
    try:
        embeddings = embedding_model.encode(list(texts), convert_to_tensor=False, show_progress_bar=True)
        ids_array = np.array(ids, dtype=np.int64)
        index.add_with_ids(embeddings, ids_array)
        
        logger.info("Pembangunan ulang indeks selesai. Menyimpan ke disk...")
        faiss.write_index(index, str(_get_index_path()))
        logger.info("Indeks baru berhasil disimpan.")
    except Exception as e:
        logger.error("Gagal saat proses encoding atau menyimpan indeks: %s", e)
        index = faiss.IndexIDMap(faiss.IndexFlatL2(dimension))


# ==============================================================================
#                           OPERASI CRUD MEMORI
# ==============================================================================

def upsert_memory(memory_type: str, text: str) -> Dict[str, Any]:
    """Menyimpan atau memperbarui memori di SQLite, lalu menambahkan vektornya ke FAISS."""
    _lazy_init_model_and_index() 
    
    if embedding_model is None or index is None:
        raise RuntimeError("Sistem memori gagal diinisialisasi.")

    compacted = _compact_text(text)
    db_path = _get_db_path()
    
    with sqlite3.connect(db_path) as conn:
        cursor = conn.cursor()
        cursor.execute("INSERT OR IGNORE INTO memories(type, text) VALUES(?, ?)", (memory_type, compacted))
        conn.commit()
        cursor.execute("SELECT id, type, text, created_at FROM memories WHERE type = ? AND text = ?", (memory_type, compacted))
        row = cursor.fetchone()

    if not row:
        raise RuntimeError("Gagal menyimpan atau mengambil memori dari database.")

    memory_id, memory_type, stored_text, created_at = row
    
    embedding = embedding_model.encode([stored_text], convert_to_tensor=False)
    vector_id = np.array([memory_id], dtype=np.int64)
    
    try:
        index.add_with_ids(embedding, vector_id)
        logger.info("Memori ID %d berhasil disimpan dan ditambahkan ke indeks. Total: %d", memory_id, index.ntotal)
        faiss.write_index(index, str(_get_index_path()))
    except Exception as e:
        logger.error("Gagal menambahkan vektor ID %d ke indeks: %s", memory_id, e)
        _rebuild_index_from_db()


    return {"id": memory_id, "type": memory_type, "text": stored_text, "created_at": created_at}


def search_memory(query: str, top_k: int = 5) -> List[Dict[str, Any]]:
    """Mencari memori yang paling relevan secara semantik menggunakan FAISS."""
    _lazy_init_model_and_index() 

    if embedding_model is None or index is None or index.ntotal == 0:
        logger.warning("Pencarian memori dilewati: sistem belum siap atau indeks kosong.")
        return []

    query_embedding = embedding_model.encode([query.strip()], convert_to_tensor=False)
    k = min(top_k, index.ntotal)
    
    distances, ids = index.search(query_embedding, k)
    
    found_ids = [int(i) for i in ids[0] if i != -1]
    if not found_ids:
        return []

    db_path = _get_db_path()
    with sqlite3.connect(db_path) as conn:
        conn.row_factory = sqlite3.Row 
        cursor = conn.cursor()
        placeholders = ",".join("?" for _ in found_ids)
        query_sql = f"SELECT id, type, text, created_at FROM memories WHERE id IN ({placeholders})"
        cursor.execute(query_sql, found_ids)
        rows = cursor.fetchall()

    results_map = {dict(row)["id"]: dict(row) for row in rows}
    sorted_results = [results_map[fid] for fid in found_ids if fid in results_map]

    return sorted_results


def clear_memory_system() -> bool:
    """Menghapus semua memori dari database dan juga menghapus file indeks FAISS."""
    global index, is_initialized
    
    db_path = _get_db_path()
    if db_path.exists():
        with sqlite3.connect(db_path) as conn:
            conn.execute("DELETE FROM memories")
            conn.commit()
            conn.execute("VACUUM") 
        logger.info("Semua entri dari tabel 'memories' telah dihapus.")

    index_path = _get_index_path()
    if index_path.exists():
        index_path.unlink()
        logger.info("File indeks FAISS '%s' telah dihapus.", index_path)
        
    # Reset state agar lazy init berjalan lagi nanti
    index = None
    is_initialized = False
    logger.info("Sistem memori telah direset. Akan diinisialisasi ulang pada pemanggilan berikutnya.")

    return True