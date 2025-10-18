import { useEffect, useMemo, useRef, useState } from "react";
import LINDA from "../config/linda.config";
import { guessExpressionFromText, Expression } from "../utils/emotionMap";

export type EmotionPayload = {
  // dari backend /api/emotion (opsional)
  emotion?: "happy"|"sad"|"angry"|"neutral"|"tsun"|"excited"|"calm";
  blink?: boolean;
  wink?: boolean;
};

export function useLindaEmotion(opts: {
  lastAssistantText: string;     // teks balasan terbaru (buat fallback)
  server?: EmotionPayload | null;
}) {
  const { lastAssistantText, server } = opts;

  // state ekspresi final yang dipakai avatar
  const [expr, setExpr] = useState<Expression>("neutral");
  const [isTyping, setIsTyping] = useState(false);

  // timer untuk auto-blink
  const blinkT = useRef<number | null>(null);

  // tentukan target ekspresi berdasarkan server → fallback teks
  const targetExpr = useMemo<Expression>(() => {
    if (server?.emotion === "happy" || server?.emotion === "excited") return "smile";
    if (server?.emotion === "sad") return "sad";
    if (server?.emotion === "tsun") return "wink";
    if (server?.emotion === "neutral" || server?.emotion === "calm") return "neutral";
    // fallback
    return guessExpressionFromText(lastAssistantText || "");
  }, [server, lastAssistantText]);

  // transisi halus: ekspresi target → expr
  useEffect(() => {
    // kalau server minta wink sekali, tampilkan 250ms lalu balik
    if (server?.wink) {
      setExpr("wink");
      const id = window.setTimeout(() => setExpr(targetExpr), 250);
      return () => window.clearTimeout(id);
    }
    setExpr(targetExpr);
  }, [targetExpr, server?.wink]);

  // auto-blink periodik (tidak ganggu ekspresi smile/sad, cuma “tutup-buka” cepat)
  useEffect(() => {
    const allowBlink = server?.blink !== false;
    const loop = () => {
      if (!allowBlink) return;
      const delay = LINDA.blinkMinMs + Math.random()*(LINDA.blinkMaxMs - LINDA.blinkMinMs);
      blinkT.current = window.setTimeout(() => {
        setExpr(prev => prev === "blink" ? "neutral" : "blink");
        // cepat buka lagi kalau sempat menutup
        if (expr !== "blink") {
          window.setTimeout(() => setExpr(targetExpr), 120);
        }
        loop();
      }, delay) as unknown as number;
    };
    loop();
    return () => { if (blinkT.current) window.clearTimeout(blinkT.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [server?.blink, targetExpr]);

  return {
    expr,         // neutral | blink | wink | smile | sad
    isTyping,
    setTyping: (v:boolean)=>setIsTyping(v),
    assets: LINDA.files,
    dir: LINDA.dir,
    sway: LINDA.idleSway,
  };
}