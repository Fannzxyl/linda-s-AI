import {
  FormEvent,
  KeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { streamChat } from "../lib/sse";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
};

type ChatProps = {
  useMemory: boolean;
  persona: string;
};

const createId = () => {
  const globalCrypto = globalThis.crypto as Crypto & { randomUUID?: () => string };
  if (globalCrypto?.randomUUID) {
    return globalCrypto.randomUUID();
  }
  return Math.random().toString(36).slice(2);
};

const createGreeting = (): ChatMessage => ({
  id: createId(),
  role: "assistant",
  content: "Hai, aku Linda. Lagi perlu dibantu apa?",
});

const Chat = ({ useMemory, persona }: ChatProps) => {
  const [messages, setMessages] = useState<ChatMessage[]>([createGreeting()]);
  const [inputValue, setInputValue] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const streamRef = useRef<{ cancel: () => void } | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const assistantBufferRef = useRef<string>("");
  const firstChunkPlayedRef = useRef(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    return () => {
      streamRef.current?.cancel();
    };
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [inputValue]);

  const ensureAudioContext = useCallback(() => {
    if (typeof window === "undefined" || typeof AudioContext === "undefined") {
      return;
    }
    if (!audioCtxRef.current) {
      audioCtxRef.current = new AudioContext();
    }
    if (audioCtxRef.current.state === "suspended") {
      void audioCtxRef.current.resume();
    }
  }, []);

  const playNotification = useCallback(() => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(880, ctx.currentTime);
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.25);
    oscillator.connect(gain).connect(ctx.destination);
    oscillator.start();
    oscillator.stop(ctx.currentTime + 0.25);
  }, []);

  // PERUBAHAN: Hapus useMemo untuk formattedHistory dan buat history baru di handleSubmit
  // untuk memastikan kita selalu menggunakan history yang paling bersih.
  
  // --- Fungsi untuk mengakhiri stream yang terpotong ---
  const finalizeLastMessage = useCallback(() => {
      setMessages((prev) => {
          const next = [...prev];
          const lastIndex = next.length - 1;
          const last = next[lastIndex];

          if (last && last.role === "assistant" && last.streaming) {
              // Jika pesan terakhir masih dalam status streaming:
              if (last.content.trim() === "") {
                  // Hapus jika kosong (belum ada kata yang muncul)
                  next.pop(); 
              } else {
                  // Set streaming=false jika ada konten yang terpotong
                  last.streaming = false;
                  last.content = last.content.trim();
              }
          }
          return next;
      });
      setIsStreaming(false);
      assistantBufferRef.current = "";
      firstChunkPlayedRef.current = false;
  }, []);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!inputValue.trim() || isStreaming) return;
    ensureAudioContext();

    // 1. **PERBAIKAN KRUSIAL**: Hentikan stream yang lama dan hapus pesan yang terpotong
    streamRef.current?.cancel();
    finalizeLastMessage(); // <-- Panggil fungsi baru ini sebelum request baru

    const userMessageContent = inputValue.trim();
    const userMessage: ChatMessage = {
      id: createId(),
      role: "user",
      content: userMessageContent,
    };
    const assistantMessage: ChatMessage = {
      id: createId(),
      role: "assistant",
      content: "",
      streaming: true,
    };
    
    // PERBAIKAN: Gunakan formattedHistory yang paling baru
    let cleanHistory = messages.map(msg => ({ role: msg.role, content: msg.content }));
    
    // Periksa dan hapus pesan assistant yang sedang streaming dari cleanHistory
    const lastHistoryItem = cleanHistory[cleanHistory.length - 1];
    if (lastHistoryItem && lastHistoryItem.role === 'assistant' && lastHistoryItem.content.trim() === '') {
        // Hapus pesan assistant yang kosong yang mungkin tersisa dari state lama
        cleanHistory.pop();
    }


    setMessages((prev) => [...prev, userMessage, assistantMessage]);
    setInputValue("");
    setIsStreaming(true);
    assistantBufferRef.current = "";
    firstChunkPlayedRef.current = false;

    const personaContent = persona.trim();
    const payload = {
      // PERBAIKAN: Kirim cleanHistory (yang sudah membersihkan pesan terpotong)
      messages: [...cleanHistory, { role: "user" as const, content: userMessageContent }],
      persona: personaContent ? personaContent : undefined,
      use_memory: useMemory,
    };
    
    streamRef.current = streamChat(payload, {
      onToken: (token) => {
        if (!token) return;
        const chunk = token.replace(/\u0000/g, "");
        if (!chunk) return;
        setMessages((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last && last.role === "assistant") {
            const previous = assistantBufferRef.current;
            let addition = chunk;

            if (chunk.startsWith(previous)) {
              addition = chunk.slice(previous.length);
            } else if (previous && previous.endsWith(chunk)) {
              addition = "";
            } else if (chunk.includes(previous) && previous.length > 0) {
              addition = chunk.replace(previous, "");
            } else if (chunk.length < previous.length && previous.includes(chunk)) {
              addition = "";
            }

            if (addition) {
              last.content += addition;
              assistantBufferRef.current = previous + addition;
              if (!firstChunkPlayedRef.current) {
                playNotification();
                firstChunkPlayedRef.current = true;
              }
            } else {
              assistantBufferRef.current = previous;
            }
          }
          return next;
        });
      },
      onDone: () => {
        setMessages((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last) {
            last.streaming = false;
            last.content = last.content.trim();
          }
          return next;
        });
        setIsStreaming(false);
        assistantBufferRef.current = "";
        firstChunkPlayedRef.current = false;
      },
      onError: (message) => {
        setMessages((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last) {
            last.streaming = false;
            last.content = `Maaf, koneksi lagi ngadat: ${message}`;
          }
          return next;
        });
        setIsStreaming(false);
        assistantBufferRef.current = "";
        firstChunkPlayedRef.current = false;
      },
    });
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      // Tambahkan pengecekan ini juga di sini
      if (isStreaming) { 
          // Jika sedang streaming, jangan lakukan apa-apa, atau tambahkan feedback
          console.log("Linda sedang berbicara! Tidak bisa kirim pesan.");
          return; 
      }
      handleSubmit(event as unknown as FormEvent);
    }
  };

  return (
    <div className="chat-window">
      <div className="chat-header">
        <button
          type="button"
          className="ghost-button"
          onClick={() => {
            streamRef.current?.cancel();
            setIsStreaming(false);
            setMessages([createGreeting()]);
            setInputValue("");
            assistantBufferRef.current = "";
            firstChunkPlayedRef.current = false;
          }}
        >
          Clear Chat
        </button>
      </div>
      <div
        ref={scrollRef}
        className="chat-messages"
      >
        {messages.map((message) => {
          const isLiveTyping =
            message.role === "assistant" &&
            message.streaming &&
            !message.content.trim();
          if (isLiveTyping) {
            return null;
          }
          return (
            <div
              key={message.id}
              className={`chat-bubble chat-bubble-${message.role}`}
            >
              {message.content}
            </div>
          );
        })}
        {isStreaming && (
          <div className="typing-row">
            <TypingDots />
          </div>
        )}
      </div>
      <form onSubmit={handleSubmit} className="chat-input-area">
        <textarea
          ref={textareaRef}
          value={inputValue}
          placeholder="Tulis pesanmu di sini..."
          maxLength={4000}
          onChange={(event) => setInputValue(event.target.value)}
          onKeyDown={handleKeyDown}
          rows={3}
          className="chat-textarea"
          // Atribut disabled sudah benar di sini:
          disabled={isStreaming}
        />
        <div className="chat-input-footer">
          <span className="char-counter">{inputValue.length}/4000</span>
          <button
            type="submit"
            disabled={isStreaming || !inputValue.trim()}
            className="primary-button"
            // Atribut disabled sudah benar di sini:
          >
            {isStreaming ? "Menunggu..." : "Kirim"}
          </button>
        </div>
      </form>
    </div>
  );
};

const TypingDots = () => (
  <span className="typing-indicator" aria-live="polite">
    <span />
    <span />
    <span />
  </span>
);

export default Chat;
