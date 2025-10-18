import React from "react";

export type Msg = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
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