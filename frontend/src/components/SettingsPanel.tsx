// components/SettingsPanel.tsx - Settings panel with mood toggle and shortcuts

import React from "react";
import { SHORTCUTS_HELP } from "../utils/keyboardShortcuts";

type Props = {
  moodEnabled: boolean;
  onMoodToggle: (enabled: boolean) => void;
  showShortcuts?: boolean;
};

export default function SettingsPanel({ moodEnabled, onMoodToggle, showShortcuts = true }: Props) {
  return (
    <div className="settings-panel">
      <h3 className="section-title">⚙️ Pengaturan</h3>
      
      <div className="setting-item">
        <div className="setting-info">
          <label className="setting-label">💭 Mood System</label>
          <p className="setting-desc">
            Linda akan punya mood berbeda berdasarkan waktu dan interaksi kamu
          </p>
        </div>
        <label className="toggle-switch">
          <input
            type="checkbox"
            checked={moodEnabled}
            onChange={(e) => onMoodToggle(e.target.checked)}
          />
          <span className="toggle-slider"></span>
        </label>
      </div>

      {showShortcuts && (
        <div className="shortcuts-section">
          <h4 className="shortcuts-title">⌨️ Keyboard Shortcuts</h4>
          <div className="shortcuts-list">
            {SHORTCUTS_HELP.map((shortcut, i) => (
              <div key={i} className="shortcut-item">
                <kbd className="shortcut-key">{shortcut.keys}</kbd>
                <span className="shortcut-action">{shortcut.action}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
