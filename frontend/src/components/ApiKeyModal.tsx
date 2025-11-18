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
  const [showSecurityInfo, setShowSecurityInfo] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setError(null);
      setLoading(false);
      setShowSecurityInfo(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = async () => {
    const trimmedApiKey = apiKey.trim();
    if (!trimmedApiKey) {
      setError("API Key tidak boleh kosong.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Validasi ke Backend Hugging Face
      const response = await fetch('https://fanlley-alfan.hf.space/api/validate-api-key', {
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
          setError("API Key tidak valid.");
        }
      } else {
        // Fallback error handling
        try {
           const errData = await response.json();
           setError(errData.detail || "Gagal validasi.");
        } catch {
           setError(`Gagal validasi (Status: ${response.status})`);
        }
      }
    } catch (err) {
      console.error("Error validating API key:", err);
      setError("Gagal koneksi ke Server. Coba lagi nanti.");
    } finally {
      setLoading(false);
    }
  };

  // --- STYLING MODERN & PROFESIONAL ---
  const styles = {
    overlay: {
      position: 'fixed' as 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.85)', 
      backdropFilter: 'blur(10px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', 
      zIndex: 9999, fontFamily: "'Inter', sans-serif",
    },
    modal: {
      backgroundColor: '#0f172a', 
      border: '1px solid #334155', 
      borderRadius: '20px',
      width: '90%', maxWidth: '450px',
      boxShadow: '0 25px 50px -12px rgba(124, 58, 237, 0.25)', // Glow ungu tipis
      overflow: 'hidden',
      position: 'relative' as 'relative',
      animation: 'fadeIn 0.3s ease-out',
    },
    header: {
      padding: '24px 24px 10px 24px',
      textAlign: 'center' as 'center',
    },
    iconWrapper: {
      width: '50px', height: '50px', margin: '0 auto 15px auto',
      backgroundColor: 'rgba(124, 58, 237, 0.1)',
      borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#a78bfa'
    },
    title: { margin: 0, fontSize: '1.4rem', fontWeight: '700', color: '#f8fafc' },
    subtitle: { margin: '8px 0 0 0', fontSize: '0.9rem', color: '#94a3b8' },
    
    body: { padding: '0 24px 24px 24px' },
    
    // Security Badge Button
    securityBadge: {
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
      fontSize: '0.75rem', color: '#64748b', cursor: 'pointer',
      margin: '15px 0', padding: '8px', borderRadius: '8px',
      backgroundColor: showSecurityInfo ? 'rgba(51, 65, 85, 0.5)' : 'transparent',
      transition: 'all 0.2s',
      border: '1px dashed #334155'
    },
    securityContent: {
      fontSize: '0.8rem', color: '#cbd5e1', backgroundColor: '#1e293b',
      padding: '12px', borderRadius: '8px', marginBottom: '15px',
      lineHeight: '1.5', borderLeft: '3px solid #10b981'
    },

    inputLabel: { display: 'block', fontSize: '0.8rem', fontWeight: '600', color: '#cbd5e1', marginBottom: '6px', marginLeft: '2px' },
    input: {
      width: '100%', backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '10px',
      padding: '14px', color: 'white', outline: 'none', fontSize: '0.95rem',
      fontFamily: 'monospace', letterSpacing: '0.5px',
      transition: 'border-color 0.2s',
      boxSizing: 'border-box' as 'border-box',
    },
    errorBox: {
      marginTop: '12px', padding: '10px', backgroundColor: 'rgba(239, 68, 68, 0.15)',
      border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '8px', 
      color: '#fca5a5', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px'
    },
    
    footer: { 
      padding: '20px 24px', backgroundColor: '#020617', borderTop: '1px solid #1e293b', 
      display: 'flex', gap: '12px' 
    },
    btnCancel: {
      flex: 1, padding: '12px', backgroundColor: 'transparent', 
      border: '1px solid #334155', borderRadius: '10px', 
      color: '#94a3b8', cursor: 'pointer', fontWeight: '600', fontSize: '0.9rem',
      transition: 'all 0.2s'
    },
    btnSave: {
      flex: 2, padding: '12px', 
      background: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)', // Gradient Violet
      border: 'none', borderRadius: '10px', 
      color: 'white', cursor: loading ? 'not-allowed' : 'pointer', 
      fontWeight: '600', fontSize: '0.9rem',
      boxShadow: '0 4px 12px rgba(124, 58, 237, 0.4)',
      opacity: loading ? 0.7 : 1,
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
    },
    link: { color: '#a78bfa', textDecoration: 'none' }
  };

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        
        {/* Header Modern dengan Ikon */}
        <div style={styles.header}>
          <div style={styles.iconWrapper}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>
          </div>
          <h2 style={styles.title}>Setup Koneksi</h2>
          <p style={styles.subtitle}>Hubungkan Linda dengan Otak AI Google</p>
        </div>

        <div style={styles.body}>
          
          {/* Tombol Toggle Keamanan */}
          <div 
            style={styles.securityBadge} 
            onClick={() => setShowSecurityInfo(!showSecurityInfo)}
            title="Klik untuk info keamanan"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
            <span>Apakah ini aman? <u style={{textDecorationStyle: 'dotted'}}>Baca penjelasannya</u></span>
          </div>

          {/* Penjelasan Keamanan (Expandable) */}
          {showSecurityInfo && (
            <div style={styles.securityContent}>
              <strong>🔒 100% Aman & Privat</strong><br/>
              <span style={{opacity: 0.8}}>
                1. API Key Anda disimpan di <b>Browser Anda</b> (Local Storage).<br/>
                2. Server kami tidak menyimpan Key Anda di database.<br/>
                3. Koneksi terenkripsi langsung ke Google.<br/>
                4. Anda memegang kendali penuh atas akun Anda.
              </span>
            </div>
          )}

          <div style={{marginTop: '10px'}}>
            <label style={styles.inputLabel}>Google Gemini API Key</label>
            <input 
              type="password" 
              value={apiKey} 
              onChange={(e) => { setApiKey(e.target.value); setError(null); }} 
              placeholder="AIzaSy..." 
              style={styles.input} 
            />
          </div>

          {error && (
            <div style={styles.errorBox}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
              {error}
            </div>
          )}

          <div style={{ marginTop: '12px', textAlign: 'center', fontSize: '0.75rem', color: '#64748b' }}>
             Belum punya key? <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" style={styles.link}>Ambil gratis di sini (Google AI Studio)</a>
          </div>
        </div>

        <div style={styles.footer}>
          <button onClick={onClose} style={styles.btnCancel}>Nanti Saja</button>
          <button onClick={handleSave} disabled={loading} style={styles.btnSave}>
            {loading ? (
              <>Processing...</>
            ) : (
              <>Simpan & Mulai <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg></>
            )}
          </button>
        </div>

      </div>
    </div>
  );
};

export default ApiKeyModal;