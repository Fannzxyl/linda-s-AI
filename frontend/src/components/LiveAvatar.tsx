import React, { useEffect, useRef, useState } from "react";
import type { AvatarState } from "../types/avatar";

type Props = { state: AvatarState; typing?: boolean };

export default function LiveAvatar({ state, typing=false }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);
  const [eyeOpen, setEyeOpen] = useState(1);
  const cur = useRef({ x:0, y:0, vx:0, vy:0 });

  useEffect(() => {
    let raf = 0; const k = 0.12, d = 0.85;
    const loop = () => {
      const c=cur.current;
      c.vx = d * (c.vx + k * (tx - c.x));
      c.vy = d * (c.vy + k * (ty - c.y));
      c.x += c.vx; c.y += c.vy;
      const el = wrapRef.current;
      if (el){
        el.style.setProperty("--tx", String(c.x));
        el.style.setProperty("--ty", String(c.y));
        el.style.setProperty("--swaySpeed", String(state.headSwaySpeed));
        el.style.setProperty("--glow", state.glow || "#a78bfa");
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [tx, ty, state.headSwaySpeed, state.glow]);

  useEffect(() => {
    const el = wrapRef.current; if(!el) return;
    const setFrom = (cx:number, cy:number) => {
      const r = el.getBoundingClientRect();
      const nx = (cx - (r.left + r.width/2)) / (r.width/2);
      const ny = (cy - (r.top + r.height/2)) / (r.height/2);
      setTx(Math.max(-1, Math.min(1, nx)));
      setTy(Math.max(-1, Math.min(1, ny)));
    };
    const onMove = (e:MouseEvent)=>setFrom(e.clientX,e.clientY);
    const onTouch=(e:TouchEvent)=>{ const t=e.touches[0]; if(t) setFrom(t.clientX,t.clientY) };
    el.addEventListener("mousemove", onMove);
    el.addEventListener("touchmove", onTouch, {passive:true});
    const onGyro = (e:DeviceOrientationEvent)=>{
      const gx=(e.gamma??0)/30, gy=(e.beta??0)/45;
      setTx(Math.max(-1,Math.min(1,gx)));
      setTy(Math.max(-1,Math.min(1,gy)));
    };
    window.addEventListener("deviceorientation", onGyro);
    return ()=>{
      el.removeEventListener("mousemove", onMove);
      el.removeEventListener("touchmove", onTouch);
      window.removeEventListener("deviceorientation", onGyro);
    };
  }, []);

  useEffect(()=>{
    let stop=false;
    const tick=()=>{
      if(stop) return;
      const wait = state.wink ? 1800 : (1500 + Math.random()*3000);
      setTimeout(()=>{
        if(stop) return;
        setEyeOpen(0);
        setTimeout(()=>setEyeOpen(1), state.wink ? 220 : 120);
        tick();
      }, state.blink===false ? 999999 : wait);
    };
    tick();
    return ()=>{ stop=true };
  }, [state.blink, state.wink]);

  const ring = state.glow || "#a78bfa";

  return (
    <div ref={wrapRef} className="avatar-wrap">
      <svg viewBox="0 0 400 260" className="avatar-svg" role="img" aria-label="Live Avatar">
        <defs>
          <radialGradient id="glow" cx="50%" cy="45%">
            <stop offset="0%" stopColor={ring} stopOpacity="0.35"/>
            <stop offset="70%" stopColor="#0b1220" stopOpacity="0.05"/>
            <stop offset="100%" stopColor="#0b1220" stopOpacity="0"/>
          </radialGradient>
        </defs>

        <rect x="0" y="0" width="400" height="260" fill="url(#glow)"/>

        <g className="head">
          <g className="hair-back">
            <path d="M70,100 C120,40 280,40 330,100 C330,150 310,200 200,210 C90,200 70,150 70,100 Z" fill="#1a2340"/>
          </g>

          <g>
            <ellipse cx="200" cy="120" rx="120" ry="85" fill="#1e2747"/>
            <ellipse cx="200" cy="118" rx="118" ry="83" fill="#222d54"/>
          </g>

          <g className="hair-front">
            <path d="M120,60 C130,80 110,120 130,135" stroke="#2a3764" strokeWidth="10" strokeLinecap="round" fill="none"/>
            <path d="M280,60 C270,80 290,120 270,135" stroke="#2a3764" strokeWidth="10" strokeLinecap="round" fill="none"/>
          </g>

          <Eye x={150} y={120} open={eyeOpen}/>
          <Eye x={250} y={120} open={eyeOpen}/>

          <g className={typing ? "mouth speaking" : "mouth"}>
            <path d="M180,165 Q200,175 220,165" stroke="#f3cbd3" strokeWidth="4" fill="none" strokeLinecap="round"/>
          </g>
        </g>
      </svg>
    </div>
  );
}

function Eye({ x, y, open }: { x:number; y:number; open:number }) {
  const [p,setP]=useState({x:0,y:0});
  useEffect(()=>{
    const el=document.querySelector(".avatar-wrap") as HTMLDivElement|null;
    let raf=0;
    const read=()=>{
      if(el){
        const tx=parseFloat(getComputedStyle(el).getPropertyValue("--tx"))||0;
        const ty=parseFloat(getComputedStyle(el).getPropertyValue("--ty"))||0;
        setP({x:tx,y:ty});
      }
      raf=requestAnimationFrame(read);
    };
    raf=requestAnimationFrame(read);
    return ()=>cancelAnimationFrame(raf);
  },[]);
  const r=10, px=x+p.x*r, py=y+p.y*r;
  const lid=Math.max(0,Math.min(1,open));
  const lidScale=0.25+0.75*lid;
  return (
    <g>
      <ellipse cx={x} cy={y} rx="34" ry="24" fill="#eaf2ff"/>
      <g transform={`translate(${px-x}, ${py-y})`}>
        <circle cx={x} cy={y} r="15" fill="#6aa3ff"/>
        <circle cx={x} cy={y} r="8"  fill="#1b2a4d"/>
        <circle cx={x-4} cy={y-4} r="3" fill="#fff"/>
      </g>
      <g transform={`translate(0, ${y}) scale(1, ${lidScale}) translate(0, ${-y})`}>
        <path d={`M${x-36},${y} Q${x},${y-30} ${x+36},${y}`} stroke="#1b2342" strokeWidth="10" fill="none" strokeLinecap="round"/>
      </g>
      <g transform={`translate(0, ${y}) scale(1, ${lidScale}) translate