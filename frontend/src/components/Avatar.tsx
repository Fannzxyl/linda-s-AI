import React, { useEffect, useRef, useState } from "react";
import type { AvatarState } from "../types/avatar";

type Props = {
  state: AvatarState;
  typing?: boolean;
};

export default function Avatar({ state, typing = false }: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const [pupil, setPupil] = useState({ x: 0, y: 0 });
  const [blink, setBlink] = useState(1);

  // Gerakan pupil mengikuti kursor
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const onMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      const nx = (e.clientX - rect.left) / rect.width - 0.5;
      const ny = (e.clientY - rect.top) / rect.height - 0.5;
      setPupil({ x: Math.max(-1, Math.min(1, nx)), y: Math.max(-1, Math.min(1, ny)) });
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  // Animasi kedipan mata
  useEffect(() => {
    let stop = false;
    const tick = () => {
      if (stop) return;
      const delay = state.wink ? 1800 : 1800 + Math.random() * 2000;
      setTimeout(() => {
        if (stop) return;
        setBlink(0);
        setTimeout(() => setBlink(1), 150);
        tick();
      }, state.blink === false ? 999999 : delay);
    };
    tick();
    return () => { stop = true; };
  }, [state.blink, state.wink]);

  // Animasi goyang kepala
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    let t = 0;
    const loop = () => {
      t += 0.02 * state.headSwaySpeed;
      el.style.transform = `translateY(${Math.sin(t) * 2}px) rotate(${Math.sin(t / 2) * 1.5}deg)`;
      requestAnimationFrame(loop);
    };
    loop();
  }, [state.headSwaySpeed]);

  return (
    <div ref={wrap} className="avatar-wrapper" style={{
      transition: "filter .6s",
      filter: `drop-shadow(0 0 20px ${state.glow || "#a78bfa"})`
    }}>
      <svg viewBox="0 0 400 280" className="avatar-svg">
        {/* Background Glow */}
        <defs>
          <radialGradient id="bgGlow" cx="50%" cy="45%">
            <stop offset="0%" stopColor={state.glow || "#a78bfa"} stopOpacity="0.5" />
            <stop offset="70%" stopColor="transparent" />
          </radialGradient>
        </defs>
        <rect width="400" height="280" fill="url(#bgGlow)" />

        {/* Rambut belakang */}
        <path
          d="M80,130 C90,50 310,50 320,130 C320,200 270,240 200,240 C130,240 80,200 80,130 Z"
          fill="#1a2144"
        />

        {/* Kepala */}
        <ellipse cx="200" cy="150" rx="110" ry="90" fill="#20294f" />

        {/* Mata kiri */}
        <Eye x={145} y={150} blink={blink} pupil={pupil} />
        {/* Mata kanan */}
        <Eye x={255} y={150} blink={blink} pupil={pupil} />

        {/* Mulut */}
        <g className={typing ? "mouth speaking" : "mouth"}>
          <path
            d="M170,195 Q200,205 230,195"
            stroke="#f8cdd3"
            strokeWidth="4"
            fill="none"
            strokeLinecap="round"
          />
        </g>
      </svg>
    </div>
  );
}

function Eye({
  x,
  y,
  blink,
  pupil
}: {
  x: number;
  y: number;
  blink: number;
  pupil: { x: number; y: number };
}) {
  const pupilOffsetX = pupil.x * 8;
  const pupilOffsetY = pupil.y * 5;
  const scaleY = blink;

  return (
    <g>
      {/* Kelopak mata */}
      <ellipse cx={x} cy={y} rx="30" ry={20 * scaleY} fill="#e4eaff" />
      {/* Pupil */}
      <circle cx={x + pupilOffsetX} cy={y + pupilOffsetY} r="10" fill="#1b254b" />
      <circle cx={x + pupilOffsetX - 3} cy={y + pupilOffsetY - 3} r="3" fill="#fff" />
    </g>
  );
}