// C:\Alfan\linda-s-AI\frontend\src\components\Chat.tsx

import React from "react";

export type Msg = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  // Menambahkan field opsional untuk gambar, meskipun saat ini hanya diisi di payload pengiriman
  image_url?: string | null; 
};

export default function Chat({
  refDiv,
  messages,
  typing,
}: {
  refDiv?: React.RefObject<HTMLDivElement>;
  messages: Msg[];
  typing: boolean;
}) {
  return (
    <div ref={refDiv} className="messages">
      {messages.map((m) => (
        <div key={m.id} className={`msg ${m.role}`}>
          <div className="bubble">
            {/* Jika pesan memiliki URL gambar, tampilkan gambar */}
            {m.image_url && <img src={m.image_url} alt="User Upload" className="uploaded-image" />}
            {/* Tampilkan konten teks */}
            {m.content}
          </div>
        </div>
      ))}
      {typing && (
        <div className="msg assistant">
          <div className="bubble">
            <span className="typing">
              <span className="dot" />
              <span className="dot" />
              <span className="dot" />
            </span>
          </div>
        </div>
      )}
    </div>
  );
}