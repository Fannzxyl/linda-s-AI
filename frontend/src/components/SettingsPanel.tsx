import React from "react";
import { SHORTCUTS_HELP } from "../utils/keyboardShortcuts";

type Props = {
  moodEnabled: boolean;
  onMoodToggle: (enabled: boolean) => void;
  onApiKeyChangeClick: () => void;
  onHardReset: () => void;
  showShortcuts?: boolean;
};

export default function SettingsPanel({ 
  moodEnabled, 
  onMoodToggle, 
  onApiKeyChangeClick, 
  onHardReset,
  showShortcuts = true 
}: Props) {

  // --- STYLING MODERN & COMPACT ---
  const styles: { [key: string]: React.CSSProperties } = {
    panel: {
      backgroundColor: 'rgba(15, 23, 42, 0.6)', // Lebih transparan
      backdropFilter: 'blur(12px)', // Efek kaca buram
      border: '1px solid rgba(255, 255, 255, 0.05)', // Border super tipis
      borderRadius: '20px', // Lebih bulat
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px', // Gap diperkecil biar muat
      padding: '16px',
      color: '#f8fafc',
      overflowY: 'auto',
      scrollbarWidth: 'none', // Sembunyikan scrollbar (Firefox)
      msOverflowStyle: 'none',  // Sembunyikan scrollbar (IE/Edge)
    },
    header: {
      fontWeight: '700',
      marginBottom: '4px',
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      color: '#a78bfa',
      textTransform: 'uppercase',
      letterSpacing: '1px',
      fontSize: '0.85rem' // <-- FIX: Cuma satu fontSize sekarang
    },
    card: {
      backgroundColor: 'rgba(30, 41, 59, 0.4)', // Semi transparan
      border: '1px solid rgba(255, 255, 255, 0.05)',
      borderRadius: '16px',
      padding: '12px 16px', // Padding diperkecil
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      transition: 'all 0.2s',
    },
    cardDanger: {
      backgroundColor: 'rgba(239, 68, 68, 0.05)', 
      border: '1px dashed rgba(239, 68, 68, 0.2)',
      borderRadius: '16px',
      padding: '12px 16px',
      marginTop: '4px'
    },
    info: {
      flex: 1,
      paddingRight: '12px'
    },
    label: {
      display: 'block',
      fontSize: '0.85rem',
      fontWeight: '600',
      marginBottom: '2px',
      color: '#f1f5f9'
    },
    desc: {
      fontSize: '0.7rem',
      color: '#94a3b8',
      lineHeight: '1.3'
    },
    // Toggle Switch (Diperkecil dikit)
    toggleLabel: {
      position: 'relative', display: 'inline-block', width: '40px', height: '22px', cursor: 'pointer'
    },
    toggleInput: { opacity: 0, width: 0, height: 0 },
    toggleSlider: {
      position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: '#334155', transition: '.3s', borderRadius: '34px'
    },
    toggleSliderActive: { backgroundColor: '#8b5cf6' },
    toggleKnob: {
      position: 'absolute', content: '""', height: '16px', width: '16px',
      left: '3px', bottom: '3px', backgroundColor: 'white', transition: '.3s', borderRadius: '50%'
    },
    toggleKnobActive: { transform: 'translateX(18px)' },
    
    // Buttons
    btnSecondary: {
      backgroundColor: 'rgba(255,255,255,0.05)',
      border: '1px solid rgba(255,255,255,0.1)',
      color: '#e2e8f0',
      padding: '6px 12px',
      borderRadius: '8px',
      fontSize: '0.75rem',
      cursor: 'pointer',
      fontWeight: '600',
      transition: '0.2s'
    },
    btnDanger: {
      backgroundColor: 'rgba(239, 68, 68, 0.1)',
      border: '1px solid rgba(239, 68, 68, 0.5)',
      color: '#fca5a5',
      padding: '6px 12px',
      borderRadius: '8px',
      fontSize: '0.75rem',
      cursor: 'pointer',
      fontWeight: '600',
      whiteSpace: 'nowrap'
    },
    
    // Shortcuts
    shortcutsContainer: {
      marginTop: '8px',
      paddingTop: '12px',
      borderTop: '1px solid rgba(255,255,255,0.05)'
    },
    shortcutRow: {
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      marginBottom: '6px', fontSize: '0.75rem', color: '#cbd5e1'
    },
    kbd: {
      backgroundColor: 'rgba(0,0,0,0.3)',
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: '4px',
      padding: '2px 5px',
      fontFamily: 'monospace',
      fontSize: '0.7rem',
      color: '#a78bfa',
    }
  };

  return (
    <>
      {/* Inject CSS buat hide scrollbar Chrome/Safari */}
      <style>{`
        .settings-panel-scroll::-webkit-scrollbar { display: none; }
      `}</style>

      <div style={styles.panel} className="settings-panel-scroll">
        <div style={styles.header}>
          <span>⚙️</span> Pengaturan
        </div>
        
        {/* CARD 1: MOOD */}
        <div style={styles.card}>
          <div style={styles.info}>
            <label style={styles.label}>Mood Dinamis</label>
            <p style={styles.desc}>Linda bisa baperan.</p>
          </div>
          <label style={styles.toggleLabel}>
            <input
              type="checkbox"
              checked={moodEnabled}
              onChange={(e) => onMoodToggle(e.target.checked)}
              style={styles.toggleInput}
            />
            <span style={{...styles.toggleSlider, ...(moodEnabled ? styles.toggleSliderActive : {})}}>
              <span style={{...styles.toggleKnob, ...(moodEnabled ? styles.toggleKnobActive : {})}} />
            </span>
          </label>
        </div>

        {/* CARD 2: API KEY */}
        <div style={styles.card}>
          <div style={styles.info}>
            <label style={styles.label}>Koneksi API</label>
            <p style={styles.desc}>Ganti kunci Gemini.</p>
          </div>
          <button 
            style={styles.btnSecondary}
            onClick={onApiKeyChangeClick}
          >
            Ganti
          </button>
        </div>

        {/* CARD 3: DANGER */}
        <div style={styles.cardDanger}>
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
            <div style={styles.info}>
              <label style={{...styles.label, color: '#fca5a5'}}>Zona Bahaya</label>
              <p style={{...styles.desc, color: '#f87171'}}>Reset semua data.</p>
            </div>
            <button style={styles.btnDanger} onClick={onHardReset}>
              Reset
            </button>
          </div>
        </div>

        {/* SHORTCUTS */}
        {showShortcuts && (
          <div style={styles.shortcutsContainer}>
            <h4 style={{...styles.label, marginBottom: '8px', color: '#94a3b8', fontSize: '0.7rem'}}>SHORTCUTS</h4>
            <div>
              {SHORTCUTS_HELP.map((shortcut, i) => (
                <div key={i} style={styles.shortcutRow}>
                  <span>{shortcut.action}</span>
                  <div style={{display: 'flex', gap: '4px'}}>
                    {shortcut.keys.split('+').map((k, idx) => (
                      <span key={idx}>
                        <kbd style={styles.kbd}>{k.trim()}</kbd>
                        {idx < shortcut.keys.split('+').length - 1 && <span style={{color:'#64748b'}}>+</span>}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}