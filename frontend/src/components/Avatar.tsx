import React, { useEffect, useMemo, useRef, useState } from "react";

// --- TIPE DATA ---
export type Emotion = "neutral" | "happy" | "sad" | "angry" | "tsun" | "excited" | "calm";

export type AvatarState = {
  emotion: Emotion;
  blink: boolean;
  wink: boolean;
  headSwaySpeed: number;
  glow: string;
};

type Props = { 
  state: AvatarState; 
  typing?: boolean 
};

// --- ASSETS HELPER ---
const base = (import.meta as any).env?.BASE_URL || "/";
const asset = (name: string) => `${base}linda/${name}`;

// --- MAPPING GAMBAR ---
const EMOTION_SRC: Record<Emotion, string> = {
  neutral: asset("netral.png"),
  happy: asset("senyum.png"),
  sad: asset("sedih.png"),
  angry: asset("netral.png"), 
  tsun: asset("wink.png"),    
  excited: asset("senyum.png"),
  calm: asset("netral.png"),
};

const WINK_SRC = asset("wink.png");
const BLINK_SRC = asset("merem.png");

export default function Avatar({ state, typing = false }: Props) {
  const frameRef = useRef<HTMLDivElement>(null);
  
  // State Transisi
  const [backSrc, setBackSrc] = useState(EMOTION_SRC.neutral);
  const [frontSrc, setFrontSrc] = useState(EMOTION_SRC.neutral);
  const [frontShow, setFrontShow] = useState(true);
  const [overlay, setOverlay] = useState<string | null>(null);
  
  const verRef = useRef(0);
  const crossFadeTimerRef = useRef<number | null>(null);

  const targetSrc = useMemo(() => EMOTION_SRC[state.emotion] ?? EMOTION_SRC.neutral, [state.emotion]);

  // 1. Preload (Biar gak kedip putih)
  useEffect(() => {
    const preloadList = ["netral.png", "senyum.png", "sedih.png", "wink.png", "merem.png"];
    preloadList.forEach((n) => {
      const img = new Image();
      img.src = asset(n);
    });
  }, []);

  // 2. Logic Ganti Ekspresi (Cross-Fade)
  useEffect(() => {
    if (crossFadeTimerRef.current) {
        clearTimeout(crossFadeTimerRef.current);
        crossFadeTimerRef.current = null;
    }
    
    if (targetSrc === frontSrc) return;
    
    const ver = ++verRef.current;
    const img = new Image();
    img.src = targetSrc;

    const applyChange = async () => {
      try { await img.decode(); } catch {} 
      
      if (ver !== verRef.current) return; 
      
      setBackSrc(frontSrc);
      setFrontSrc(targetSrc);
      setFrontShow(false); 
      
      crossFadeTimerRef.current = setTimeout(() => {
          if (ver !== verRef.current) return;
          requestAnimationFrame(() => {
              if (ver !== verRef.current) return;
              setFrontShow(true); 
          });
      }, 50) as unknown as number;
    };

    img.onload = applyChange;
    img.onerror = () => {
      if (ver === verRef.current) {
          setBackSrc(EMOTION_SRC.neutral);
          setFrontSrc(EMOTION_SRC.neutral);
          setFrontShow(true);
      }
    };

    return () => { 
        verRef.current++; 
        if (crossFadeTimerRef.current) clearTimeout(crossFadeTimerRef.current);
    };
  }, [targetSrc, frontSrc]);

  // 3. Logic Kedip (Blink)
  useEffect(() => {
    let stopped = false;
    const timers: number[] = []; 

    const addTimer = (ms: number, fn: () => void) => {
        const id = setTimeout(fn, ms) as unknown as number;
        timers.push(id);
    };

    const runCycle = () => {
      if (stopped) return;
      
      if (state.wink) {
        setOverlay(WINK_SRC);
        addTimer(150, () => setOverlay(null));
        addTimer(2000, runCycle);
      } else if (state.blink) {
        const randomDelay = 2000 + Math.random() * 3000; 
        addTimer(randomDelay, () => {
          if (stopped) return; 
          setOverlay(BLINK_SRC);
          addTimer(150, () => setOverlay(null));
          addTimer(100, runCycle); 
        });
      } else {
        addTimer(3000, runCycle);
      }
    };

    runCycle();
    return () => { stopped = true; timers.forEach(clearTimeout); };
  }, [state.blink, state.wink]);

  // 4. Logic Goyang Kepala (Head Sway)
  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    let t = 0, raf = 0;
    
    const loop = () => {
      t += 0.02 * state.headSwaySpeed; 
      // Gerakan diperhalus biar gak mabok di layar kecil
      const tx = Math.sin(t) * 1.2; 
      const ty = Math.cos(t / 1.5) * 0.8;
      
      el.style.transform = `translate3d(${tx}px, ${ty}px, 0)`;
      raf = requestAnimationFrame(loop);
    };
    
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf); 
  }, [state.headSwaySpeed]);

  // --- STYLING INLINE (Biar Kebal CSS Luar) ---
  const styles: { [key: string]: React.CSSProperties } = {
    frame: {
      position: 'relative',
      width: '100%',
      height: '100%',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      // overflow: 'hidden', // Opsional: aktifkan kalau goyangnya keluar batas
    },
    img: {
      position: 'absolute',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      objectFit: 'contain', // INI KUNCINYA: Gambar gak bakal kepotong!
      pointerEvents: 'none', // Biar gak bisa di-drag user (jelek di HP)
      userSelect: 'none',
      transition: 'opacity 0.2s ease-in-out', // Transisi halus
    },
    glow: {
      position: 'absolute',
      bottom: '10%',
      left: '50%',
      transform: 'translateX(-50%)',
      width: '60%',
      height: '20px',
      borderRadius: '50%',
      backgroundColor: state.glow,
      filter: 'blur(20px)',
      opacity: typing ? 0.6 : 0,
      transition: 'opacity 0.3s ease',
      zIndex: -1 // Di belakang avatar
    }
  };

  return (
    <div className="avatar-frame" ref={frameRef} style={styles.frame}>
      {/* Glow Effect (Pindah ke belakang biar estetik) */}
      <div style={styles.glow} />

      {/* Gambar Belakang */}
      <img 
        src={backSrc} 
        alt="avatar-back" 
        style={styles.img}
      />
      
      {/* Gambar Depan */}
      <img 
        src={frontSrc} 
        alt="avatar-front" 
        style={{...styles.img, opacity: frontShow ? 1 : 0}}
      />
      
      {/* Overlay (Mata) */}
      {overlay && (
        <img 
            src={overlay} 
            alt="blink-overlay" 
            style={{...styles.img, zIndex: 10}}
        />
      )}
    </div>
  );
}