import React, { useEffect, useMemo, useRef, useState } from "react";

export type Emotion = "neutral" | "happy" | "sad" | "angry" | "tsun" | "excited" | "calm";
export type AvatarState = {
  emotion: Emotion;
  blink: boolean;
  wink: boolean;
  headSwaySpeed: number;
  glow: string;
};

type Props = { state: AvatarState; typing?: boolean };

// Helper untuk Path Aset yang aman (BASE_URL-friendly)
const base = (import.meta as any).env?.BASE_URL || "/";
const asset = (name: string) => `${base}linda/${name}`;

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
  
  // State internal untuk cross-fade
  const [backSrc, setBackSrc] = useState(EMOTION_SRC.neutral);
  const [frontSrc, setFrontSrc] = useState(EMOTION_SRC.neutral);
  const [frontShow, setFrontShow] = useState(true);
  const [overlay, setOverlay] = useState<string | null>(null);
  
  // Ref untuk versioning (mencegah race condition cross-fade)
  const verRef = useRef(0);
  const crossFadeTimerRef = useRef<number | null>(null);

  const targetSrc = useMemo(() => EMOTION_SRC[state.emotion] ?? EMOTION_SRC.neutral, [state.emotion]);

  // Preload Semua Gambar Awal (Cache Warming)
  useEffect(() => {
    const preload = ["netral.png", "senyum.png", "sedih.png", "wink.png", "merem.png"];
    preload.forEach((n) => {
      const img = new Image();
      img.src = asset(n);
    });
  }, []);

  // Logic Cross-fade dengan Versioning, Decode, dan Micro-delay
  useEffect(() => {
    if (crossFadeTimerRef.current) {
        clearTimeout(crossFadeTimerRef.current);
        crossFadeTimerRef.current = null;
    }
    
    if (targetSrc === frontSrc) return;
    
    const ver = ++verRef.current;
    const img = new Image();
    img.src = targetSrc;

    const apply = async () => {
      try { await img.decode?.(); } catch {}
      
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

    img.onload = apply;
    
    img.onerror = () => {
      if (ver !== verRef.current) return;
      setBackSrc(EMOTION_SRC.neutral);
      setFrontSrc(EMOTION_SRC.neutral);
      setFrontShow(true);
      console.error("Gagal memuat aset avatar:", targetSrc);
    };

    return () => { 
        verRef.current++; 
        if (crossFadeTimerRef.current) {
            clearTimeout(crossFadeTimerRef.current);
        }
    };
  }, [targetSrc, frontSrc]);

  // Logic Blink/Wink Overlay (dengan Timer Pooling untuk Stabilitas)
  useEffect(() => {
    let stopped = false;
    const timers: number[] = []; 

    const setT = (ms: number, fn: () => void) => {
        const id = setTimeout(fn, ms) as unknown as number;
        timers.push(id);
        return id;
    };

    const cycle = () => {
      if (stopped) return;
      
      if (state.wink) {
        setOverlay(WINK_SRC);
        setT(160, () => setOverlay(null));
        setT(1800, cycle);
      } else if (state.blink) {
        const wait = 1800 + Math.random() * 2200; 
        setT(wait, () => {
          if (stopped) return; 
          setOverlay(BLINK_SRC);
          setT(120, () => setOverlay(null));
          setT(600, cycle); 
        });
      } else {
        setT(2000, cycle);
      }
    };

    cycle();

    // Cleanup: Bersihkan semua timeout (PENTING untuk Strict Mode)
    return () => { 
        stopped = true; 
        timers.forEach(clearTimeout); 
    };
  }, [state.blink, state.wink]);

  // Perbaikan Logic Head Sway (Mengatasi "Diem terus")
  // Menggunakan style inline untuk Head Sway agar lebih reaktif dan tidak terpengaruh CSS.
  // Transformasi dilakukan pada elemen root .avatar-frame.
  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    let t = 0, raf = 0;
    
    const loop = () => {
      // Kecepatan goyangan diatur oleh state.headSwaySpeed
      t += 0.015 * state.headSwaySpeed; 
      // Goyangan kecil (0.6px horizontal, 0.8px vertical)
      const tx = Math.sin(t) * 0.6;
      const ty = Math.cos(t / 1.6) * 0.8;
      
      // Update Transform
      el.style.transform = `translate3d(${tx}px, ${ty}px, 0)`;
      
      raf = requestAnimationFrame(loop);
    };
    
    // Pastikan raf dibatalkan saat cleanup
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf); 
  }, [state.headSwaySpeed]);

  return (
    <div className="avatar-frame" ref={frameRef}>
      {/* Gambar Belakang: Selalu terlihat */}
      <img src={backSrc} alt="linda-back" className="avatar-img back" draggable={false} 
           onError={(e) => {(e.currentTarget as HTMLImageElement).src = EMOTION_SRC.neutral;}} />
      
      {/* Gambar Depan: Transisi fade (show/hide) */}
      <img src={frontSrc} alt="linda-front" className={`avatar-img front ${frontShow ? "show" : "hide"}`} draggable={false}
           onError={(e) => {(e.currentTarget as HTMLImageElement).src = EMOTION_SRC.neutral;}} />
      
      {/* Overlay: Blink/Wink */}
      {overlay && <img src={overlay} alt="overlay" className="avatar-overlay show" draggable={false} 
                       onError={(e) => {(e.currentTarget as HTMLImageElement).style.display = "none";}} />}
      
      {/* Glow Mengetik */}
      <div className="avatar-speaking" style={{ opacity: typing ? 1 : 0 }} />
    </div>
  );
}

