import React, { useEffect, useMemo, useRef, useState } from "react";

// Definisi Tipe Data
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

// Helper: Agar gambar terbaca di Vercel/Localhost dengan benar
const base = (import.meta as any).env?.BASE_URL || "/";
// Pastikan kamu punya folder "linda" di dalam folder "public"
const asset = (name: string) => `${base}linda/${name}`;

// Mapping Emosi ke File Gambar
const EMOTION_SRC: Record<Emotion, string> = {
  neutral: asset("netral.png"),
  happy: asset("senyum.png"),
  sad: asset("sedih.png"),
  angry: asset("netral.png"), // Kalau tidak ada angry.png, pakai netral
  tsun: asset("wink.png"),    // Tsundere sering wink/malu
  excited: asset("senyum.png"),
  calm: asset("netral.png"),
};

const WINK_SRC = asset("wink.png");
const BLINK_SRC = asset("merem.png");

export default function Avatar({ state, typing = false }: Props) {
  const frameRef = useRef<HTMLDivElement>(null);
  
  // State untuk animasi transisi halus (Cross-fade)
  const [backSrc, setBackSrc] = useState(EMOTION_SRC.neutral);
  const [frontSrc, setFrontSrc] = useState(EMOTION_SRC.neutral);
  const [frontShow, setFrontShow] = useState(true);
  const [overlay, setOverlay] = useState<string | null>(null);
  
  const verRef = useRef(0);
  const crossFadeTimerRef = useRef<number | null>(null);

  // Tentukan gambar target berdasarkan emosi
  const targetSrc = useMemo(() => EMOTION_SRC[state.emotion] ?? EMOTION_SRC.neutral, [state.emotion]);

  // 1. Preload Gambar agar tidak kedip putih saat ganti ekspresi
  useEffect(() => {
    const preloadList = ["netral.png", "senyum.png", "sedih.png", "wink.png", "merem.png"];
    preloadList.forEach((n) => {
      const img = new Image();
      img.src = asset(n);
    });
  }, []);

  // 2. Logika Ganti Ekspresi (Cross-Fade)
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
      try { await img.decode(); } catch {} // Tunggu gambar siap decode
      
      if (ver !== verRef.current) return; // Cegah race condition
      
      // Set gambar belakang jadi gambar depan yg sekarang (biar mulus)
      setBackSrc(frontSrc);
      setFrontSrc(targetSrc);
      setFrontShow(false); // Sembunyikan depan sebentar buat transisi
      
      // Munculkan perlahan
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
      console.error("Gagal memuat gambar:", targetSrc);
      // Fallback ke netral kalau gambar rusak
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

  // 3. Logika Kedip (Blink) & Wink Otomatis
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
        // Mode Wink (ngedip satu mata terus)
        setOverlay(WINK_SRC);
        addTimer(150, () => setOverlay(null));
        addTimer(2000, runCycle);
      } else if (state.blink) {
        // Mode Blink (ngedip normal acak)
        const randomDelay = 2000 + Math.random() * 3000; 
        addTimer(randomDelay, () => {
          if (stopped) return; 
          setOverlay(BLINK_SRC);
          addTimer(150, () => setOverlay(null));
          addTimer(100, runCycle); 
        });
      } else {
        // Kalau dimatikan blinknya
        addTimer(3000, runCycle);
      }
    };

    runCycle();

    return () => { 
        stopped = true; 
        timers.forEach(clearTimeout); 
    };
  }, [state.blink, state.wink]);

  // 4. Efek Goyang Kepala (Head Sway)
  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    let t = 0, raf = 0;
    
    const loop = () => {
      t += 0.02 * state.headSwaySpeed; 
      // Gerakan memutar kecil
      const tx = Math.sin(t) * 1.5;
      const ty = Math.cos(t / 1.5) * 1.0;
      
      el.style.transform = `translate3d(${tx}px, ${ty}px, 0)`;
      raf = requestAnimationFrame(loop);
    };
    
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf); 
  }, [state.headSwaySpeed]);

  return (
    <div className="avatar-frame" ref={frameRef}>
      {/* Gambar Belakang (Static) */}
      <img 
        src={backSrc} 
        alt="avatar-back" 
        className="avatar-img back" 
        draggable={false} 
      />
      
      {/* Gambar Depan (Fade In/Out) */}
      <img 
        src={frontSrc} 
        alt="avatar-front" 
        className={`avatar-img front ${frontShow ? "show" : "hide"}`} 
        draggable={false}
      />
      
      {/* Overlay (Mata Merem/Wink) */}
      {overlay && (
        <img 
            src={overlay} 
            alt="blink-overlay" 
            className="avatar-overlay show" 
            draggable={false} 
        />
      )}
      
      {/* Efek Glow saat mengetik */}
      <div 
        className="avatar-speaking" 
        style={{ opacity: typing ? 1 : 0, boxShadow: `0 0 20px ${state.glow}` }} 
      />
    </div>
  );
}