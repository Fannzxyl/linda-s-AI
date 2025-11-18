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

  useEffect(() => {
    if (isOpen) {
      setError(null);
      setLoading(false);
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
      // --- PERBAIKAN: GUNAKAN 127.0.0.1 AGAR KONSISTEN ---
      const response = await fetch('http://127.0.0.1:8000/api/validate-api-key', {
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
        try {
            const errorData = await response.json();
            setError(errorData.detail || "Gagal memvalidasi API Key.");
        } catch (e) {
            setError(`Gagal validasi (Status: ${response.status})`);
        }
      }
    } catch (err) {
      console.error("Error validating API key:", err);
      setError("Gagal koneksi. Pastikan backend (Python) menyala.");
    } finally {
      setLoading(false);
    }
  };

  // --- Styles (Sama seperti sebelumnya) ---
  const styles = {
    overlay: {
      position: 'fixed' as 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.85)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, fontFamily: 'sans-serif',
    },
    modal: {
      backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '16px',
      width: '90%', maxWidth: '480px', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.7)',
    },
    header: { padding: '24px', borderBottom: '1px solid #1e293b', backgroundColor: '#1e293b' },
    title: { margin: 0, fontSize: '1.25rem', fontWeight: '600', color: '#f8fafc' },
    body: { padding: '24px' },
    label: { display: 'block', fontSize: '0.75rem', fontWeight: '600', color: '#94a3b8', marginBottom: '8px' },
    input: {
      width: '100%', backgroundColor: '#020617', border: '1px solid #334155', borderRadius: '8px',
      padding: '12px 16px', color: 'white', outline: 'none', boxSizing: 'border-box' as 'border-box',
    },
    errorBox: {
      marginTop: '12px', padding: '12px', backgroundColor: 'rgba(239, 68, 68, 0.1)',
      border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '8px', color: '#fca5a5', fontSize: '0.875rem',
    },
    footer: { padding: '16px 24px', backgroundColor: '#020617', borderTop: '1px solid #1e293b', display: 'flex', gap: '12px' },
    btnCancel: { flex: 1, padding: '12px', backgroundColor: 'transparent', border: '1px solid #334155', borderRadius: '8px', color: '#cbd5e1', cursor: 'pointer' },
    btnSave: { flex: 1, padding: '12px', backgroundColor: '#7c3aed', border: 'none', borderRadius: '8px', color: 'white', cursor: 'pointer', fontWeight: '600' }
  };

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <div style={styles.header}><h2 style={styles.title}>🔑 Masukkan Gemini API Key</h2></div>
        <div style={styles.body}>
          <label style={styles.label}>API Key Google AI Studio</label>
          <input type="password" value={apiKey} onChange={(e) => { setApiKey(e.target.value); setError(null); }} placeholder="AIzaSy..." style={styles.input} />
          {error && <div style={styles.errorBox}>⚠️ {error}</div>}
          <div style={{ marginTop: '16px', textAlign: 'center', fontSize: '0.8rem', color: '#64748b' }}>
             Belum punya key? <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" style={{ color: '#a78bfa' }}>Ambil gratis</a>
          </div>
        </div>
        <div style={styles.footer}>
          <button onClick={onClose} style={styles.btnCancel}>Tutup</button>
          <button onClick={handleSave} disabled={loading} style={styles.btnSave}>{loading ? '...' : 'Simpan'}</button>
        </div>
      </div>
    </div>
  );
};

export default ApiKeyModal;