// utils/keyboardShortcuts.ts - Keyboard shortcuts handler

export type ShortcutAction = 
  | 'focus_input'
  | 'clear_chat'
  | 'export_txt'
  | 'export_json'
  | 'toggle_settings';

export type ShortcutHandler = (action: ShortcutAction) => void;

export function setupKeyboardShortcuts(handler: ShortcutHandler): () => void {
  const keyHandler = (e: KeyboardEvent) => {
    // Ctrl+K or Cmd+K: Focus input
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      handler('focus_input');
    }

    // Ctrl+L or Cmd+L: Clear chat
    if ((e.ctrlKey || e.metaKey) && e.key === 'l') {
      e.preventDefault();
      handler('clear_chat');
    }

    // Ctrl+E or Cmd+E: Export as text
    if ((e.ctrlKey || e.metaKey) && e.key === 'e') {
      e.preventDefault();
      handler('export_txt');
    }

    // Ctrl+Shift+E: Export as JSON
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'E') {
      e.preventDefault();
      handler('export_json');
    }

    // Ctrl+, or Cmd+,: Toggle settings
    if ((e.ctrlKey || e.metaKey) && e.key === ',') {
      e.preventDefault();
      handler('toggle_settings');
    }
  };

  window.addEventListener('keydown', keyHandler);
  
  // Return cleanup function
  return () => window.removeEventListener('keydown', keyHandler);
}

export const SHORTCUTS_HELP = [
  { keys: 'Ctrl+K', action: 'Focus input' },
  { keys: 'Ctrl+L', action: 'Clear chat' },
  { keys: 'Ctrl+E', action: 'Export chat (TXT)' },
  { keys: 'Ctrl+Shift+E', action: 'Export chat (JSON)' },
  { keys: 'Enter', action: 'Send message' },
  { keys: 'Shift+Enter', action: 'New line' },
];
