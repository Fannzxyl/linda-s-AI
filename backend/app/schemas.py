from enum import Enum
from typing import List, Optional
from pydantic import BaseModel, Field, field_validator


class MessageRole(str, Enum):
    system = "system"
    user = "user"
    assistant = "assistant"


class Message(BaseModel):
    role: MessageRole
    content: str = Field(..., min_length=1, max_length=4000)

    @field_validator("content")
    @classmethod
    def strip_content(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("content cannot be empty")
        return cleaned


class ChatRequest(BaseModel):
    messages: List[Message] = Field(..., min_items=1)
    persona: Optional[str] = Field(None, max_length=1200)
    use_memory: bool = Field(default=False)
    
    # UPGRADE MULTIMODAL: Field untuk data gambar Base64
    image_base64: Optional[str] = Field(
        None, 
        description="Data gambar Base64 (dengan atau tanpa prefix MIME type)."
    )


class MemoryUpsert(BaseModel):
    type: str = Field(..., pattern=r"^(preference|fact|todo)$")
    text: str = Field(..., min_length=1, max_length=1000)

    @field_validator("text")
    @classmethod
    def tidy_text(cls, value: str) -> str:
        cleaned = " ".join(value.strip().split())
        if not cleaned:
            raise ValueError("text cannot be empty")
        return cleaned


class MemorySearch(BaseModel):
    query: str = Field(..., min_length=1, max_length=400)
    top_k: int = Field(5, ge=1, le=25)
