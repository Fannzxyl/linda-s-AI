// C:\Alfan\linda-s-AI\frontend\src\App.tsx (FINAL FULLCODE)

import React, { useEffect, useMemo, useRef, useState } from "react";
// Import React.Dispatch dan React.SetStateAction untuk typing yang benar
import type { Dispatch, SetStateAction } from "react"; 
import Avatar, { AvatarState, Emotion } from "./components/Avatar"; 
import Chat, { Msg } from "./components/Chat";

/* ENDPOINT (samakan dengan proxy vite) */
const CHAT_URL = "/api/chat";
const RESET_URL = "/api/reset";
const EMOTION_URL = "/api/emotion";

/* UTIL */
function useLocalStorage<T>(key: string, initial: T) {
  const [val, setVal] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : initial;
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(val));
    } catch {}
  }, [key, val]);
  return [val, setVal] as const;
}

// Helper untuk memetakan nama style ke Emotion yang akan digunakan oleh Avatar
function toPersona(s: string) {
  const v = s.toLowerCase();
  if (v.includes("tsundere")) return "tsundere";
  if (v.includes("formal")) return "formal";
  if (v.includes("santai")) return "santai";
  if (v.includes("netral")) return "netral";
  return "ceria";
}

function autoResize(el: HTMLTextAreaElement) {
  el.style.height = "auto";
  el.style.height = Math.min(el.scrollHeight, 160) + "px";
}

/* APP */
export default function App() {
  // persona + theme
  const [styleName, setStyleName] = useLocalStorage("styleName", "Tsundere");
  const persona = useMemo(() => toPersona(styleName), [styleName]);
  useEffect(() => {
    document.body.setAttribute("data-persona", persona);
  }, [persona]);

  // avatar
  const [avatar, setAvatar] = useState<AvatarState>({
    emotion: "neutral",
    blink: true,
    wink: false,
    headSwaySpeed: 1.0,
    glow: "#a78bfa",
  });

  // chat state
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [typing, setTyping] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([
    {
      id: crypto.randomUUID(),
      role: "assistant",
      content: "Nihaooooo!! Aku linda siap menjadi teman ngobrol mu.",
    },
  ]);

  // --- STATE BARU UNTUK MULTIMODAL ---
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);


  // --- FUNGSI BARU: Konversi File ke Base64 ---
  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
        alert("Hanya file gambar (JPEG, PNG, WEBP) yang didukung.");
        return;
    }
    
    // Batasan ukuran file (misalnya, 5MB)
    if (file.size > 5 * 1024 * 1024) {
        alert("File terlalu besar. Maksimal 5MB.");
        return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
        // reader.result adalah string Base64 (eg: "data:image/jpeg;base64,...")
        setImageBase64(reader.result as string);
        setImagePreviewUrl(URL.createObjectURL(file)); 
    };
    reader.readAsDataURL(file); // Memulai konversi ke Base64
  }

  // autoscroll
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    listRef.current?.scrollTo({
      top: listRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, typing]);

  // kirim pesan
  async function onSend() {
    const text = input.trim();
    // IZINKAN pengiriman jika ada teks ATAU gambar
    if ((!text && !imageBase64) || sending) return; 

    setInput("");
    setSending(true);
    setTyping(true);
    
    // Buat pesan pengguna (teks)
    const userMsg: Msg = { 
        id: crypto.randomUUID(), 
        role: "user", 
        content: text || "(Gambar terkirim.)", 
        image_url: imagePreviewUrl // Tambahkan URL pratinjau untuk tampilan di chat bubble
    };

    // Tambahkan pesan ke riwayat sebelum mengirim
    setMessages((m) => [...m, userMsg]);

    const history = messages
      .filter((x) => x.role !== "system")
      .concat(userMsg)
      // Map untuk membuat payload yang bersih, sesuai schema backend
      .map(({ role, content }) => ({ role, content })); 

    // Coba SSE
    let finalText = "";
    try {
      const res = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
        },
        // PERUBAHAN PENTING: TAMBAH image_base64 di payload
        body: JSON.stringify({ 
            messages: history, 
            persona: persona,
            image_base64: imageBase64 // Meneruskan Base64
        }),
      });

      if (res.ok && res.body) {
        const id = crypto.randomUUID();
        setMessages((m) => [...m, { id, role: "assistant", content: "" }]);

        const reader = res.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let buffer = "";

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const blocks = buffer.split("\n\n");
          buffer = blocks.pop() || "";

          for (const blk of blocks) {
            let eventType = "message";
            const dataLines: string[] = [];
            for (const line of blk.split("\n")) {
              if (!line.trim()) continue;
              if (line.startsWith("event:")) eventType = line.slice(6).trim();
              else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
            }
            const data = dataLines.join("\n");
            if (!data) continue;

            if (eventType === "token") {
              finalText += data;
              setMessages((m) =>
                m.map((msg) =>
                  msg.id === id
                    ? { ...msg, content: (msg.content || "") + data }
                    : msg
                )
              );
            }
          }
        }

        // Setelah streaming selesai:
        setTyping(false);
        setSending(false);
        setImageBase64(null); 
        setImagePreviewUrl(null); 
        if(fileInputRef.current) fileInputRef.current.value = ''; 

        if (finalText.trim()) await updateEmotion(finalText.trim(), persona, setAvatar);
        return;
      }
    } catch {
      // lanjut ke fallback JSON
    }

    // fallback JSON (non-SSE)
    try {
      const res = await fetch(CHAT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // PERUBAHAN PENTING: Tambahkan image_base64 di payload fallback
        body: JSON.stringify({ messages: history, persona: persona, image_base64: imageBase64 }), 
      });
      let reply = "Baik. Ada lagi?";
      if (res.ok) {
        const json = await res.json().catch(() => ({} as any));
        reply =
          (json?.reply as string) ??
          (json?.data?.reply as string) ??
          (json?.output as string) ??
          reply;
      } else {
        reply = "Server sibuk. Coba lagi sebentar.";
      }
      setMessages((m) => [
        ...m,
        { id: crypto.randomUUID(), role: "assistant", content: reply },
      ]);
      if (reply) await updateEmotion(reply, persona, setAvatar);
    } catch {
      setMessages((m) => [
        ...m,
        { id: crypto.randomUUID(), role: "assistant", content: "Koneksi gagal. Coba lagi." },
      ]);
    } finally {
      setTyping(false);
      setSending(false);
      setImageBase64(null); 
      setImagePreviewUrl(null); 
      if(fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  }

  // --- FUNGSI onClear DIPERBAIKI: Mengatasi Error 422 ---
  async function onClear() {
    // 1. Reset tampilan pesan lokal segera
    setMessages([
        { id: crypto.randomUUID(), role: "assistant", content: "Halo! Aku siap bantu. Tulis pesanmu di bawah." },
    ]); 

    // 2. Kirim permintaan reset ke server (backend)
    try {
      // Endpoint /api/reset harus di-POST
      await fetch(RESET_URL, { method: "POST" });
    } catch (e) {
      console.error("Gagal mereset server:", e);
    }
    
    // 3. Clear semua state multimodal
    setImageBase64(null); 
    setImagePreviewUrl(null); 
    if(fileInputRef.current) fileInputRef.current.value = '';

    // 4. Fokuskan input
    setTimeout(() => {
      document
        .querySelector<HTMLTextAreaElement>("textarea.textarea")
        ?.focus();
    }, 0);
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="brand">
          <span className="brand-dot" />
          Linda AI
        </div>
      </header>

      <main className="layout">
        <aside className="sidebar">
          <h3 className="section-title">Avatar</h3>
          <div className="avatar-card">
            <div className="avatar-glow" />
            <div className="avatar-canvas">
              <Avatar state={avatar} typing={typing} />
            </div>
          </div>

          <div className="control">
            <label className="label">Gaya bicara</label>
            <select
              className="select"
              value={styleName}
              onChange={(e) => setStyleName(e.target.value)}
            >
              <option>Tsundere</option>
              <option>Ceria</option>
              <option>Santai</option>
              <option>Formal</option>
              <option>Netral</option>
            </select>
            <button className="pill" onClick={onClear}>
              Clear Chat
            </button>
          </div>
        </aside>

        <section className="chat">
          <div className="chat-header">
            <h3 className="section-title" style={{ fontSize: "1rem" }}>
              Obrolan
            </h3>
          </div>

          <Chat refDiv={listRef} messages={messages} typing={typing} />

          <div className="composer">
            {/* AREA PREVIEW GAMBAR BARU */}
            {imagePreviewUrl && (
                <div className="image-preview-container">
                    <img src={imagePreviewUrl} alt="Preview" className="image-preview" />
                    <button 
                        className="clear-image-btn" 
                        onClick={() => {
                            setImageBase64(null);
                            setImagePreviewUrl(null);
                            if(fileInputRef.current) fileInputRef.current.value = '';
                        }}
                    >
                        &times;
                    </button>
                </div>
            )}
            
            <div className="input">
              {/* INPUT FILE BARU */}
              <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  style={{ display: 'none' }}
                  id="file-upload"
                  ref={fileInputRef}
              />
              <label htmlFor="file-upload" className="upload-label">
                  📸
              </label>
              
              <textarea
                className="textarea"
                placeholder="Tulis pesanmu…"
                value={input}
                rows={1}
                onChange={(e) => {
                  setInput(e.target.value);
                  autoResize(e.currentTarget);
                }}
                onKeyDown={onKeyDown}
              />
              <button
                className="send"
                // Izinkan pengiriman jika ada teks ATAU gambar
                disabled={(!input.trim() && !imageBase64) || sending} 
                onClick={onSend}
              >
                {sending ? "Mengirim…" : "Kirim"}
              </button>
            </div>
            <div className="meta">
              <span>{input.length}/2000</span>
              <span className="pill" style={{ padding: ".18rem .6rem" }}>
                {styleName}
              </span>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

/* panggil /api/emotion */
// PERBAIKAN TYPING: Menggunakan React.Dispatch<React.SetStateAction<...>> untuk setter function
async function updateEmotion(
  text: string,
  persona: string,
  setAvatar: Dispatch<SetStateAction<AvatarState>>
) {
  try {
    const res = await fetch(EMOTION_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, persona }),
    });
    if (!res.ok) throw new Error(String(res.status));
    const j = await res.json();
    // Gunakan setAvatar dengan state baru (tidak menggunakan callback)
    setAvatar({ 
      emotion: (j.emotion as Emotion) ?? "neutral", 
      blink: j.blink ?? true,
      wink: j.wink ?? false,
      headSwaySpeed: Math.min(1.6, Math.max(0.6, j.headSwaySpeed ?? 1.0)),
      glow: j.glow ?? "#a78bfa",
    });
  } catch {
    // Perbaikan typing pada callback
    setAvatar((a: AvatarState) => ({ ...a, wink: false, headSwaySpeed: 1.0 }));
  }
}