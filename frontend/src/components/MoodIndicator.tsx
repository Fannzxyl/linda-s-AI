// components/MoodIndicator.tsx - Display Linda's current mood

import React from "react";
import { getMoodEmoji } from "../utils/moodSystem";

type Props = {
  moodLevel: number;
  enabled: boolean;
};

export default function MoodIndicator({ moodLevel, enabled }: Props) {
  if (!enabled) return null;

  const getMoodLabel = (level: number): string => {
    if (level >= 80) return "Sangat Senang";
    if (level >= 60) return "Senang";
    if (level >= 40) return "Biasa Aja";
    if (level >= 20) return "Sedih";
    return "Sangat Sedih";
  };

  const getMoodColor = (level: number): string => {
    if (level >= 80) return "#34d399";
    if (level >= 60) return "#60a5fa";
    if (level >= 40) return "#fbbf24";
    if (level >= 20) return "#f97316";
    return "#ef4444";
  };

  return (
    <div className="mood-indicator">
      <div className="mood-header">
        <span className="mood-emoji">{getMoodEmoji(moodLevel)}</span>
        <span className="mood-label">{getMoodLabel(moodLevel)}</span>
      </div>
      <div className="mood-bar">
        <div 
          className="mood-bar-fill" 
          style={{ 
            width: `${moodLevel}%`,
            backgroundColor: getMoodColor(moodLevel)
          }}
        />
      </div>
      <span className="mood-value">{moodLevel}/100</span>
    </div>
  );
}
