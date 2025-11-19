# backend/app/services/search.py

import logging
from duckduckgo_search import DDGS

logger = logging.getLogger(__name__)

def search_google(query: str, max_results: int = 3) -> str:
    """
    Mencari informasi di internet menggunakan DuckDuckGo.
    Mengembalikan string ringkasan hasil pencarian.
    """
    try:
        logger.info(f"🔍 Sedang browsing: '{query}'...")
        
        # Inisialisasi DuckDuckGo Search
        with DDGS() as ddgs:
            # Cari teks (text search)
            results = list(ddgs.text(query, max_results=max_results))
            
            if not results:
                return ""

            # Format hasilnya biar enak dibaca sama Linda
            formatted_results = []
            for i, res in enumerate(results, 1):
                title = res.get('title', 'No Title')
                body = res.get('body', 'No Content')
                href = res.get('href', '#')
                formatted_results.append(f"Sumber {i} ({title}): {body}")

            # Gabungin jadi satu paragraf konteks
            context = "\n".join(formatted_results)
            return f"FAKTA DARI INTERNET (Gunakan ini untuk menjawab):\n{context}\n"

    except Exception as e:
        logger.error(f"Gagal searching: {e}")
        return ""