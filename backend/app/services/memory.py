# -*- coding: utf-8 -*-
"""
Service layer untuk mengelola memori jangka panjang chatbot (dengan Lazy Loading).
File ini menangani penyimpanan ke SQLite dan Indexing Vektor menggunakan FAISS.
"""

import logging
import sqlite3
import textwrap
import threading  # <--- TAMBAHAN PENTING: Untuk Thread Safety
from pathlib import Path
from typing import Any, Dict, List, Optional

# --- Impor Pustaka Pihak Ketiga ---
import faiss
import numpy as np
from sentence_transformers import SentenceTransformer

# --- Impor Lokal ---
from ..config import get_settings

# --- Konfigurasi Logging ---
logger = logging.getLogger(__name__)

# --- Variabel Global ---
MODEL_NAME = "all-MiniLM-L6-v2"
embedding_model: Optional[SentenceTransformer] = None
index: Optional[faiss.Index] = None
is_initialized = False

# --- GLOBAL LOCK ---
# Mencegah error jika ada dua request menulis ke DB/FAISS bersamaan
memory_lock = threading.Lock()

# ==============================================================================
#                           FUNGSI BANTU PATH & TEKS
# ==============================================================================

def _get_db_path() -> Path:
    """Mendapatkan path ke file database SQLite dari pengaturan."""
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
#                       INISIALISASI (Lazy & Safe)
# ==============================================================================

def init_memory_system():
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
    Dilindungi oleh Lock agar tidak dimuat dua kali secara bersamaan.
    """
    global embedding_model, index, is_initialized
    
    # Cek cepat tanpa lock
    if is_initialized:
        return

    with memory_lock:
        # Cek lagi di dalam lock (double-check locking pattern)
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
            raise RuntimeError(f"Tidak bisa memuat model '{MODEL_NAME}'. Cek koneksi internet.") from e

        # 2. Muat atau Bangun Ulang Indeks FAISS
        index_path = _get_index_path()
        if index_path.exists():
            try:
                logger.info("Memuat indeks FAISS dari %s...", index_path)
                index = faiss.read_index(str(index_path))
                logger.info("Indeks FAISS berhasil dimuat. Terdapat %d vektor.", index.ntotal)
            except Exception as e:
                logger.error("Gagal memuat file indeks FAISS, mencoba bangun ulang: %s", e)
                _rebuild_index_from_db_unsafe() # Versi unsafe karena sudah di dalam lock
        else:
            logger.warning("File indeks FAISS tidak ditemukan. Membangun ulang dari database...")
            _rebuild_index_from_db_unsafe()
        
        is_initialized = True
        logger.info("LAZY INIT: Inisialisasi sistem memori selesai.")


def _rebuild_index_from_db_unsafe():
    """
    Membangun ulang indeks FAISS dari awal berdasarkan data di SQLite.
    Hanya dipanggil di dalam fungsi yang sudah memegang Lock.
    """
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
        logger.info("Database memori kosong, indeks FAISS baru dibuat.")
        return

    logger.info("Membangun ulang indeks untuk %d memori...", len(rows))
    ids, texts = zip(*rows)
    
    try:
        embeddings = embedding_model.encode(list(texts), convert_to_tensor=False, show_progress_bar=False)
        ids_array = np.array(ids, dtype=np.int64)
        index.add_with_ids(embeddings, ids_array)
        
        logger.info("Rebuild selesai. Menyimpan ke disk...")
        faiss.write_index(index, str(_get_index_path()))
        logger.info("Indeks baru berhasil disimpan.")
    except Exception as e:
        logger.error("Gagal encoding/saving indeks: %s", e)
        # Fallback ke index kosong biar app gak crash
        index = faiss.IndexIDMap(faiss.IndexFlatL2(dimension))


# ==============================================================================
#                           OPERASI CRUD MEMORI
# ==============================================================================

def upsert_memory(memory_type: str, text: str) -> Dict[str, Any]:
    """
    Menyimpan memori ke SQLite dan update Index di RAM.
    Menggunakan Lock untuk thread safety.
    Menyimpan ke disk hanya setiap 10 item baru (Performance Tuning).
    """
    _lazy_init_model_and_index()
    
    # Validasi awal
    if embedding_model is None or index is None:
        raise RuntimeError("Sistem memori gagal diinisialisasi.")

    compacted = _compact_text(text)
    db_path = _get_db_path()
    
    with memory_lock: # <--- LOCK DIMULAI
        try:
            # 1. Operasi Database
            with sqlite3.connect(db_path) as conn:
                cursor = conn.cursor()
                # Insert or Ignore (kalau duplikat, diabaikan)
                cursor.execute("INSERT OR IGNORE INTO memories(type, text) VALUES(?, ?)", (memory_type, compacted))
                conn.commit()
                
                # Ambil data (baik baru dibuat atau yang sudah ada)
                cursor.execute("SELECT id, type, text, created_at FROM memories WHERE type = ? AND text = ?", (memory_type, compacted))
                row = cursor.fetchone()

            if not row:
                raise RuntimeError("Database Error: Gagal mengambil data memori.")

            memory_id, memory_type, stored_text, created_at = row
            
            # 2. Cek apakah ID ini sudah ada di Index?
            # FAISS IndexIDMap tidak punya metode `contains`, jadi kita asumsikan
            # kita tambah saja. Kalau id sama, FAISS biasanya menimpa atau error tergantung tipe.
            # Untuk keamanan, kita remove dulu ID-nya kalau ada (optional, tapi IDMap biasanya butuh unique).
            # Namun, karena SQLite ID auto-increment dan unik, kita bisa langsung add.
            
            # Encode teks ke vektor
            embedding = embedding_model.encode([stored_text], convert_to_tensor=False)
            vector_id = np.array([memory_id], dtype=np.int64)
            
            # Tambahkan ke RAM Index
            # Catatan: add_with_ids di FAISS IDMap aman, tapi tidak otomatis dedup.
            # Karena ID dari SQLite unik, ini aman.
            try:
                # Hapus dulu ID lama dari index jika ada (untuk update/deduplikasi vektor)
                index.remove_ids(vector_id) 
            except:
                pass # Tidak masalah jika ID belum ada
            
            index.add_with_ids(embedding, vector_id)
            
            logger.info(f"Memori ID {memory_id} ditambahkan ke RAM Index. Total: {index.ntotal}")

            # 3. AUTO-SAVE KE DISK (Hanya setiap 10 item baru)
            # Ini mencegah IO Disk Usage yang tinggi.
            if index.ntotal % 10 == 0:
                logger.info("Auto-save: Menyimpan indeks ke disk...")
                faiss.write_index(index, str(_get_index_path()))

            return {
                "id": memory_id, 
                "type": memory_type, 
                "text": stored_text, 
                "created_at": created_at
            }
            
        except Exception as e:
            logger.error("Error di upsert_memory: %s", e)
            raise e


def search_memory(query: str, top_k: int = 5) -> List[Dict[str, Any]]:
    """Mencari memori yang relevan secara semantik."""
    _lazy_init_model_and_index() 

    # Search biasanya aman dilakukan konkruen (read-only di FAISS), 
    # tapi embedding model kadang butuh lock kalau GPU/Shared resource.
    # Untuk CPU biasanya aman tanpa lock, tapi kita pakai lock sebentar untuk akses index.
    
    if embedding_model is None or index is None:
        logger.warning("Sistem belum siap.")
        return []
    
    if index.ntotal == 0:
        return []

    try:
        # Encode query
        query_embedding = embedding_model.encode([query.strip()], convert_to_tensor=False)
        
        k = min(top_k, index.ntotal)
        
        # Search di Index
        distances, ids = index.search(query_embedding, k)
        
        found_ids = [int(i) for i in ids[0] if i != -1]
        if not found_ids:
            return []

        # Ambil detail teks dari SQLite
        db_path = _get_db_path()
        with sqlite3.connect(db_path) as conn:
            conn.row_factory = sqlite3.Row 
            cursor = conn.cursor()
            placeholders = ",".join("?" for _ in found_ids)
            query_sql = f"SELECT id, type, text, created_at FROM memories WHERE id IN ({placeholders})"
            cursor.execute(query_sql, found_ids)
            rows = cursor.fetchall()

        # Urutkan hasil sesuai urutan relevansi FAISS
        results_map = {dict(row)["id"]: dict(row) for row in rows}
        sorted_results = [results_map[fid] for fid in found_ids if fid in results_map]

        return sorted_results
        
    except Exception as e:
        logger.error("Error saat search_memory: %s", e)
        return []


def clear_memory_system() -> bool:
    """Reset total: Hapus DB dan File Index."""
    global index, is_initialized
    
    with memory_lock: # <--- LOCK PENTING SAAT DESTRUCTIVE ACTION
        db_path = _get_db_path()
        if db_path.exists():
            with sqlite3.connect(db_path) as conn:
                conn.execute("DELETE FROM memories")
                conn.commit()
                conn.execute("VACUUM") 
            logger.info("Tabel memories dibersihkan.")

        index_path = _get_index_path()
        if index_path.exists():
            try:
                index_path.unlink()
                logger.info("File indeks FAISS dihapus.")
            except Exception as e:
                logger.error("Gagal menghapus file index: %s", e)
            
        # Reset state
        index = None
        is_initialized = False
        logger.info("Sistem memori di-reset total.")

    return True