import { MutableRefObject, useEffect, useState } from "react";
import { EyeConfig } from "../config/eyes";

const BLINK_MIN = 4000;
const BLINK_MAX = 7000;
const BLINK_DURATION = 120;

type AvatarProps = {
  eyeConfig: EyeConfig;
  containerRef: MutableRefObject<HTMLDivElement | null>;
};

type EyeOffsets = {
  left: { x: number; y: number };
  right: { x: number; y: number };
};

type EyeState = EyeOffsets & { blink: number };

const randomBlinkInterval = () =>
  BLINK_MIN + Math.random() * (BLINK_MAX - BLINK_MIN);

const Avatar = ({ eyeConfig, containerRef }: AvatarProps) => {
  const [state, setState] = useState<EyeState>({
    left: { x: 0, y: 0 },
    right: { x: 0, y: 0 },
    blink: 1,
  });

  useEffect(() => {
    let animationFrame = 0;
    let blinkPhase: "idle" | "closing" | "opening" = "idle";
    let blinkStart = performance.now();
    let nextBlinkAt = performance.now() + randomBlinkInterval();
    let blinkValue = 1;
    let isMounted = true;

    const targets: EyeOffsets = {
      left: { x: 0, y: 0 },
      right: { x: 0, y: 0 },
    };
    const current: EyeOffsets = {
      left: { x: 0, y: 0 },
      right: { x: 0, y: 0 },
    };

    const updateTargets = (event: MouseEvent) => {
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const pointer = {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      };

      targets.left = clampToRadius(
        pointer,
        eyeConfig.centerLeft,
        eyeConfig.radiusMax,
      );
      targets.right = clampToRadius(
        pointer,
        eyeConfig.centerRight,
        eyeConfig.radiusMax,
      );
    };

    const resetTargets = () => {
      targets.left = { x: 0, y: 0 };
      targets.right = { x: 0, y: 0 };
    };

    const handleVisibility = () => {
      if (!document.hidden) {
        blinkPhase = "idle";
        blinkValue = 1;
        nextBlinkAt = performance.now() + randomBlinkInterval();
      }
    };

    const tick = (timestamp: number) => {
      if (timestamp >= nextBlinkAt && blinkPhase === "idle") {
        blinkPhase = "closing";
        blinkStart = timestamp;
      }

      if (blinkPhase === "closing") {
        const progress = Math.min(1, (timestamp - blinkStart) / BLINK_DURATION);
        blinkValue = 1 - progress;
        if (progress >= 1) {
          blinkPhase = "opening";
          blinkStart = timestamp;
        }
      } else if (blinkPhase === "opening") {
        const progress = Math.min(1, (timestamp - blinkStart) / BLINK_DURATION);
        blinkValue = progress;
        if (progress >= 1) {
          blinkPhase = "idle";
          blinkValue = 1;
          nextBlinkAt = timestamp + randomBlinkInterval();
        }
      }

      current.left.x += (targets.left.x - current.left.x) * 0.18;
      current.left.y += (targets.left.y - current.left.y) * 0.18;
      current.right.x += (targets.right.x - current.right.x) * 0.18;
      current.right.y += (targets.right.y - current.right.y) * 0.18;

      if (isMounted) {
        setState({
          left: { ...current.left },
          right: { ...current.right },
          blink: Math.max(0.1, Math.min(1, blinkValue)),
        });
      }

      animationFrame = requestAnimationFrame(tick);
    };

    window.addEventListener("mousemove", updateTargets);
    window.addEventListener("mouseleave", resetTargets);
    containerRef.current?.addEventListener("mouseleave", resetTargets);
    document.addEventListener("visibilitychange", handleVisibility);
    animationFrame = requestAnimationFrame(tick);

    return () => {
      isMounted = false;
      window.removeEventListener("mousemove", updateTargets);
      window.removeEventListener("mouseleave", resetTargets);
      containerRef.current?.removeEventListener("mouseleave", resetTargets);
      document.removeEventListener("visibilitychange", handleVisibility);
      cancelAnimationFrame(animationFrame);
    };
  }, [containerRef, eyeConfig]);

  const eyeRadiusX = 24;
  const eyeRadiusY = 14;
  const blinkScale = 0.25 + state.blink * 0.75;

  return (
    <svg
      width="100%"
      height="100%"
      viewBox="0 0 320 400"
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
      }}
    >
      <Eye
        center={eyeConfig.centerLeft}
        offset={state.left}
        rx={eyeRadiusX}
        ry={eyeRadiusY * blinkScale}
      />
      <Eye
        center={eyeConfig.centerRight}
        offset={state.right}
        rx={eyeRadiusX}
        ry={eyeRadiusY * blinkScale}
      />
    </svg>
  );
};

type EyeProps = {
  center: { x: number; y: number };
  offset: { x: number; y: number };
  rx: number;
  ry: number;
};

const Eye = ({ center, offset, rx, ry }: EyeProps) => {
  const highlightOffsetX = offset.x * 0.3;
  const highlightOffsetY = offset.y * 0.3;

  return (
    <g>
      <ellipse
        cx={center.x}
        cy={center.y}
        rx={rx}
        ry={Math.max(ry, 3)}
        fill="#f6f7ff"
        stroke="#cdd0e8"
        strokeWidth="1.5"
      />
      <circle
        cx={center.x + offset.x}
        cy={center.y + offset.y}
        r={9}
        fill="#3b4b7a"
      />
      <circle
        cx={center.x + offset.x}
        cy={center.y + offset.y}
        r={6}
        fill="#445ba5"
      />
      <circle
        cx={center.x + offset.x + highlightOffsetX}
        cy={center.y + offset.y + highlightOffsetY}
        r={3}
        fill="rgba(255,255,255,0.8)"
      />
    </g>
  );
};

const clampToRadius = (
  pointer: { x: number; y: number },
  center: { x: number; y: number },
  radius: number,
) => {
  const dx = pointer.x - center.x;
  const dy = pointer.y - center.y;
  const distance = Math.hypot(dx, dy);
  if (distance === 0 || distance <= radius) {
    return { x: dx, y: dy };
  }
  const scale = radius / distance;
  return { x: dx * scale, y: dy * scale };
};

export default Avatar;
