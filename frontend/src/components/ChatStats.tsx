// components/ChatStats.tsx - Display chat statistics

import React from "react";
import { Msg } from "./Chat";

type Props = {
  messages: Msg[];
};

export default function ChatStats({ messages }: Props) {
  const userMessages = messages.filter(m => m.role === 'user').length;
  const lindaMessages = messages.filter(m => m.role === 'assistant').length;
  const totalWords = messages.reduce((sum, m) => {
    return sum + m.content.split(/\s+/).length;
  }, 0);
  const withImages = messages.filter(m => m.image_url).length;

  return (
    <div className="chat-stats">
      <h4 className="stats-title">📊 Statistik Chat</h4>
      <div className="stats-grid">
        <div className="stat-item">
          <span className="stat-value">{userMessages}</span>
          <span className="stat-label">Pesan Kamu</span>
        </div>
        <div className="stat-item">
          <span className="stat-value">{lindaMessages}</span>
          <span className="stat-label">Pesan Linda</span>
        </div>
        <div className="stat-item">
          <span className="stat-value">{totalWords}</span>
          <span className="stat-label">Total Kata</span>
        </div>
        <div className="stat-item">
          <span className="stat-value">{withImages}</span>
          <span className="stat-label">Gambar</span>
        </div>
      </div>
    </div>
  );
}
