import React from "react";
import { SHORTCUTS_HELP } from "../utils/keyboardShortcuts";

type Props = {
  moodEnabled: boolean;
  onMoodToggle: (enabled: boolean) => void;
  onApiKeyChangeClick: () => void;
  onHardReset: () => void;
  
  styleName: string;
  onStyleChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  onClose: () => void; 
  showShortcuts?: boolean;
};

export default function SettingsPanel({ 
  moodEnabled, 
  onMoodToggle, 
  onApiKeyChangeClick, 
  onHardReset,
  styleName,       
  onStyleChange,   
  onClose,         
  showShortcuts = true 
}: Props) {

  // --- STYLING: MODAL MELAYANG (POP-UP) ---
  const styles: { [key: string]: React.CSSProperties } = {
    // 1. Overlay Gelap (Background Belakang)
    overlay: {
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.8)', // Gelap transparan
      backdropFilter: 'blur(5px)', // Blur chat di belakang
      zIndex: 9999, // Paling atas
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    },
    // 2. Kotak Panel Setting
    panel: {
      backgroundColor: '#0f172a', // Solid Dark Blue
      border: '1px solid rgba(255, 255, 255, 0.1)',
      borderRadius: '24px',
      width: '100%',
      maxWidth: '420px', // Batasi lebar biar rapi di Desktop
      maxHeight: '90vh', // Jangan lebih tinggi dari layar
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
      padding: '24px',
      color: '#f8fafc',
      overflowY: 'auto', // Scroll kalau kepanjangan
      boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
      position: 'relative'
    },
    headerRow: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '16px',
      paddingBottom: '16px',
      borderBottom: '1px solid rgba(255,255,255,0.1)'
    },
    headerTitle: {
      fontWeight: '800',
      color: '#a78bfa',
      textTransform: 'uppercase',
      letterSpacing: '1px',
      fontSize: '1rem',
      display: 'flex', alignItems: 'center', gap: '8px'
    },
    closeBtn: {
      background: 'rgba(255,255,255,0.1)',
      border: 'none',
      color: '#fff',
      width: '36px', height: '36px',
      borderRadius: '50%',
      cursor: 'pointer',
      display: 'grid', placeItems: 'center',
      fontSize: '1.2rem',
      transition: '0.2s'
    },
    card: {
      backgroundColor: 'rgba(30, 41, 59, 0.5)',
      border: '1px solid rgba(255, 255, 255, 0.05)',
      borderRadius: '16px',
      padding: '16px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    select: {
      backgroundColor: '#020617',
      color: 'white',
      border: '1px solid #334155',
      padding: '8px 12px',
      borderRadius: '8px',
      outline: 'none',
      fontSize: '0.9rem',
      cursor: 'pointer',
      minWidth: '130px'
    },
    cardDanger: {
      backgroundColor: 'rgba(239, 68, 68, 0.05)', 
      border: '1px dashed rgba(239, 68, 68, 0.2)',
      borderRadius: '16px',
      padding: '16px',
      marginTop: '8px'
    },
    info: { flex: 1, paddingRight: '12px' },
    label: { display: 'block', fontSize: '0.9rem', fontWeight: '600', marginBottom: '4px', color: '#f1f5f9' },
    desc: { fontSize: '0.75rem', color: '#94a3b8', lineHeight: '1.3' },
    
    toggleLabel: { position: 'relative', display: 'inline-block', width: '44px', height: '24px', cursor: 'pointer' },
    toggleInput: { opacity: 0, width: 0, height: 0 },
    toggleSlider: { position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#334155', transition: '.3s', borderRadius: '34px' },
    toggleSliderActive: { backgroundColor: '#8b5cf6' },
    toggleKnob: { position: 'absolute', content: '""', height: '18px', width: '18px', left: '3px', bottom: '3px', backgroundColor: 'white', transition: '.3s', borderRadius: '50%' },
    toggleKnobActive: { transform: 'translateX(20px)' },
    
    btnSecondary: { backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#e2e8f0', padding: '8px 14px', borderRadius: '8px', fontSize: '0.8rem', cursor: 'pointer', fontWeight: '600' },
    btnDanger: { backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.5)', color: '#fca5a5', padding: '8px 14px', borderRadius: '8px', fontSize: '0.8rem', cursor: 'pointer', fontWeight: '600' },
    
    shortcutsContainer: { marginTop: '12px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.05)' },
    shortcutRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', fontSize: '0.8rem', color: '#cbd5e1' },
    kbd: { backgroundColor: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '2px 6px', fontFamily: 'monospace', fontSize: '0.75rem', color: '#a78bfa' }
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      {/* Stop Propagation biar klik di dalam panel gak nutup modal */}
      <div style={styles.panel} onClick={(e) => e.stopPropagation()}>
        
        <div style={styles.headerRow}>
          <div style={styles.headerTitle}><span>⚙️</span> PENGATURAN</div>
          <button style={styles.closeBtn} onClick={onClose}>&times;</button>
        </div>
        
        {/* CARD 1: GAYA BICARA */}
        <div style={styles.card}>
          <div style={styles.info}>
            <label style={styles.label}>Gaya Bicara</label>
            <p style={styles.desc}>Pilih kepribadian Linda.</p>
          </div>
          <select style={styles.select} value={styleName} onChange={onStyleChange}>
            <option>Tsundere</option>
            <option>Yandere</option>
            <option>Ceria</option>
            <option>Santai</option>
            <option>Formal</option>
            <option>Netral</option>
          </select>
        </div>

        {/* CARD 2: MOOD */}
        <div style={styles.card}>
          <div style={styles.info}>
            <label style={styles.label}>Mood Dinamis</label>
            <p style={styles.desc}>Linda bisa baperan.</p>
          </div>
          <label style={styles.toggleLabel}>
            <input type="checkbox" checked={moodEnabled} onChange={(e) => onMoodToggle(e.target.checked)} style={styles.toggleInput} />
            <span style={{...styles.toggleSlider, ...(moodEnabled ? styles.toggleSliderActive : {})}}>
              <span style={{...styles.toggleKnob, ...(moodEnabled ? styles.toggleKnobActive : {})}} />
            </span>
          </label>
        </div>

        {/* CARD 3: API KEY */}
        <div style={styles.card}>
          <div style={styles.info}>
            <label style={styles.label}>Koneksi API</label>
            <p style={styles.desc}>Ganti kunci Gemini.</p>
          </div>
          <button style={styles.btnSecondary} onClick={onApiKeyChangeClick}>Ganti</button>
        </div>

        {/* CARD 4: DANGER */}
        <div style={styles.cardDanger}>
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
            <div style={styles.info}>
              <label style={{...styles.label, color: '#fca5a5'}}>Zona Bahaya</label>
              <p style={{...styles.desc, color: '#f87171'}}>Reset semua data.</p>
            </div>
            <button style={styles.btnDanger} onClick={onHardReset}>Reset</button>
          </div>
        </div>

        {/* SHORTCUTS */}
        {showShortcuts && (
          <div style={styles.shortcutsContainer}>
            <h4 style={{...styles.label, marginBottom: '12px', color: '#94a3b8', fontSize: '0.75rem'}}>SHORTCUTS</h4>
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
    </div>
  );
}