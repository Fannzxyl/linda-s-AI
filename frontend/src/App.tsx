// src/App.tsx (FIXED: Semua komponen dan utils digabung menjadi satu file)

import React, { useEffect, useMemo, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";

// ==================================================================
//                        TIPE DATA (TYPES)
// ==================================================================

// Dari ./components/Chat
export interface Msg {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  image_url?: string;
}

// Dari ./components/Avatar
export type Emotion = "neutral" | "happy" | "sad" | "angry" | "tsun" | "excited" | "calm";

export interface AvatarState {
  emotion: Emotion;
  blink: boolean;
  wink: boolean;
  headSwaySpeed: number;
  glow: string;
}

// Dari ./utils/keyboardShortcuts
export type ShortcutAction = 
  | 'focus_input'
  | 'clear_chat'
  | 'export_txt'
  | 'export_json'
  | 'toggle_settings';

// Dari ./utils/errorHandler
interface ParsedError {
  status: number | string;
  message: string;
  raw: string;
}

// ==================================================================
//                      FUNGSI UTILITIES
// ==================================================================

// --- Dari ./utils/chatExport ---
function formatChatHistory(messages: Msg[], persona: string): string {
  let text = `Riwayat Obrolan Linda AI (Persona: ${persona})\n`;
  text += `Ekspor pada: ${new Date().toLocaleString()}\n`;
  text += "=========================================\n\n";

  messages.forEach((msg) => {
    if (msg.role === "system") return;
    const prefix = msg.role === "user" ? "Anda" : "Linda";
    text += `[${prefix}]: ${msg.content}\n`;
    if (msg.image_url) {
      text += `(Mengirim gambar)\n`;
    }
    text += "\n";
  });
  return text;
}

export function exportChatAsText(messages: Msg[], persona: string) {
  try {
    const plainText = formatChatHistory(messages.slice(1), persona); // Hapus pesan sistem pertama
    const blob = new Blob([plainText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `linda_chat_${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error("Gagal mengekspor Teks:", err);
    alert("Gagal mengekspor Teks.");
  }
}

export function exportChatAsJSON(messages: Msg[], persona: string) {
  try {
    const exportData = {
      meta: {
        persona: persona,
        exportedAt: new Date().toISOString(),
        totalMessages: messages.length,
      },
      history: messages,
    };
    const jsonString = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `linda_chat_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error("Gagal mengekspor JSON:", err);
    alert("Gagal mengekspor JSON.");
  }
}

// --- Dari ./utils/moodSystem ---
export function calculateMood(messages: Msg[], lastInteractionTime: number, enabled: boolean) {
  if (!enabled) return { level: 50, analysis: "Mood dinonaktifkan." };

  let moodScore = 50; // Basis
  const now = Date.now();
  const hoursSinceLastChat = (now - lastInteractionTime) / (1000 * 60 * 60);

  // 1. Waktu
  if (hoursSinceLastChat > 12) moodScore -= 10; // Kangen
  if (hoursSinceLastChat > 24) moodScore -= 10; // Kangen banget
  if (hoursSinceLastChat < 1) moodScore += 5; // Senang baru ngobrol

  // 2. Konten Pesan
  messages.slice(-5).forEach(msg => {
    if (msg.role === 'user') {
      const content = msg.content.toLowerCase();
      if (content.includes("makasih") || content.includes("terima kasih") || content.includes("sayang")) moodScore += 5;
      if (content.includes("jahat") || content.includes("benci")) moodScore -= 10;
    }
  });
  
  moodScore = Math.max(0, Math.min(100, moodScore)); // Clamp 0-100
  return { level: moodScore, analysis: "OK" };
}

export function getMoodGreeting(moodLevel: number, styleName: string): string {
  const persona = styleName.toLowerCase();
  
  if (persona === 'tsundere') {
    if (moodLevel < 30) return "Kamu ke mana aja? Aku gak nungguin, lho! ...Tapi, ya udah, lanjutin aja obrolannya.";
    return "Lama banget sih! Bukan berarti aku kangen ya! Cepat lanjutin ngobrolnya.";
  }
  if (persona === 'yandere') {
    if (moodLevel < 30) return "Kamu kembali... Aku takut banget kamu gak balik lagi. Jangan pergi lama-lama lagi ya...♡";
    return "Akhirnya kamu kembali buat aku... Aku nungguin, lho. Kangen banget...";
  }
  // Default Ceria / Santai
  if (moodLevel < 30) return "Huuu, aku kangen tau! Lama banget gak ngobrol. Yuk cerita lagi!";
  return "Haii, selamat datang kembali! Kangen deh! Mau lanjut ngobrol apa hari ini?";
}

// --- Dari ./utils/errorHandler ---
export function parseError(err: any, res?: Response): ParsedError {
  if (res) {
    return {
      status: res.status,
      message: res.statusText || "Terjadi error HTTP.",
      raw: `HTTP Status ${res.status}`,
    };
  }
  if (err instanceof Error) {
    return {
      status: "Klien",
      message: err.message || "Koneksi gagal atau request dibatalkan.",
      raw: err.stack || err.name,
    };
  }
  return {
    status: "Unknown",
    message: "Terjadi error yang tidak diketahui.",
    raw: String(err),
  };
}

export function getLindasErrorResponse(errorInfo: ParsedError, styleName: string): string {
  const persona = styleName.toLowerCase();
  const status = errorInfo.status;

  if (status === 401 || status === 403) {
    return "API Key kamu salah atau ditolak! Coba cek lagi kuncinya. Aku gak bisa kerja nih!";
  }
  if (status === 429) {
    return "Waduh, kita kebanyakan nanya! Kena limit rate. Coba istirahat dulu bentar ya.";
  }
  
  if (persona === 'tsundere') {
    return `Hmph! Error tuh (Code: ${status})! Bukan salah aku ya, servernya lagi ngambek! Coba 'Retry' aja!`;
  }
  if (persona === 'yandere') {
    return `...Ada yang salah (Code: ${status}). Servernya jahat, mau misahin kita ya? Coba 'Retry', aku tungguin...`;
  }
  
  return `Aduh, maaf! Ada error nih (Code: ${status}). Coba 'Retry' atau cek koneksi kamu ya!`;
}

// --- Dari ./utils/keyboardShortcuts ---
export function setupKeyboardShortcuts(callback: (action: ShortcutAction) => void) {
  const handler = (e: KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey) {
      switch (e.key) {
        case 'i': // Fokus Input
          e.preventDefault();
          callback('focus_input');
          break;
        case 'k': // Clear Chat
          if (e.shiftKey) {
            e.preventDefault();
            callback('clear_chat');
          }
          break;
        case 's': // Export TXT
          e.preventDefault();
          callback('export_txt');
          break;
        case 'j': // Export JSON
          if (e.shiftKey) {
            e.preventDefault();
            callback('export_json');
          }
          break;
        case ',': // Toggle Settings
          e.preventDefault();
          callback('toggle_settings');
          break;
      }
    }
  };
  window.addEventListener('keydown', handler);
  return () => window.removeEventListener('keydown', handler);
}


// ==================================================================
//                      KOMPONEN INTERNAL
// ==================================================================

// --- Dari ./components/ApiKeyModal.tsx ---
// (Menggunakan kode yang Anda sediakan)
interface ApiKeyModalProps {
  isOpen: boolean;
  onSave: (apiKey: string) => void;
  onClose: () => void;
}

const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ isOpen, onSave, onClose }) => {
  const [apiKey, setApiKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSecurityInfo, setShowSecurityInfo] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setError(null);
      setLoading(false);
      setShowSecurityInfo(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = async () => {
    const trimmedApiKey = apiKey.trim();
    if (!trimmedApiKey) {
      setError("API Key tidak boleh kosong.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Validasi ke Backend Hugging Face
      const response = await fetch('https://fanlley-alfan.hf.space/api/validate-api-key', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Gemini-Api-Key': trimmedApiKey 
        },
        body: JSON.stringify({}), 
      });

      if (response.ok) {
        const result = await response.json();
        if (result.valid) {
          onSave(trimmedApiKey);
        } else {
          setError("API Key tidak valid.");
        }
      } else {
        // Fallback error handling
        try {
           const errData = await response.json();
           setError(errData.detail || "Gagal validasi.");
        } catch {
           setError(`Gagal validasi (Status: ${response.status})`);
        }
      }
    } catch (err) {
      console.error("Error validating API key:", err);
      setError("Gagal koneksi ke Server. Coba lagi nanti.");
    } finally {
      setLoading(false);
    }
  };

  // --- STYLING MODERN & PROFESIONAL ---
  const styles: { [key: string]: React.CSSProperties } = {
    overlay: {
      position: 'fixed' as 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.85)', 
      backdropFilter: 'blur(10px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', 
      zIndex: 9999, fontFamily: "'Inter', sans-serif",
    },
    modal: {
      backgroundColor: '#0f172a', 
      border: '1px solid #334155', 
      borderRadius: '20px',
      width: '90%', maxWidth: '450px',
      boxShadow: '0 25px 50px -12px rgba(124, 58, 237, 0.25)', // Glow ungu tipis
      overflow: 'hidden',
      position: 'relative' as 'relative',
      animation: 'fadeIn 0.3s ease-out',
    },
    header: {
      padding: '24px 24px 10px 24px',
      textAlign: 'center' as 'center',
    },
    iconWrapper: {
      width: '50px', height: '50px', margin: '0 auto 15px auto',
      backgroundColor: 'rgba(124, 58, 237, 0.1)',
      borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#a78bfa'
    },
    title: { margin: 0, fontSize: '1.4rem', fontWeight: '700', color: '#f8fafc' },
    subtitle: { margin: '8px 0 0 0', fontSize: '0.9rem', color: '#94a3b8' },
    
    body: { padding: '0 24px 24px 24px' },
    
    // Security Badge Button
    securityBadge: {
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
      fontSize: '0.75rem', color: '#64748b', cursor: 'pointer',
      margin: '15px 0', padding: '8px', borderRadius: '8px',
      backgroundColor: showSecurityInfo ? 'rgba(51, 65, 85, 0.5)' : 'transparent',
      transition: 'all 0.2s',
      border: '1px dashed #334155'
    },
    securityContent: {
      fontSize: '0.8rem', color: '#cbd5e1', backgroundColor: '#1e293b',
      padding: '12px', borderRadius: '8px', marginBottom: '15px',
      lineHeight: '1.5', borderLeft: '3px solid #10b981'
    },

    inputLabel: { display: 'block', fontSize: '0.8rem', fontWeight: '600', color: '#cbd5e1', marginBottom: '6px', marginLeft: '2px' },
    input: {
      width: '100%', backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '10px',
      padding: '14px', color: 'white', outline: 'none', fontSize: '0.95rem',
      fontFamily: 'monospace', letterSpacing: '0.5px',
      transition: 'border-color 0.2s',
      boxSizing: 'border-box' as 'border-box',
    },
    errorBox: {
      marginTop: '12px', padding: '10px', backgroundColor: 'rgba(239, 68, 68, 0.15)',
      border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '8px', 
      color: '#fca5a5', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px'
    },
    
    footer: { 
      padding: '20px 24px', backgroundColor: '#020617', borderTop: '1px solid #1e293b', 
      display: 'flex', gap: '12px' 
    },
    btnCancel: {
      flex: 1, padding: '12px', backgroundColor: 'transparent', 
      border: '1px solid #334155', borderRadius: '10px', 
      color: '#94a3b8', cursor: 'pointer', fontWeight: '600', fontSize: '0.9rem',
      transition: 'all 0.2s'
    },
    btnSave: {
      flex: 2, padding: '12px', 
      background: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)', // Gradient Violet
      border: 'none', borderRadius: '10px', 
      color: 'white', cursor: loading ? 'not-allowed' : 'pointer', 
      fontWeight: '600', fontSize: '0.9rem',
      boxShadow: '0 4px 12px rgba(124, 58, 237, 0.4)',
      opacity: loading ? 0.7 : 1,
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
    },
    link: { color: '#a78bfa', textDecoration: 'none' }
  };

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        
        {/* Header Modern dengan Ikon */}
        <div style={styles.header}>
          <div style={styles.iconWrapper}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>
          </div>
          <h2 style={styles.title}>Setup Koneksi</h2>
          <p style={styles.subtitle}>Hubungkan Linda dengan Otak AI Google</p>
        </div>

        <div style={styles.body}>
          
          {/* Tombol Toggle Keamanan */}
          <div 
            style={styles.securityBadge} 
            onClick={() => setShowSecurityInfo(!showSecurityInfo)}
            title="Klik untuk info keamanan"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
            <span>Apakah ini aman? <u style={{textDecorationStyle: 'dotted'}}>Baca penjelasannya</u></span>
          </div>

          {/* Penjelasan Keamanan (Expandable) */}
          {showSecurityInfo && (
            <div style={styles.securityContent}>
              <strong>🔒 100% Aman & Privat</strong><br/>
              <span style={{opacity: 0.8}}>
                1. API Key Anda disimpan di <b>Browser Anda</b> (Local Storage).<br/>
                2. Server kami tidak menyimpan Key Anda di database.<br/>
                3. Koneksi terenkripsi langsung ke Google.<br/>
                4. Anda memegang kendali penuh atas akun Anda.
              </span>
            </div>
          )}

          <div style={{marginTop: '10px'}}>
            <label style={styles.inputLabel}>Google Gemini API Key</label>
            <input 
              type="password" 
              value={apiKey} 
              onChange={(e) => { setApiKey(e.target.value); setError(null); }} 
              placeholder="AIzaSy..." 
              style={styles.input} 
            />
          </div>

          {error && (
            <div style={styles.errorBox}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
              {error}
            </div>
          )}

          <div style={{ marginTop: '12px', textAlign: 'center', fontSize: '0.75rem', color: '#64748b' }}>
             Belum punya key? <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" style={styles.link}>Ambil gratis di sini (Google AI Studio)</a>
          </div>
        </div>

        <div style={styles.footer}>
          <button onClick={onClose} style={styles.btnCancel}>Nanti Saja</button>
          <button onClick={handleSave} disabled={loading} style={styles.btnSave}>
            {loading ? (
              <>Processing...</>
            ) : (
              <>Simpan & Mulai <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg></>
            )}
          </button>
        </div>

      </div>
    </div>
  );
};

// --- Dari ./components/Avatar.tsx ---
// Ini adalah implementasi placeholder sederhana.
const Avatar: React.FC<{ state: AvatarState; typing: boolean }> = ({ state, typing }) => {
  const emotionEmoji = {
    neutral: "😐",
    happy: "😄",
    sad: "😢",
    angry: "😠",
    tsun: "😒",
    excited: "🤩",
    calm: "😌",
  };
  
  return (
    <div style={{
      width: '100%', 
      height: '150px', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      fontSize: '5rem',
      filter: typing ? 'grayscale(0.5) opacity(0.8)' : 'none',
      transition: 'all 0.3s'
    }}>
      {emotionEmoji[state.emotion] || "😐"}
    </div>
  );
};

// --- Dari ./components/Chat.tsx ---
const Chat = React.forwardRef<HTMLDivElement, { messages: Msg[]; typing: boolean }>(
  ({ messages, typing }, ref) => {
    return (
      <div className="chat-messages" ref={ref}>
        {messages.map((msg) => (
          <div key={msg.id} className={`message ${msg.role}`}>
            <div className="message-content">
              {msg.content}
              {msg.image_url && <img src={msg.image_url} alt="kiriman" className="message-image" />}
            </div>
          </div>
        ))}
        {typing && (
          <div className="message assistant">
            <div className="message-content typing-indicator">
              <span></span><span></span><span></span>
            </div>
          </div>
        )}
      </div>
    );
  }
);

// --- Dari ./components/ErrorMessage.tsx ---
const ErrorMessage: React.FC<{ error: ParsedError; onRetry: () => void; onDismiss: () => void; }> = ({ error, onRetry, onDismiss }) => {
  return (
    <div className="error-message">
      <div className="error-text">
        <strong>Error ({error.status}):</strong> {error.message}
      </div>
      <div className="error-actions">
        <button onClick={onRetry} className="pill">Retry</button>
        <button onClick={onDismiss} className="icon-btn">&times;</button>
      </div>
    </div>
  );
};

// --- Dari ./components/SettingsPanel.tsx ---
const SettingsPanel: React.FC<{
  moodEnabled: boolean;
  onMoodToggle: (enabled: boolean) => void;
  onApiKeyChangeClick: () => void;
  showShortcuts: boolean;
}> = ({ moodEnabled, onMoodToggle, onApiKeyChangeClick, showShortcuts }) => {
  return (
    <div className="settings-panel">
      <h4 className="section-title">Settings</h4>
      <div className="setting-item">
        <label htmlFor="mood-toggle">Mood System</label>
        <input 
          id="mood-toggle" 
          type="checkbox" 
          checked={moodEnabled} 
          onChange={(e) => onMoodToggle(e.target.checked)} 
        />
      </div>
      <button className="pill" onClick={onApiKeyChangeClick} style={{width: '100%', marginTop: '10px'}}>
        Ubah API Key
      </button>
      {showShortcuts && (
        <div className="shortcuts">
          <h4>Shortcuts</h4>
          <ul>
            <li><kbd>Ctrl</kbd> + <kbd>I</kbd> : Fokus Input</li>
            <li><kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>K</kbd> : Hapus Chat</li>
            <li><kbd>Ctrl</kbd> + <kbd>S</kbd> : Export .txt</li>
          </ul>
        </div>
      )}
    </div>
  );
};

// --- Dari ./components/MoodIndicator.tsx ---
const MoodIndicator: React.FC<{ moodLevel: number; enabled: boolean }> = ({ moodLevel, enabled }) => {
  if (!enabled) return null;
  return (
    <div className="mood-indicator">
      <label>Mood Linda</label>
      <div className="mood-bar-container">
        <div className="mood-bar" style={{ width: `${moodLevel}%` }} />
      </div>
    </div>
  );
};

// --- Dari ./components/ChatStats.tsx ---
const ChatStats: React.FC<{ messages: Msg[] }> = ({ messages }) => {
  const userMessages = messages.filter(m => m.role === 'user').length;
  const lindaMessages = messages.filter(m => m.role === 'assistant').length;
  const totalMessages = userMessages + lindaMessages;

  return (
    <div className="chat-stats">
      <h4 className="section-title">Statistik</h4>
      <div className="stat-item">
        <span>Total Pesan</span>
        <strong>{totalMessages}</strong>
      </div>
      <div className="stat-item">
        <span>Pesan Anda</span>
        <strong>{userMessages}</strong>
      </div>
      <div className="stat-item">
        <span>Pesan Linda</span>
        <strong>{lindaMessages}</strong>
      </div>
    </div>
  );
};

// ==================================================================
//                      ENDPOINT (TETAP SAMA)
// ==================================================================
/* --- ENDPOINT HUGGING FACE (ONLINE) --- */
const BASE_URL = "https://fanlley-alfan.hf.space";
const CHAT_URL = `${BASE_URL}/chat`;
const RESET_URL = `${BASE_URL}/reset`;
const EMOTION_URL = `${BASE_URL}/emotion`;

// ==================================================================
//                      UTILITAS LOKAL (TETAP SAMA)
// ==================================================================
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

// ==================================================================
//                        KOMPONEN APP UTAMA
// ==================================================================
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
  const [error, setError] = useState<ParsedError | null>(null); // Type diperketat
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
    // setupKeyboardShortcuts sudah didefinisikan di atas
    return setupKeyboardShortcuts(handleShortcut);
  }, [messages, styleName, apiKey]); // dependensi onClear dan handleExport dihapus karena stabil

  useEffect(() => {
    const hoursSinceLastChat = (Date.now() - lastInteraction) / (1000 * 60 * 60);
    if (hoursSinceLastChat > 6 && moodEnabled && messages.length > 1) {
      // getMoodGreeting sudah didefinisikan di atas
      const greeting = getMoodGreeting(mood.level, styleName);
      const lastMsg = messages[messages.length - 1];
      if (lastMsg.role !== 'assistant') {
        setMessages(prev => [...prev, { id: crypto.randomUUID(), role: "assistant", content: greeting }]);
      }
    }
  }, []); // dependensi dikosongkan agar hanya berjalan sekali saat load

  const handleSaveApiKey = (key: string) => {
    setApiKey(key);
    setIsApiKeyModalOpen(false);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const openApiKeyModal = () => setIsApiKeyModalOpen(true);

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { 
      // Menggunakan alert kustom (atau hapus jika tidak ada)
      console.warn("Hanya file gambar."); 
      return; 
    }
    if (file.size > 5 * 1024 * 1024) { 
      console.warn("File terlalu besar (Max 5MB).");
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
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, typing]);

  function handleExport(format: 'txt' | 'json') {
    if (messages.length <= 1) { console.warn('Belum ada chat!'); return; }
    // Fungsi export sudah didefinisikan di atas
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
    
    const newUserMsgId = crypto.randomUUID();
    // ==================================================================
    //                           PERBAIKAN 1 DI SINI
    // ==================================================================
    const userMsg: Msg = { 
        id: newUserMsgId,
        role: "user", 
        content: text || "(Gambar)", 
        image_url: currentImagePreviewUrl || undefined // Mengubah null menjadi undefined
    };
    const updatedMessages = [...messages, userMsg]; 
    setMessages(updatedMessages);

    const history = updatedMessages
      .filter((x) => x.role !== "system")
      .map(({ role, content, image_url }) => ({ 
          role, 
          content, 
          image_url: image_url || null 
      }));
    
    let finalText = "";
    try {
      const headers = { "Content-Type": "application/json", "Accept": "text/event-stream", "X-Gemini-Api-Key": apiKey };
      
      const bodyPayload = { 
          messages: history, 
          persona: styleName, 
          image_base_64: currentImageBase64, // Nama field ini harus cocok dengan schemas.py
          use_memory: moodEnabled 
      };

      // Periksa schemas.py: jika fieldnya 'image_base64' (tanpa _64)
      // maka 'image_base_64' di atas harus diubah menjadi 'image_base64'
      // Berdasarkan file schemas.py Anda, namanya adalah 'image_base64'
      const finalBody = {
          messages: history, 
          persona: styleName, 
          image_base64: currentImageBase64, // Menggunakan 'image_base64'
          use_memory: moodEnabled 
      };


      const res = await fetch(CHAT_URL, {
        method: "POST", 
        headers: headers, 
        body: JSON.stringify(finalBody), // Menggunakan finalBody
      });

      if (!res.ok) {
        // parseError dan getLindasErrorResponse sudah didefinisikan di atas
        const errorInfo = parseError(null, res);
        if (res.status === 401) { errorInfo.message = "API Key invalid."; setApiKey(null); setIsApiKeyModalOpen(true); }
        const lindaResponse = getLindasErrorResponse(errorInfo, styleName);
        setMessages((m) => [...m, { id: crypto.randomUUID(), role: "assistant", content: lindaResponse }]);
        setError(errorInfo); setTyping(false); setSending(false); return;
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
              setMessages((m) => m.map((msg) => msg.id === id ? { ...msg, content: (msg.content || "") + data } : msg));
            }
          }
        }
        setTyping(false); setSending(false);
        if (finalText.trim()) await updateEmotion(finalText.trim(), persona, setAvatar, apiKey);
        return;
      }
    } catch (err) {
      // parseError dan getLindasErrorResponse sudah didefinisikan di atas
      const errorInfo = parseError(err, undefined);
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
    // Menghilangkan confirm()
    // if (!confirm('Hapus chat?')) return;
    setMessages([{ id: crypto.randomUUID(), role: "assistant", content: "Halo!" }]); 
    try { await fetch(RESET_URL, { method: "POST" }); } catch (e) {}
    setImageBase64(null); setImagePreviewUrl(null); setError(null); setLastInteraction(Date.now());
  }

  return (
    <div className="app">
      {/* ApiKeyModal sudah didefinisikan di atas */}
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
              {/* Avatar sudah didefinisikan di atas */}
              <Avatar state={avatar} typing={typing} />
            </div>
          </div>
          {/* MoodIndicator sudah didefinisikan di atas */}
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
          {/* SettingsPanel sudah didefinisikan di atas */}
          {showSettings && <SettingsPanel moodEnabled={moodEnabled} onMoodToggle={setMoodEnabled} onApiKeyChangeClick={openApiKeyModal} showShortcuts={true} />}
          {/* ChatStats sudah didefinisikan di atas */}
          {showStats && <ChatStats messages={messages} />}
        </aside>
        <section className="chat">
          <div className="chat-header"><h3 className="section-title" style={{ fontSize: "1rem" }}>Obrolan</h3></div>
          {/* ErrorMessage sudah didefinisikan di atas */}
          {error && <ErrorMessage error={error} onRetry={handleRetry} onDismiss={() => setError(null)} />}
          
          {/* ================================================================== */}
          {/* PERBAIKAN 2 DI SINI                      */}
          {/* ================================================================== */}
          <Chat ref={listRef} messages={messages} typing={typing} />
          
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

// ==================================================================
//               FUNGSI UPDATE EMOSI (TETAP SAMA)
// ==================================================================
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