import React, { useEffect, useMemo, useRef, useState } from "react";
import type { Expression } from "../utils/emotionMap";
import LINDA from "../config/linda.config";

// smoothing pakai barisan geometri
function smooth(cur:number, target:number, r=0.9){ return cur+(target-cur)*(1-r); }

type Props = {
  expr: Expression;             // neutral | blink | wink | smile | sad
  typing?: boolean;             // mulut bergerak saat ngetik
  size?: number;                // px
};

export default function AvatarEmotion({ expr, typing=false, size=360 }: Props){
  const wrap = useRef<HTMLDivElement>(null);
  const [eye, setEye] = useState({x:0,y:0});
  const [rot, setRot] = useState(0);
  const [bob, setBob] = useState(0);

  // mapping ekspresi → file
  const src = useMemo(()=>{
    const f = LINDA.files;
    switch (expr) {
      case "blink": return f.blink;
      case "wink":  return f.wink;
      case "smile": return f.smile;
      case "sad":   return f.sad;
      default:      return f.neutral;
    }
  }, [expr]);

  // follow pointer + idle sway + bob
  useEffect(()=>{
    const el = wrap.current; if(!el) return;
    const target = {x:0,y:0}; const cur = {x:0,y:0};
    let t=0, raf=0;

    const onMove=(cx:number, cy:number)=>{
      const r = el.getBoundingClientRect();
      const nx = (cx - (r.left + r.width/2)) / (r.width/2);
      const ny = (cy - (r.top + r.height/2)) / (r.height/2);
      target.x = Math.max(-1, Math.min(1, nx));
      target.y = Math.max(-1, Math.min(1, ny));
    };
    const mm=(e:MouseEvent)=>onMove(e.clientX,e.clientY);
    const tm=(e:TouchEvent)=>{ const tt=e.touches[0]; if(tt) onMove(tt.clientX,tt.clientY); };
    el.addEventListener("mousemove", mm);
    el.addEventListener("touchmove", tm, {passive:true});

    const loop=()=>{
      t += 0.016 * LINDA.idleSway;
      cur.x = smooth(cur.x, target.x, 0.88);
      cur.y = smooth(cur.y, target.y, 0.88);
      setBob(Math.sin(t*0.9)*2);
      setRot(Math.sin(t*0.6)*1.2 + cur.x*3);
      setEye({x:cur.x*8, y:cur.y*5});
      raf = requestAnimationFrame(loop);
    };
    raf=requestAnimationFrame(loop);
    return ()=>{
      cancelAnimationFrame(raf);
      el.removeEventListener("mousemove", mm);
      el.removeEventListener("touchmove", tm);
    };
  },[]);

  const sWrap:React.CSSProperties = { width:size, height:size, position:"relative", filter:"drop-shadow(0 0 18px rgba(167,139,250,.65))" };
  const sImg:React.CSSProperties = {
    position:"absolute", inset:0, width:"100%", height:"100%", objectFit:"contain",
    transform:`translateY(${bob}px) rotate(${rot}deg)`, transition:"transform .06s linear"
  };

  return (
    <div ref={wrap} style={sWrap}>
      <img src={src} alt="Linda" style={sImg}/>
      {/* pupil offset simulasi kecil (opsional, karena render PNG utuh) */}
      <div style={{
        position:"absolute", inset:0, pointerEvents:"none",
        transform:`translate(${eye.x*0.15}px, ${eye.y*0.15}px)`,
        transition:"transform .12s ease-out"
      }}/>
      {/* mulut bicara */}
      <div style={{
        position:"absolute", left:"50%", top:"64%",
        width:"18%", height:"6%", transform:"translateX(-50%)",
        borderRadius:999, opacity: typing ? .85 : 0,
        background:"radial-gradient(60% 100% at 50% 30%, #f4c7cf 0%, #f3b0bd 70%, transparent 72%)",
        animation: typing ? "talk .14s ease-in-out infinite" : "none"
      }}/>
      <style>
        {`@keyframes talk{0%{transform:translateX(-50%) scaleY(1)}50%{transform:translateX(-50%) scaleY(1.35)}100%{transform:translateX(-50%) scaleY(1)}}`}
      </style>
    </div>
  );
}