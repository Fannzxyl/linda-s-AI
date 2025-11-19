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

  return (
    <>
      {/* --- CSS KHUSUS BUAT SETTINGS (RESPONSIF) --- */}
      <style>{`
        /* 1. OVERLAY (Latar Belakang Gelap) */
        .settings-overlay {
          position: fixed;
          top: 0; left: 0; width: 100vw; height: 100vh;
          background-color: rgba(0, 0, 0, 0.6);
          backdrop-filter: blur(8px);
          z-index: 9999;
          display: flex;
          align-items: center;
          justify-content: center;
          opacity: 0;
          animation: fadeIn 0.2s forwards;
        }

        /* 2. MODAL BOX (Kotak Settingnya) */
        .settings-modal {
          background-color: #0f172a;
          border: 1px solid rgba(255, 255, 255, 0.1);
          width: 100%;
          max-width: 400px; /* Lebar maksimal di Desktop */
          max-height: 85vh; /* Jangan mentok atas bawah */
          border-radius: 24px;
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 16px;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
          transform: scale(0.95);
          opacity: 0;
          animation: popIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          overflow-y: auto;
        }

        /* Sembunyikan Scrollbar tapi tetep bisa scroll */
        .settings-modal::-webkit-scrollbar { display: none; }

        /* 3. RESPONSIVE MOBILE (Tampilan HP) */
        @media (max-width: 768px) {
          .settings-overlay {
            align-items: flex-end; /* Tempel ke bawah */
            background-color: rgba(0, 0, 0, 0.8); /* Lebih gelap */
          }
          
          .settings-modal {
            max-width: 100%;
            height: 90vh; /* Hampir full layar */
            max-height: 90vh;
            border-radius: 24px 24px 0 0; /* Lengkung atas doang */
            border: none;
            border-top: 1px solid rgba(255,255,255,0.15);
            animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          }
        }

        /* 4. ANIMASI */
        @keyframes fadeIn { to { opacity: 1; } }
        @keyframes popIn { to { opacity: 1; transform: scale(1); } }
        @keyframes slideUp { from { transform: translateY(100%); opacity: 1; } to { transform: translateY(0); opacity: 1; } }

        /* 5. KOMPONEN KECIL */
        .st-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
        .st-title { font-weight: 800; color: #a78bfa; letter-spacing: 1px; font-size: 0.9rem; display: flex; gap: 8px; align-items: center; }
        .st-close { background: rgba(255,255,255,0.1); border: none; color: white; width: 32px; height: 32px; border-radius: 50%; cursor: pointer; display: grid; place-items: center; font-size: 1.2rem; transition: 0.2s; }
        .st-close:hover { background: rgba(255,255,255,0.2); transform: rotate(90deg); }
        
        .st-card { background: rgba(30, 41, 59, 0.5); border: 1px solid rgba(255,255,255,0.05); border-radius: 16px; padding: 14px; display: flex; justify-content: space-between; align-items: center; }
        .st-card.danger { background: rgba(239, 68, 68, 0.05); border-color: rgba(239, 68, 68, 0.2); }
        
        .st-label { display: block; font-size: 0.85rem; font-weight: 600; color: #f1f5f9; margin-bottom: 2px; }
        .st-desc { font-size: 0.75rem; color: #94a3b8; }
        
        .st-select { background: #020617; color: white; border: 1px solid #334155; padding: 8px 12px; border-radius: 8px; outline: none; font-size: 0.85rem; }
        .st-btn { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: #e2e8f0; padding: 6px 12px; border-radius: 8px; font-size: 0.75rem; font-weight: 600; cursor: pointer; }
        .st-btn.danger { background: rgba(239, 68, 68, 0.1); border-color: rgba(239, 68, 68, 0.5); color: #fca5a5; }

        /* Toggle Switch CSS */
        .toggle-switch { position: relative; width: 40px; height: 22px; }
        .toggle-switch input { opacity: 0; width: 0; height: 0; }
        .slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #334155; transition: .3s; border-radius: 34px; }
        .slider:before { position: absolute; content: ""; height: 16px; width: 16px; left: 3px; bottom: 3px; background-color: white; transition: .3s; border-radius: 50%; }
        input:checked + .slider { background-color: #8b5cf6; }
        input:checked + .slider:before { transform: translateX(18px); }
      `}</style>

      <div className="settings-overlay" onClick={onClose}>
        <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
          
          {/* HEADER */}
          <div className="st-header">
            <div className="st-title"><span>⚙️</span> PENGATURAN</div>
            <button className="st-close" onClick={onClose}>&times;</button>
          </div>

          {/* CARD 1: GAYA BICARA */}
          <div className="st-card">
            <div>
              <label className="st-label">Gaya Bicara</label>
              <span className="st-desc">Kepribadian Linda.</span>
            </div>
            <select className="st-select" value={styleName} onChange={onStyleChange}>
              <option>Tsundere</option>
              <option>Yandere</option>
              <option>Ceria</option>
              <option>Santai</option>
              <option>Formal</option>
              <option>Netral</option>
            </select>
          </div>

          {/* CARD 2: MOOD */}
          <div className="st-card">
            <div>
              <label className="st-label">Mood Dinamis</label>
              <span className="st-desc">Linda bisa baperan.</span>
            </div>
            <label className="toggle-switch">
              <input type="checkbox" checked={moodEnabled} onChange={(e) => onMoodToggle(e.target.checked)} />
              <span className="slider"></span>
            </label>
          </div>

          {/* CARD 3: API KEY */}
          <div className="st-card">
            <div>
              <label className="st-label">Koneksi API</label>
              <span className="st-desc">Ganti kunci Gemini.</span>
            </div>
            <button className="st-btn" onClick={onApiKeyChangeClick}>Ganti</button>
          </div>

          {/* CARD 4: DANGER */}
          <div className="st-card danger">
            <div>
              <label className="st-label" style={{color:'#fca5a5'}}>Zona Bahaya</label>
              <span className="st-desc" style={{color:'#f87171'}}>Reset semua data.</span>
            </div>
            <button className="st-btn danger" onClick={onHardReset}>Reset</button>
          </div>

          {/* SHORTCUTS */}
          {showShortcuts && (
            <div style={{marginTop: '10px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '10px'}}>
              <h4 style={{fontSize: '0.7rem', color: '#94a3b8', marginBottom: '8px', textTransform:'uppercase'}}>Shortcuts</h4>
              <div style={{display:'grid', gap:'6px'}}>
                {SHORTCUTS_HELP.map((s, i) => (
                  <div key={i} style={{display:'flex', justifyContent:'space-between', fontSize:'0.75rem', color:'#cbd5e1'}}>
                    <span>{s.action}</span>
                    <span style={{fontFamily:'monospace', color:'#a78bfa', background:'rgba(0,0,0,0.3)', padding:'2px 6px', borderRadius:'4px'}}>{s.keys}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>
    </>
  );
}