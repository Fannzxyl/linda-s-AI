import React, { useMemo } from "react";
import { Msg } from "./Chat";

type Props = {
  messages: Msg[];
  onClose: () => void; // Props baru buat nutup
};

export default function ChatStats({ messages, onClose }: Props) {
  // --- 1. LOGIC HITUNG-HITUNGAN ---
  const stats = useMemo(() => {
    const userMsgs = messages.filter((m) => m.role === "user");
    const botMsgs = messages.filter((m) => m.role === "assistant");

    const totalUserChars = userMsgs.reduce((acc, m) => acc + m.content.length, 0);
    const totalBotChars = botMsgs.reduce((acc, m) => acc + m.content.length, 0);

    const avgUserLen = userMsgs.length ? Math.round(totalUserChars / userMsgs.length) : 0;
    const avgBotLen = botMsgs.length ? Math.round(totalBotChars / botMsgs.length) : 0;

    const yapLevel = avgUserLen ? (avgBotLen / avgUserLen).toFixed(1) : "0";

    return {
      userCount: userMsgs.length,
      botCount: botMsgs.length,
      avgUserLen,
      avgBotLen,
      yapLevel,
      totalChars: totalUserChars + totalBotChars
    };
  }, [messages]);

  return (
    <>
      {/* --- CSS IN-JS (SAMA KAYAK SETTINGS BIAR KONSISTEN) --- */}
      <style>{`
        .stats-overlay {
          position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
          background-color: rgba(0, 0, 0, 0.7); backdrop-filter: blur(5px);
          z-index: 9999; display: flex; align-items: center; justify-content: center;
          animation: fadeIn 0.2s forwards;
        }
        .stats-modal {
          background-color: #0f172a; border: 1px solid rgba(255, 255, 255, 0.1);
          width: 100%; max-width: 380px; border-radius: 24px; padding: 24px;
          display: flex; flex-direction: column; gap: 16px;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
          transform: scale(0.95); opacity: 0;
          animation: popIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        @media (max-width: 768px) {
          .stats-overlay { align-items: flex-end; }
          .stats-modal {
            max-width: 100%; border-radius: 24px 24px 0 0;
            border: none; border-top: 1px solid rgba(255,255,255,0.15);
            animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          }
        }
        @keyframes fadeIn { to { opacity: 1; } }
        @keyframes popIn { to { opacity: 1; transform: scale(1); } }
        @keyframes slideUp { from { transform: translateY(100%); opacity: 1; } to { transform: translateY(0); opacity: 1; } }

        /* Komponen Card */
        .stat-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
        .stat-title { font-weight: 800; color: #a78bfa; letter-spacing: 1px; font-size: 0.9rem; text-transform: uppercase; }
        .stat-close { background: rgba(255,255,255,0.1); border: none; color: white; width: 32px; height: 32px; border-radius: 50%; cursor: pointer; display: grid; place-items: center; font-size: 1.2rem; transition: 0.2s; }
        .stat-close:hover { background: rgba(255,255,255,0.2); transform: rotate(90deg); }

        .stat-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .stat-card { background: rgba(30, 41, 59, 0.5); padding: 12px; border-radius: 16px; border: 1px solid rgba(255, 255, 255, 0.05); display: flex; flex-direction: column; gap: 4px; }
        .stat-label { font-size: 0.7rem; color: #94a3b8; text-transform: uppercase; font-weight: 600; }
        .stat-value { font-size: 1.2rem; font-weight: 800; color: #f8fafc; }
        
        .yap-bar { margin-top: 8px; padding: 12px; background: rgba(139, 92, 246, 0.1); border-radius: 16px; border: 1px dashed rgba(139, 92, 246, 0.3); }
      `}</style>

      <div className="stats-overlay" onClick={onClose}>
        <div className="stats-modal" onClick={(e) => e.stopPropagation()}>
          
          {/* Header */}
          <div className="stat-header">
            <div className="stat-title">📊 Statistik</div>
            <button className="stat-close" onClick={onClose}>&times;</button>
          </div>

          {/* Grid Stats */}
          <div className="stat-grid">
            <div className="stat-card">
              <span className="stat-label">Total Pesan</span>
              <span className="stat-value">{messages.length}</span>
            </div>
            <div className="stat-card">
              <span className="stat-label">Yap Level</span>
              <span className="stat-value" style={{color: '#fbbf24'}}>{stats.yapLevel}x</span>
            </div>
            <div className="stat-card">
              <span className="stat-label">Kamu Ngetik</span>
              <span className="stat-value">{stats.userCount} <span style={{fontSize:'0.8rem', fontWeight:400, color:'#64748b'}}>x</span></span>
            </div>
            <div className="stat-card">
              <span className="stat-label">Linda Ngetik</span>
              <span className="stat-value">{stats.botCount} <span style={{fontSize:'0.8rem', fontWeight:400, color:'#64748b'}}>x</span></span>
            </div>
          </div>

          {/* Yap Bar */}
          <div className="yap-bar">
            <div style={{fontSize: '0.75rem', color: '#cbd5e1', marginBottom: '6px', fontWeight: '600'}}>
              Rata-rata Panjang Pesan:
            </div>
            <div style={{display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#94a3b8'}}>
              <span>👤 Kamu: {stats.avgUserLen} char</span>
              <span>🤖 Linda: {stats.avgBotLen} char</span>
            </div>
            
            <div style={{height: '6px', background: '#334155', borderRadius: '4px', marginTop: '8px', overflow: 'hidden', display: 'flex'}}>
              <div style={{width: '50%', background: '#60a5fa'}} />
              <div style={{width: '50%', background: '#a78bfa'}} />
            </div>
            <div style={{textAlign: 'center', fontSize: '0.65rem', marginTop: '6px', color: '#64748b'}}>
              (Biru: Kamu vs Ungu: Linda)
            </div>
          </div>

        </div>
      </div>
    </>
  );
}