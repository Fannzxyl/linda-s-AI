import React, { useMemo } from "react";
import { Msg } from "./Chat";

type Props = {
  messages: Msg[];
};

export default function ChatStats({ messages }: Props) {
  // --- 1. LOGIC HITUNG-HITUNGAN (Pake useMemo biar gak berat) ---
  const stats = useMemo(() => {
    const userMsgs = messages.filter((m) => m.role === "user");
    const botMsgs = messages.filter((m) => m.role === "assistant");

    const totalUserChars = userMsgs.reduce((acc, m) => acc + m.content.length, 0);
    const totalBotChars = botMsgs.reduce((acc, m) => acc + m.content.length, 0);

    const avgUserLen = userMsgs.length ? Math.round(totalUserChars / userMsgs.length) : 0;
    const avgBotLen = botMsgs.length ? Math.round(totalBotChars / botMsgs.length) : 0;

    // "Yap Level" = Seberapa cerewet Linda (Rasio kata bot : user)
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

  // --- 2. STYLING (INLINE BIAR PRAKTIS) ---
  const styles: { [key: string]: React.CSSProperties } = {
    container: {
      padding: "20px",
      background: "rgba(15, 23, 42, 0.6)", // Transparan dikit
      borderRadius: "16px",
      border: "1px solid rgba(148, 163, 184, 0.1)",
      marginTop: "20px",
      backdropFilter: "blur(10px)",
      animation: "fadeIn 0.3s ease-out"
    },
    header: {
      fontSize: "0.95rem",
      fontWeight: "700",
      color: "#a78bfa", // Ungu Linda
      marginBottom: "16px",
      display: "flex",
      alignItems: "center",
      gap: "8px",
      textTransform: "uppercase",
      letterSpacing: "1px"
    },
    grid: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: "12px"
    },
    card: {
      background: "rgba(0, 0, 0, 0.3)",
      padding: "12px",
      borderRadius: "12px",
      border: "1px solid rgba(255, 255, 255, 0.05)",
      display: "flex",
      flexDirection: "column",
      gap: "4px"
    },
    label: {
      fontSize: "0.7rem",
      color: "#94a3b8",
      textTransform: "uppercase"
    },
    value: {
      fontSize: "1.2rem",
      fontWeight: "800",
      color: "#f8fafc"
    },
    highlight: {
      color: "#34d399" // Hijau
    },
    yapBar: {
      marginTop: "16px",
      padding: "12px",
      background: "rgba(139, 92, 246, 0.1)",
      borderRadius: "12px",
      border: "1px dashed rgba(139, 92, 246, 0.3)"
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <span>📊</span> Statistik Obrolan
      </div>

      <div style={styles.grid}>
        {/* Total Chat */}
        <div style={styles.card}>
          <span style={styles.label}>Total Pesan</span>
          <span style={styles.value}>{messages.length}</span>
        </div>

        {/* Yap Level (Kecerewetan) */}
        <div style={styles.card}>
          <span style={styles.label}>Yap Level</span>
          <span style={{...styles.value, color: '#fbbf24'}}>
            {stats.yapLevel}x
          </span>
        </div>

        {/* User Stats */}
        <div style={styles.card}>
          <span style={styles.label}>Kamu Ngetik</span>
          <span style={styles.value}>{stats.userCount} <span style={{fontSize:'0.8rem', fontWeight:400, color:'#64748b'}}>x</span></span>
        </div>

        {/* Bot Stats */}
        <div style={styles.card}>
          <span style={styles.label}>Linda Ngetik</span>
          <span style={styles.value}>{stats.botCount} <span style={{fontSize:'0.8rem', fontWeight:400, color:'#64748b'}}>x</span></span>
        </div>
      </div>

      {/* Fun Fact Section */}
      <div style={styles.yapBar}>
        <div style={{fontSize: '0.8rem', color: '#cbd5e1', marginBottom: '4px'}}>
          <strong>Rata-rata Panjang Pesan:</strong>
        </div>
        <div style={{display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#94a3b8'}}>
          <span>👤 Kamu: {stats.avgUserLen} char</span>
          <span>🤖 Linda: {stats.avgBotLen} char</span>
        </div>
        
        {/* Visual Bar */}
        <div style={{height: '6px', background: '#334155', borderRadius: '4px', marginTop: '8px', overflow: 'hidden', display: 'flex'}}>
          <div style={{width: '50%', background: '#60a5fa'}} /> {/* User (Blue) */}
          <div style={{width: '50%', background: '#a78bfa'}} /> {/* Bot (Purple) */}
        </div>
        <div style={{textAlign: 'center', fontSize: '0.65rem', marginTop: '4px', color: '#64748b'}}>
          (Biru: Kamu vs Ungu: Linda)
        </div>
      </div>
    </div>
  );
}