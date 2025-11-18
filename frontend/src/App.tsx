// src/App.tsx (FINAL ONLINE VERSION FIXED - 422 RESOLVED)

import React, { useEffect, useMemo, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import Avatar, { AvatarState, Emotion } from "./components/Avatar";
import Chat, { Msg } from "./components/Chat";
import ErrorMessage from "./components/ErrorMessage";
import SettingsPanel from "./components/SettingsPanel";
import MoodIndicator from "./components/MoodIndicator";
import ChatStats from "./components/ChatStats";
import ApiKeyModal from "./components/ApiKeyModal"; 
import { exportChatAsText, exportChatAsJSON } from "./utils/chatExport";
import { calculateMood, getMoodGreeting } from "./utils/moodSystem";
import { parseError, getLindasErrorResponse } from "./utils/errorHandler";
import { setupKeyboardShortcuts, ShortcutAction } from "./utils/keyboardShortcuts";

/* --- ENDPOINT HUGGING FACE (ONLINE) --- */
const BASE_URL = "https://fanlley-alfan.hf.space";
const CHAT_URL = `${BASE_URL}/chat`;
const RESET_URL = `${BASE_URL}/reset`;
const EMOTION_URL = `${BASE_URL}/emotion`;

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

function toPersona(s: string) {
  const v = s.toLowerCase();
  if (v.includes("yandere")) return "yandere";
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
  const [apiKey, setApiKey] = useLocalStorage<string | null>('geminiApiKey', null);
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);
  const [styleName, setStyleName] = useLocalStorage("styleName", "Tsundere");
  const persona = useMemo(() => toPersona(styleName), [styleName]);
  
  useEffect(() => {
    document.body.setAttribute("data-persona", persona);
  }, [persona]);

  const [avatar, setAvatar] = useState<AvatarState>({
    emotion: "neutral",
    blink: true,
    wink: false,
    headSwaySpeed: 1.0,
    glow: "#a78bfa",
  });

  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [typing, setTyping] = useState(false);
  const [messages, setMessages] = useLocalStorage<Msg[]>("chatHistory", [
    {
      id: crypto.randomUUID(),
      role: "assistant",
      content: "Nihaooooo!! Aku linda siap menjadi teman ngobrol mu. Tapi sebelum itu, masukkan API Key kamu dulu ya!",
    },
  ]);

  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [error, setError] = useState<any>(null);
  const [moodEnabled, setMoodEnabled] = useLocalStorage("moodEnabled", true);
  const [lastInteraction, setLastInteraction] = useLocalStorage("lastInteraction", Date.now());
  const [showSettings, setShowSettings] = useState(false);
  const [showStats, setShowStats] = useState(false);
  
  const mood = useMemo(() => 
    calculateMood(messages, lastInteraction, moodEnabled), 
    [messages, lastInteraction, moodEnabled]
  );

  useEffect(() => {
    if (!apiKey) {
      setIsApiKeyModalOpen(true);
    }
  }, [apiKey]);

  useEffect(() => {
    const handleShortcut = (action: ShortcutAction) => {
      switch (action) {
        case 'focus_input': inputRef.current?.focus(); break;
        case 'clear_chat': onClear(); break;
        case 'export_txt': handleExport('txt'); break;
        case 'export_json': handleExport('json'); break;
        case 'toggle_settings': setShowSettings(prev => !prev); break;
      }
    };
    return setupKeyboardShortcuts(handleShortcut);
  }, [messages, styleName, apiKey]);

  useEffect(() => {
    const hoursSinceLastChat = (Date.now() - lastInteraction) / (1000 * 60 * 60);
    if (hoursSinceLastChat > 6 && moodEnabled && messages.length > 1) {
      const greeting = getMoodGreeting(mood.level, styleName);
      const lastMsg = messages[messages.length - 1];
      if (lastMsg.role !== 'assistant') {
        setMessages(prev => [...prev, { id: crypto.randomUUID(), role: "assistant", content: greeting }]);
      }
    }
  }, []);

  const handleSaveApiKey = (key: string) => {
    setApiKey(key);
    setIsApiKeyModalOpen(false);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const openApiKeyModal = () => setIsApiKeyModalOpen(true);

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { alert("Hanya file gambar."); return; }
    if (file.size > 5 * 1024 * 1024) { alert("File terlalu besar (Max 5MB)."); return; }
    const reader = new FileReader();
    reader.onloadend = () => {
        setImageBase64(reader.result as string);
        setImagePreviewUrl(URL.createObjectURL(file)); 
    };
    reader.readAsDataURL(file);
  }

  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, typing]);

  function handleExport(format: 'txt' | 'json') {
    if (messages.length <= 1) { alert('Belum ada chat!'); return; }
    format === 'txt' ? exportChatAsText(messages, styleName) : exportChatAsJSON(messages, styleName);
  }

  function handleRetry() { setError(null); onSend(); }

  async function onSend() {
    if (!apiKey) { setIsApiKeyModalOpen(true); return; }
    const text = input.trim();
    if ((!text && !imageBase64) || sending) return; 
    setInput(""); setSending(true); setTyping(true); setError(null); setLastInteraction(Date.now());
    const currentImageBase64 = imageBase64;
    const currentImagePreviewUrl = imagePreviewUrl;
    setImageBase64(null); setImagePreviewUrl(null); 
    if(fileInputRef.current) fileInputRef.current.value = ''; 
    
    // 1. BUAT MSG DENGAN ID UNTUK FRONTEND DISPLAY (TS-COMPLIANT)
    const newUserMsgId = crypto.randomUUID();
    const userMsg: Msg = { 
        id: newUserMsgId, 
        role: "user", 
        content: text || "(Gambar)", 
        image_url: currentImagePreviewUrl
    };
    const updatedMessages = [...messages, userMsg]; 
    setMessages(updatedMessages);

    // 2. BUAT HISTORY UNTUK PYDANTIC (HAPUS ID, KIRIM STRUCTURE SAMA)
    const history = updatedMessages
      .filter((x) => x.role !== "system")
      .map((msg) => ({ // Menggunakan destructuring sederhana untuk mendapatkan field yang bersih
          role: msg.role, 
          content: msg.content, 
          image_url: msg.image_url || null // Pastikan null jika kosong
      })); 
    // -------------------------------------------------------------
    
    let finalText = "";
    try {
      const headers = { "Content-Type": "application/json", "Accept": "text/event-stream", "X-Gemini-Api-Key": apiKey };
      const res = await fetch(CHAT_URL, {
        method: "POST", headers, body: JSON.stringify({ messages: history, persona: styleName, image_base64: currentImageBase64 }),
      });

      if (!res.ok) {
        const errorInfo = parseError(null, res);
        if (res.status === 401) { errorInfo.message = "API Key invalid."; setApiKey(null); setIsApiKeyModalOpen(true); }
        const lindaResponse = getLindasErrorResponse(errorInfo, styleName);
        setMessages((m) => [...m, { id: crypto.randomUUID(), role: "assistant", content: lindaResponse }]);
        setError(errorInfo); setTyping(false); setSending(false); return;
      }
      if (res.ok && res.body) {
        const id = crypto.randomUUID();
        // Gunakan ID unik untuk pesan balasan asisten
        setMessages((m) => [...m, { id, role: "assistant", content: "" }]); 
        
        const reader = res.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let buffer = "";
        const assistantMsgId = id; 

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
              setMessages((m) => m.map((msg) => msg.id === assistantMsgId ? { ...msg, content: (msg.content || "") + data } : msg));
            }
          }
        }
        setTyping(false); setSending(false);
        if (finalText.trim()) await updateEmotion(finalText.trim(), persona, setAvatar, apiKey);
        return;
      }
    } catch (err) {
      const errorInfo = parseError(err);
      const lindaResponse = getLindasErrorResponse(errorInfo, styleName);
      setMessages((m) => [...m, { id: crypto.randomUUID(), role: "assistant", content: lindaResponse }]);
      setError(errorInfo); setTyping(false); setSending(false); return;
    }
    setTyping(false); setSending(false);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSend(); }
  }

  async function onClear() {
    if (!confirm('Hapus chat?')) return;
    setMessages([{ id: crypto.randomUUID(), role: "assistant", content: "Halo!" }]); 
    try { await fetch(RESET_URL, { method: "POST" }); } catch (e) {}
    setImageBase64(null); setImagePreviewUrl(null); setError(null); setLastInteraction(Date.now());
  }

  return (
    <div className="app">
      <ApiKeyModal isOpen={!apiKey || isApiKeyModalOpen} onSave={handleSaveApiKey} onClose={() => setIsApiKeyModalOpen(false)} />
      <header className="app-header">
        <div className="brand"><span className="brand-dot" />Linda AI</div>
        <div className="header-actions">
          <button className="icon-btn" onClick={() => setShowStats(!showStats)}>📊</button>
          <button className="icon-btn" onClick={() => handleExport('txt')}>💾</button>
          <button className="icon-btn" onClick={() => setShowSettings(!showSettings)}>⚙️</button>
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
          <MoodIndicator moodLevel={mood.level} enabled={moodEnabled} />
          <div className="control">
            <label className="label">Gaya bicara</label>
            <select className="select" value={styleName} onChange={(e) => setStyleName(e.target.value)}>
              <option>Tsundere</option><option>Yandere</option><option>Ceria</option><option>Santai</option><option>Formal</option><option>Netral</option>
            </select>
            <div className="button-group">
              <button className="pill" onClick={onClear}>🗑️ Clear</button>
              <button className="pill pill-secondary" onClick={() => handleExport('json')}>📥 Export</button>
            </div>
          </div>
          {showSettings && <SettingsPanel moodEnabled={moodEnabled} onMoodToggle={setMoodEnabled} onApiKeyChangeClick={openApiKeyModal} showShortcuts={true} />}
          {showStats && <ChatStats messages={messages} />}
        </aside>
        <section className="chat">
          <div className="chat-header"><h3 className="section-title" style={{ fontSize: "1rem" }}>Obrolan</h3></div>
          {error && <ErrorMessage error={error} onRetry={handleRetry} onDismiss={() => setError(null)} />}
          <Chat refDiv={listRef} messages={messages} typing={typing} />
          <div className="composer">
            {imagePreviewUrl && <div className="image-preview-container"><img src={imagePreviewUrl} className="image-preview" /><button className="clear-image-btn" onClick={() => {setImageBase64(null); setImagePreviewUrl(null);}}>&times;</button></div>}
            <div className="input">
              <input type="file" accept="image/*" onChange={handleFileChange} style={{ display: 'none' }} id="file-upload" ref={fileInputRef} />
              <label htmlFor="file-upload" className="upload-label">📸</label>
              <textarea ref={inputRef} className="textarea" placeholder="Ketik pesan..." value={input} rows={1} onChange={(e) => { setInput(e.target.value); autoResize(e.currentTarget); }} onKeyDown={onKeyDown} />
              <button className="send" disabled={(!input.trim() && !imageBase64) || sending || !apiKey} onClick={onSend}>{sending ? "..." : "Kirim"}</button>
            </div>
            <div className="meta"><span>{input.length}/2000</span><span className="pill" style={{ padding: ".18rem .6rem" }}>{styleName}</span></div>
          </div>
        </section>
      </main>
    </div>
  );
}

async function updateEmotion(text: string, persona: string, setAvatar: Dispatch<SetStateAction<AvatarState>>, apiKey: string | null) {
  if (!apiKey) return; 
  try {
    const res = await fetch(EMOTION_URL, {
      method: "POST", headers: { "Content-Type": "application/json", "X-Gemini-Api-Key": apiKey },
      body: JSON.stringify({ text, persona }),
    });
    if (!res.ok) return;
    const j = await res.json();
    setAvatar({ emotion: (j.emotion as Emotion) ?? "neutral", blink: j.blink ?? true, wink: j.wink ?? false, headSwaySpeed: j.headSwaySpeed ?? 1.0, glow: j.glow ?? "#a78bfa" });
  } catch {}
}