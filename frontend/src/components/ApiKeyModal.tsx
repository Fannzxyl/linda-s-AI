import React, { useState, useEffect } from 'react';

interface ApiKeyModalProps {
  isOpen: boolean;
  onSave: (apiKey: string) => void;
  onClose: () => void;
}

const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ isOpen, onSave, onClose }) => {
  const [apiKey, setApiKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showInfo, setShowInfo] = useState(false);

  // --- UPDATE: BIAR DINAMIS (BACA .ENV) ---
  // Sama kayak di App.tsx, biar sinkron
  const BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";
  const VALIDATE_URL = `${BASE_URL}/api/validate-api-key`;

  useEffect(() => {
    if (isOpen) {
      setError(null);
      setLoading(false);
      setShowInfo(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = async () => {
    const trimmedApiKey = apiKey.trim();
    if (!trimmedApiKey) {
      setError("API Key masih kosong nih, bestie.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(VALIDATE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Gemini-Api-Key': trimmedApiKey 
        },
        body: JSON.stringify({}), 
      });

      if (response.ok) {
        const result = await response.json();
        if (result.valid) {
          onSave(trimmedApiKey);
        } else {
          setError("Key-nya gak valid. Coba cek lagi deh.");
        }
      } else {
        // Fallback logic kalau backend error tapi format key bener (AIza...)
        if (trimmedApiKey.startsWith("AIza")) {
           onSave(trimmedApiKey);
        } else {
           setError(`Gagal validasi (${response.status}). Cek koneksi backend.`);
        }
      }
    } catch (err) {
      console.error("Validation error:", err);
      // Fallback offline
      if (trimmedApiKey.startsWith("AIza")) {
        onSave(trimmedApiKey);
      } else {
        setError("Jaringan error. Pastikan backend nyala.");
      }
    } finally {
      setLoading(false);
    }
  };

  // --- STYLING: DARK CYBER AESTHETIC ---
  const styles: { [key: string]: React.CSSProperties } = {
    overlay: {
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.85)', 
      backdropFilter: 'blur(8px)', 
      display: 'flex', alignItems: 'center', justifyContent: 'center', 
      zIndex: 10000, // Paling Atas!
      fontFamily: '"Inter", sans-serif',
    },
    modal: {
      backgroundColor: '#1e293b', 
      backgroundImage: 'linear-gradient(to bottom right, #1e293b, #0f172a)',
      borderRadius: '16px', 
      width: '90%', maxWidth: '450px', 
      boxShadow: '0 0 40px rgba(139, 92, 246, 0.15)', 
      border: '1px solid rgba(148, 163, 184, 0.1)',
      overflow: 'hidden',
      color: '#f8fafc'
    },
    header: { padding: '24px 32px 10px', textAlign: 'center' },
    iconWrapper: {
      width: '48px', height: '48px', margin: '0 auto 16px',
      backgroundColor: 'rgba(139, 92, 246, 0.1)',
      borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#a78bfa'
    },
    title: { margin: 0, fontSize: '1.25rem', fontWeight: '700', color: '#f8fafc', letterSpacing: '-0.025em' },
    subtitle: { margin: '8px 0 0', fontSize: '0.875rem', color: '#94a3b8' },
    
    body: { padding: '20px 32px 32px' },
    
    labelContainer: { display: 'flex', alignItems: 'center', marginBottom: '8px', justifyContent: 'space-between' },
    label: { fontSize: '0.75rem', fontWeight: '600', color: '#cbd5e1', textTransform: 'uppercase', letterSpacing: '0.05em' },
    
    infoTrigger: {
        fontSize: '0.75rem', color: '#a78bfa', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px'
    },
    infoBox: {
      fontSize: '0.8rem', color: '#cbd5e1', backgroundColor: 'rgba(15, 23, 42, 0.6)', 
      padding: '12px', borderRadius: '8px', border: '1px dashed #475569', marginBottom: '20px',
      lineHeight: '1.5'
    },
    
    inputWrapper: { position: 'relative' as 'relative' },
    input: {
      width: '100%', backgroundColor: '#0f172a', 
      border: '1px solid #334155', borderRadius: '10px',
      padding: '14px 16px', color: '#fff', outline: 'none', 
      fontSize: '0.9rem', fontFamily: '"Fira Code", monospace', 
      boxSizing: 'border-box',
      transition: 'border-color 0.2s, box-shadow 0.2s',
    },
    
    errorBox: {
      marginTop: '12px', padding: '10px', backgroundColor: 'rgba(239, 68, 68, 0.1)',
      border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '8px',
      color: '#fca5a5', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px'
    },
    
    helperText: { marginTop: '20px', fontSize: '0.8rem', color: '#64748b', textAlign: 'center' },
    link: { color: '#a78bfa', textDecoration: 'none', fontWeight: '500', cursor: 'pointer', borderBottom: '1px dotted #a78bfa' },
    
    footer: { padding: '0 32px 32px' },
    btnSave: { 
      width: '100%',
      padding: '14px', 
      background: 'linear-gradient(135deg, #7c3aed 0%, #db2777 100%)', 
      border: 'none', 
      borderRadius: '10px', color: 'white', cursor: 'pointer', fontWeight: '600', fontSize: '0.95rem',
      opacity: loading ? 0.7 : 1, 
      boxShadow: '0 4px 15px rgba(124, 58, 237, 0.3)',
      transition: 'transform 0.1s',
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
    }
  };

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        
        <div style={styles.header}>
          <div style={styles.iconWrapper}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
          </div>
          <h2 style={styles.title}>Akses Sistem</h2>
          <p style={styles.subtitle}>Hubungkan Linda dengan Otak AI Google</p>
        </div>
        
        <div style={styles.body}>
          {showInfo && (
            <div style={styles.infoBox}>
              <strong>🔒 Aman & Terenkripsi</strong><br/>
              API Key disimpan di <em>Local Storage</em> browser kamu. Tidak dikirim ke database server kami. Hanya dipakai buat ngobrol sama Google.
            </div>
          )}
          
          <div style={styles.labelContainer}>
            <label style={styles.label}>Gemini API Key</label>
            <span style={styles.infoTrigger} onClick={() => setShowInfo(!showInfo)}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
                {showInfo ? "Tutup Info" : "Aman gak nih?"}
            </span>
          </div>
          
          <div style={styles.inputWrapper}>
            <input 
              type="password" 
              value={apiKey} 
              onChange={(e) => { setApiKey(e.target.value); setError(null); }} 
              placeholder="AIzaSy..." 
              style={styles.input}
              autoFocus
            />
          </div>
          
          {error && (
            <div style={styles.errorBox}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
              {error}
            </div>
          )}
          
          <div style={styles.helperText}>
             Belum punya key? <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" style={styles.link}>Ambil gratis di Google AI Studio</a>
          </div>
        </div>
        
        <div style={styles.footer}>
          <button onClick={handleSave} disabled={loading} style={styles.btnSave}>
            {loading ? (
              <>Menghubungkan...</>
            ) : (
              <>Masuk ke Chat <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg></>
            )}
          </button>
        </div>

      </div>
    </div>
  );
};

export default ApiKeyModal;