import React, { useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export type Msg = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  image_url?: string | null;
};

type Props = {
  refDiv?: React.RefObject<HTMLDivElement>;
  messages: Msg[];
  typing: boolean;
};

export default function Chat({ refDiv, messages, typing }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typing]);

  return (
    <div ref={refDiv} className="messages">
      {messages.length === 0 && (
        <div style={{ textAlign: 'center', marginTop: '40px', opacity: 0.5, fontSize: '0.9rem' }}>
          <p>Belum ada chat nih. Sapa Linda dong! 👋</p>
        </div>
      )}

      {messages.map((m) => {
        if (m.role === "system") return null;

        // FIX: Sembunyikan bubble kalau teks kosong (biar gak ada kotak abu-abu kecil)
        if (!m.content.trim() && !m.image_url) return null;

        return (
          <div key={m.id} className={`msg ${m.role}`}>
            <div className="bubble">
              {m.image_url && (
                <div className="msg-image-wrapper">
                  <img 
                    src={m.image_url} 
                    alt="User Upload" 
                    className="uploaded-image" 
                    loading="lazy"
                    onClick={() => window.open(m.image_url!, '_blank')}
                    title="Klik untuk memperbesar"
                  />
                </div>
              )}

              <div className="markdown-content">
                <ReactMarkdown 
                  remarkPlugins={[remarkGfm]}
                  components={{
                    a: ({node, ...props}) => (
                      <a 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        style={{color: '#6ea8ff', textDecoration: 'underline', cursor: 'pointer'}} 
                        {...props} 
                      />
                    ),
                    code({node, inline, className, children, ...props}: any) {
                      return !inline ? (
                        <div style={{overflowX: 'auto', margin: '8px 0'}}>
                          <code className={className} {...props} style={{background: 'rgba(0,0,0,0.3)', padding: '8px', borderRadius: '6px', display:'block'}}>
                            {children}
                          </code>
                        </div>
                      ) : (
                        <code className="inline-code" {...props} style={{background: 'rgba(255,255,255,0.1)', padding: '2px 4px', borderRadius: '4px', fontFamily: 'monospace'}}>
                          {children}
                        </code>
                      );
                    }
                  }}
                >
                  {m.content}
                </ReactMarkdown>
              </div>
            </div>
          </div>
        );
      })}

      {typing && (
        <div className="msg assistant">
          <div className="bubble" style={{ padding: '12px 16px', minWidth: '60px' }}>
            <div className="typing">
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>
        </div>
      )}
      
      <div ref={bottomRef} style={{ height: 1 }} />
    </div>
  );
}