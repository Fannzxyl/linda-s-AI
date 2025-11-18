import importlib
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import pytest


@pytest.fixture()
def memory_module(tmp_path, monkeypatch):
    db_path = tmp_path / "memory.db"
    monkeypatch.setenv("MEMORY_DB_PATH", str(db_path))

    from app import config

    config.get_settings.cache_clear()  # type: ignore[attr-defined]
    module = importlib.import_module("app.services.memory")
    importlib.reload(module)
    module.init_memory_system()
    yield module


def test_upsert_memory_inserts_and_updates(memory_module):
    stored = memory_module.upsert_memory("fact", "Pengguna suka kopi hitam tiap pagi jam 7.")
    assert stored["type"] == "fact"
    assert len(stored["text"]) <= 140

    second = memory_module.upsert_memory("fact", "Pengguna suka kopi hitam tiap pagi jam 7.")
    assert stored["id"] == second["id"]


def test_search_returns_recent_matches(memory_module):
    memory_module.upsert_memory("preference", "Suka mendengarkan musik lo-fi saat bekerja.")
    memory_module.upsert_memory("todo", "Todo: kirim laporan mingguan hari Jumat pagi.")

    results = memory_module.search_memory("lo-fi", top_k=5)
    assert results
    assert results[0]["type"] == "preference"
    assert "musik" in results[0]["text"].lower()
