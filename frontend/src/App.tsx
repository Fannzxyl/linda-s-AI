// C:\Alfan\linda-s-AI\frontend\src\App.tsx (ENHANCED VERSION WITH API KEY MODAL)

import React, { useEffect, useMemo, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import Avatar, { AvatarState, Emotion } from "./components/Avatar";
import Chat, { Msg } from "./components/Chat";
import ErrorMessage from "./components/ErrorMessage";
import SettingsPanel from "./components/SettingsPanel";
import MoodIndicator from "./components/MoodIndicator";
import ChatStats from "./components/ChatStats";
import ApiKeyModal from "./components/ApiKeyModal"; // <-- 1. IMPORT MODAL
import { exportChatAsText, exportChatAsJSON } from "./utils/chatExport";
import { calculateMood, getMoodGreeting } from "./utils/moodSystem";
import { parseError, getLindasErrorResponse } from "./utils/errorHandler";
import { setupKeyboardShortcuts, ShortcutAction } from "./utils/keyboardShortcuts";

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
  // --- State Management for API Key ---
  const [apiKey, setApiKey] = useLocalStorage<string | null>('geminiApiKey', null);
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);

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

  // Check for API key on startup
  useEffect(() => {
    if (!apiKey) {
      setIsApiKeyModalOpen(true);
    }
  }, [apiKey]);

  useEffect(() => {
    const handleShortcut = (action: ShortcutAction) => {
      switch (action) {
        case 'focus_input':
          inputRef.current?.focus();
          break;
        case 'clear_chat':
          onClear();
          break;
        case 'export_txt':
          handleExport('txt');
          break;
        case 'export_json':
          handleExport('json');
          break;
        case 'toggle_settings':
          setShowSettings(prev => !prev);
          break;
      }
    };

    return setupKeyboardShortcuts(handleShortcut);
  }, [messages, styleName, apiKey]); // Added apiKey to dependencies

  useEffect(() => {
    const hoursSinceLastChat = (Date.now() - lastInteraction) / (1000 * 60 * 60);
    
    if (hoursSinceLastChat > 6 && moodEnabled && messages.length > 1) {
      const greeting = getMoodGreeting(mood.level, styleName);
      const lastMsg = messages[messages.length - 1];
      
      if (lastMsg.role !== 'assistant') {
        setMessages(prev => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content: greeting
          }
        ]);
      }
    }
  }, []);

  const handleSaveApiKey = (key: string) => {
    setApiKey(key);
    setIsApiKeyModalOpen(false);
    // Focus input after saving key
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const openApiKeyModal = () => {
    setIsApiKeyModalOpen(true);
  };

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
        alert("Hanya file gambar (JPEG, PNG, WEBP) yang didukung.");
        return;
    }
    
    if (file.size > 5 * 1024 * 1024) {
        alert("File terlalu besar. Maksimal 5MB.");
        return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
        setImageBase64(reader.result as string);
        setImagePreviewUrl(URL.createObjectURL(file)); 
    };
    reader.readAsDataURL(file);
  }

  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    listRef.current?.scrollTo({
      top: listRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, typing]);

  function handleExport(format: 'txt' | 'json') {
    if (messages.length <= 1) {
      alert('Belum ada chat yang bisa di-export!');
      return;
    }
    
    if (format === 'txt') {
      exportChatAsText(messages, styleName);
    } else {
      exportChatAsJSON(messages, styleName);
    }
  }

  function handleRetry() {
    setError(null);
    onSend();
  }

  async function onSend() {
    if (!apiKey) {
      setIsApiKeyModalOpen(true);
      return;
    }
    const text = input.trim();
    if ((!text && !imageBase64) || sending) return; 

    setInput("");
    setSending(true);
    setTyping(true);
    setError(null);

    setLastInteraction(Date.now());

    const currentImageBase64 = imageBase64;
    const currentImagePreviewUrl = imagePreviewUrl;

    setImageBase64(null); 
    setImagePreviewUrl(null); 
    if(fileInputRef.current) fileInputRef.current.value = ''; 
    
    const userMsg: Msg = { 
        id: crypto.randomUUID(), 
        role: "user", 
        content: text || "(Gambar terkirim.)", 
        image_url: currentImagePreviewUrl
    };

    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);

    const history = updatedMessages
      .filter((x) => x.role !== "system")
      .map(({ role, content }) => ({ role, content })); 

    let finalText = "";
    try {
      const headers = {
        "Content-Type": "application/json",
        "Accept": "text/event-stream",
        "X-Gemini-Api-Key": apiKey,
      };

      const res = await fetch(CHAT_URL, {
        method: "POST",
        headers,
        body: JSON.stringify({ 
            messages: history, 
            persona: styleName,
            image_base64: currentImageBase64
        }),
      });

      if (!res.ok) {
        const errorInfo = parseError(null, res);
        // Special handling for 401 Unauthorized (likely bad API key)
        if (res.status === 401) {
          errorInfo.message = "API Key tidak valid atau ditolak. Silakan periksa kembali.";
          setApiKey(null); // Clear the bad key
          setIsApiKeyModalOpen(true); // Re-open the modal
        }
        const lindaResponse = getLindasErrorResponse(errorInfo, styleName);
        
        setMessages((m) => [
          ...m,
          { id: crypto.randomUUID(), role: "assistant", content: lindaResponse },
        ]);
        setError(errorInfo);
        setTyping(false);
        setSending(false);
        return;
      }

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

        setTyping(false);
        setSending(false);
        if (finalText.trim()) await updateEmotion(finalText.trim(), persona, setAvatar, apiKey);
        return;
      }
    } catch (err) {
      const errorInfo = parseError(err);
      const lindaResponse = getLindasErrorResponse(errorInfo, styleName);
      
      setMessages((m) => [
        ...m,
        { id: crypto.randomUUID(), role: "assistant", content: lindaResponse },
      ]);
      setError(errorInfo);
      setTyping(false);
      setSending(false);
      return;
    }

    // Fallback JSON (non-SSE)
    try {
      const headers = {
        "Content-Type": "application/json",
        "X-Gemini-Api-Key": apiKey,
      };
      const res = await fetch(CHAT_URL, {
        method: "POST",
        headers,
        body: JSON.stringify({ messages: history, persona: styleName, image_base64: currentImageBase64 }), 
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
      if (reply) await updateEmotion(reply, persona, setAvatar, apiKey);
    } catch (err) {
      const errorInfo = parseError(err);
      const lindaResponse = getLindasErrorResponse(errorInfo, styleName);
      
      setMessages((m) => [
        ...m,
        { id: crypto.randomUUID(), role: "assistant", content: lindaResponse },
      ]);
      setError(errorInfo);
    } finally {
      setTyping(false);
      setSending(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  }

  async function onClear() {
    if (!confirm('Yakin mau hapus semua chat? Histori akan hilang!')) {
      return;
    }

    setMessages([
        { id: crypto.randomUUID(), role: "assistant", content: "Halo! Aku siap bantu. Tulis pesanmu di bawah." },
    ]); 

    try {
      await fetch(RESET_URL, { method: "POST" });
    } catch (e) {
      console.error("Gagal mereset server:", e);
    }
    
    setImageBase64(null); 
    setImagePreviewUrl(null); 
    if(fileInputRef.current) fileInputRef.current.value = '';
    setError(null);
    setLastInteraction(Date.now());

    setTimeout(() => {
      inputRef.current?.focus();
    }, 0);
  }

  return (
    <div className="app">
      <ApiKeyModal 
        isOpen={!apiKey || isApiKeyModalOpen} 
        onSave={handleSaveApiKey} 
        onClose={() => setIsApiKeyModalOpen(false)} 
      />

      <header className="app-header">
        <div className="brand">
          <span className="brand-dot" />
          Linda AI
        </div>
        <div className="header-actions">
          <button 
            className="icon-btn" 
            onClick={() => setShowStats(!showStats)}
            title="Statistik"
          >
            📊
          </button>
          <button 
            className="icon-btn" 
            onClick={() => handleExport('txt')}
            title="Export Chat (Ctrl+E)"
          >
            💾
          </button>
          <button 
            className="icon-btn" 
            onClick={() => setShowSettings(!showSettings)}
            title="Settings (Ctrl+,)"
          >
            ⚙️
          </button>
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
            <select
              className="select"
              value={styleName}
              onChange={(e) => setStyleName(e.target.value)}
            >
              <option>Tsundere</option>
              <option>Yandere</option>
              <option>Ceria</option>
              <option>Santai</option>
              <option>Formal</option>
              <option>Netral</option>
            </select>
            
            <div className="button-group">
              <button className="pill" onClick={onClear}>
                🗑️ Clear Chat
              </button>
              <button 
                className="pill pill-secondary" 
                onClick={() => handleExport('json')}
                title="Export as JSON"
              >
                📥 Export
              </button>
            </div>
          </div>

          {showSettings && (
            <SettingsPanel 
              moodEnabled={moodEnabled}
              onMoodToggle={setMoodEnabled}
              onApiKeyChangeClick={openApiKeyModal}
              showShortcuts={true}
            />
          )}

          {showStats && <ChatStats messages={messages} />}
        </aside>

        <section className="chat">
          <div className="chat-header">
            <h3 className="section-title" style={{ fontSize: "1rem" }}>
              Obrolan
            </h3>
          </div>

          {error && (
            <ErrorMessage 
              error={error}
              onRetry={handleRetry}
              onDismiss={() => setError(null)}
            />
          )}

          <Chat refDiv={listRef} messages={messages} typing={typing} />

          <div className="composer">
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
                ref={inputRef}
                className="textarea"
                placeholder="Tulis pesanmu… (Shift+Enter untuk baris baru)"
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
                disabled={(!input.trim() && !imageBase64) || sending || !apiKey}
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

async function updateEmotion(
  text: string,
  persona: string,
  setAvatar: Dispatch<SetStateAction<AvatarState>>,
  apiKey: string | null // <-- Pass API key
) {
  if (!apiKey) return; // Don't run if no key
  try {
    const res = await fetch(EMOTION_URL, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "X-Gemini-Api-Key": apiKey, // <-- Add API key to header
      },
      body: JSON.stringify({ text, persona }),
    });
    if (!res.ok) throw new Error(String(res.status));
    const j = await res.json();
    setAvatar({ 
      emotion: (j.emotion as Emotion) ?? "neutral", 
      blink: j.blink ?? true,
      wink: j.wink ?? false,
      headSwaySpeed: Math.min(1.6, Math.max(0.6, j.headSwaySpeed ?? 1.0)),
      glow: j.glow ?? "#a78bfa",
    });
  } catch {
    setAvatar((a: AvatarState) => ({ ...a, wink: false, headSwaySpeed: 1.0 }));
  }
}