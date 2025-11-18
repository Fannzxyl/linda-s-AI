from pydantic import BaseModel, Field
from typing import List, Optional, Literal

# Tipe data untuk peran dalam chat
Role = Literal["user", "model", "assistant", "system"]

class Message(BaseModel):
    """Representasi satu pesan dalam riwayat chat."""
    role: Role
    content: str
    # FIX: image_url dibuat opsional karena ini adalah data dari frontend untuk display
    image_url: Optional[str] = Field(None) 

class ChatRequest(BaseModel):
    """Model data yang diharapkan dari frontend untuk memulai chat."""
    # messages wajib ada (ditandai dengan ...)
    messages: List[Message] = Field(..., description="Riwayat chat.")
    persona: Optional[str] = Field(None, description="Persona yang diminta.")
    # FIX: image_base64 dibuat Optional karena sering dikirim null/undefined dari frontend
    image_base64: Optional[str] = Field(None, description="Gambar Base64.")
    use_memory: bool = Field(True, description="Gunakan sistem memori.")

class MemoryUpsert(BaseModel):
    """Model data untuk menyimpan (upsert) memori baru."""
    type: str = "fact"
    text: str

class MemorySearch(BaseModel):
    """Model data untuk mencari memori."""
    query: str
    top_k: Optional[int] = 3