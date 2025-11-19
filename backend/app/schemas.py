from enum import Enum
from typing import List, Optional
from pydantic import BaseModel, Field, field_validator

# --- ENUM PERAN (ROLE) ---
class MessageRole(str, Enum):
    system = "system"       # Instruksi rahasia (System Prompt)
    user = "user"           # Kamu
    assistant = "assistant" # Linda

# --- MODEL PESAN TUNGGAL ---
class Message(BaseModel):
    role: MessageRole
    # UPGRADE: max_length dihapus/digedein karena Gemini context-nya besar (1M+ token).
    # Kita set limit longgar aja biar server gak meledak kena spam.
    content: str = Field(..., min_length=1, max_length=100_000)

    @field_validator("content")
    @classmethod
    def strip_content(cls, value: str) -> str:
        """Membersihkan spasi berlebih dan memastikan pesan tidak kosong."""
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Pesan tidak boleh kosong (whitespace only).")
        return cleaned

# --- MODEL REQUEST CHAT (DARI FRONTEND) ---
class ChatRequest(BaseModel):
    messages: List[Message] = Field(..., min_items=1, description="List riwayat chat.")
    persona: Optional[str] = Field("ceria", description="ID Persona (ceria, tsundere, dll).")
    use_memory: bool = Field(default=False, description="Aktifkan memori jangka panjang (RAG).")
    
    # UPGRADE MULTIMODAL: Field khusus buat nerima gambar
    image_base64: Optional[str] = Field(
        None, 
        description="String Base64 gambar. Bisa format raw atau dengan data URI scheme."
    )

# --- MODEL MEMORI (DATABASE) ---
class MemoryUpsert(BaseModel):
    type: str = Field(..., pattern=r"^(preference|fact|todo)$", description="Kategori memori.")
    text: str = Field(..., min_length=1, max_length=2000, description="Isi memori.")

    @field_validator("text")
    @classmethod
    def tidy_text(cls, value: str) -> str:
        cleaned = " ".join(value.strip().split())
        if not cleaned:
            raise ValueError("Teks memori tidak boleh kosong.")
        return cleaned

class MemorySearch(BaseModel):
    query: str = Field(..., min_length=1, max_length=500)
    top_k: int = Field(5, ge=1, le=50, description="Jumlah memori yang diambil.")