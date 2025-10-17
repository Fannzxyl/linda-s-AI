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

  const formattedHistory = useMemo(
    () =>
      messages.map((message) => ({
        role: message.role,
        content: message.content,
      })),
    [messages],
  );

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!inputValue.trim() || isStreaming) return;
    ensureAudioContext();

    const userMessage: ChatMessage = {
      id: createId(),
      role: "user",
      content: inputValue.trim(),
    };
    const assistantMessage: ChatMessage = {
      id: createId(),
      role: "assistant",
      content: "",
      streaming: true,
    };

    setMessages((prev) => [...prev, userMessage, assistantMessage]);
    setInputValue("");
    setIsStreaming(true);
    assistantBufferRef.current = "";
    firstChunkPlayedRef.current = false;

    const personaContent = persona.trim();
    const payload = {
      messages: [...formattedHistory, { role: "user" as const, content: userMessage.content }],
      persona: personaContent ? personaContent : undefined,
      use_memory: useMemory,
    };

    streamRef.current?.cancel();
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
            assistantBufferRef.current = "";
          }}
        >
          Clear Chat
        </button>
      </div>
      <div
        ref={scrollRef}
        className="chat-messages"
      >
        {messages.map((message) => (
          <div
            key={message.id}
            className={`chat-bubble chat-bubble-${message.role}`}
          >
            {message.content || (message.streaming ? <TypingDots /> : null)}
          </div>
        ))}
        {isStreaming && <div className="typing-row"><TypingDots /></div>}
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
        />
        <div className="chat-input-footer">
          <span className="char-counter">{inputValue.length}/4000</span>
          <button
            type="submit"
            disabled={isStreaming || !inputValue.trim()}
            className="primary-button"
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
