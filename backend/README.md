# Backend – Alfan Chatbot

FastAPI service that proxies requests to Gemini, manages lightweight memories with SQLite, and streams chat tokens via Server-Sent Events.

## Prerequisites

- Python 3.10+
- Virtual environment tool of your choice (`venv`, `conda`, etc.)

## Setup

```bash
python -m venv .venv
.venv\Scripts\activate  # Windows
# source .venv/bin/activate on Linux/macOS
pip install -r requirements.txt
```

Copy `.env.example` to `.env` and fill in your `GEMINI_API_KEY` **and** `GEMINI_MODEL` (misalnya `gemini-2.0-flash`). Keep the real key outside version control. The server will try safe suffixes such as `-latest` automatically during connection.

## Development

```bash
uvicorn app.main:app --reload
```

The API defaults to `http://localhost:8000`.

## Chat Endpoint

Example streaming request:

```bash
curl -N -X POST http://localhost:8000/chat ^
  -H "Content-Type: application/json" ^
  -d "{ \"messages\": [{\"role\": \"user\", \"content\": \"Halo\"}], \"use_memory\": true }"
```

## Memory Utilities

- `POST /memory/upsert` – store a fact, preference, or todo.
- `POST /memory/search` – retrieve up to `top_k` related memories.

Run unit tests for the memory module:

```bash
pytest
```

## Configuration

- Tweak Gemini endpoint or retry behaviour via environment variables noted in `.env.example`.
- Logs only surface the host path (without query string) when requests fail, so API keys stay hidden. A successful connection prints one `Gemini connected` line per process.
- Streaming responses are cached per persona + prompt so pertanyaan ulang dijawab instan tanpa memukul API lagi.
- SQLite file path is controlled by `MEMORY_DB_PATH` (optional). The default lives under `backend/memory.db`.
