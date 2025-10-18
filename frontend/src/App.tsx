import React, { useEffect, useMemo, useRef, useState } from "react";
import Avatar, { AvatarState, Emotion } from "./components/Avatar"; // Import AvatarState dan Emotion
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
      content: "Halo! Aku siap bantu. Tulis pesanmu di bawah.",
    },
  ]);

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
    if (!text || sending) return;

    setInput("");
    setSending(true);
    setTyping(true);

    const userMsg: Msg = { id: crypto.randomUUID(), role: "user", content: text };
    setMessages((m) => [...m, userMsg]);

    const history = messages
      .filter((x) => x.role !== "system")
      .concat(userMsg)
      .map(({ role, content }) => ({ role, content }));

    // coba SSE
    let finalText = "";
    try {
      const res = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
        },
        body: JSON.stringify({ messages: history, style: persona, persona }),
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

        setTyping(false);
        setSending(false);

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
        body: JSON.stringify({ messages: history, style: persona, persona }),
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
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  }

  async function onClear() {
    setMessages([
      { id: crypto.randomUUID(), role: "assistant", content: "Mulai baru." },
    ]);
    try {
      await fetch(RESET_URL, { method: "POST" });
    } catch {}
    try {
      await fetch(CHAT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reset: true, style: persona, persona }),
      });
    } catch {}
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
              {/* PENGGUNAAN KOMPONEN AVATAR BARU */}
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
            <div className="input">
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
                disabled={!input.trim() || sending}
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
async function updateEmotion(
  text: string,
  persona: string,
  setAvatar: (s: AvatarState) => void
) {
  try {
    const res = await fetch(EMOTION_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, persona }),
    });
    if (!res.ok) throw new Error(String(res.status));
    const j = await res.json();
    setAvatar({
      emotion: (j.emotion as Emotion) ?? "neutral", // Pastikan tipe data sesuai Emotion
      blink: j.blink ?? true,
      wink: j.wink ?? false,
      headSwaySpeed: Math.min(1.6, Math.max(0.6, j.headSwaySpeed ?? 1.0)),
      glow: j.glow ?? "#a78bfa",
    });
  } catch {
    setAvatar((a) => ({ ...a, wink: false, headSwaySpeed: 1.0 }));
  }
}

