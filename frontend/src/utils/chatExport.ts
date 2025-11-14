// utils/chatExport.ts - Export chat functionality
import { Msg } from "../components/Chat";

export function exportChatAsText(messages: Msg[], persona: string): void {
  const timestamp = new Date().toLocaleString('id-ID');
  const header = `=== Chat dengan Linda ===\nGaya Bicara: ${persona}\nTanggal: ${timestamp}\n\n`;
  
  const chatText = messages
    .filter(m => m.role !== 'system')
    .map(m => {
      const role = m.role === 'user' ? 'Kamu' : 'Linda';
      const hasImage = m.image_url ? ' [📷 Gambar]' : '';
      return `${role}${hasImage}:\n${m.content}\n`;
    })
    .join('\n');

  const fullText = header + chatText;
  downloadAsFile(fullText, `chat-linda-${Date.now()}.txt`, 'text/plain');
}

export function exportChatAsJSON(messages: Msg[], persona: string): void {
  const exportData = {
    persona,
    exportDate: new Date().toISOString(),
    totalMessages: messages.length,
    messages: messages.map(m => ({
      role: m.role,
      content: m.content,
      hasImage: !!m.image_url
    }))
  };

  const jsonStr = JSON.stringify(exportData, null, 2);
  downloadAsFile(jsonStr, `chat-linda-${Date.now()}.json`, 'application/json');
}

function downloadAsFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
