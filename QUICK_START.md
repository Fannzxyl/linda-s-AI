# 🚀 QUICK START GUIDE - Enhanced Linda AI

## Installation & Run (Unchanged)

```bash
# Backend
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload

# Frontend
cd frontend
npm install
npm run dev
```

Open: http://localhost:5173

---

## ⌨️ Keyboard Shortcuts Cheat Sheet

| Shortcut | Action |
|----------|--------|
| `Ctrl+K` | Focus input box |
| `Ctrl+L` | Clear chat (with confirmation) |
| `Ctrl+E` | Export chat as TXT |
| `Ctrl+Shift+E` | Export chat as JSON |
| `Ctrl+,` | Toggle settings panel |
| `Enter` | Send message |
| `Shift+Enter` | New line in message |

---

## 🎛️ Header Buttons

| Button | Function |
|--------|----------|
| 📊 | Toggle statistics panel |
| 💾 | Export chat (TXT) |
| ⚙️ | Toggle settings panel |

---

## 💭 Mood System

**How it works:**
- Calculates Linda's mood (0-100)
- Based on: time since last chat, interaction count, time of day, your mood
- Shows emoji + progress bar
- Gives special greetings when you return

**Toggle:**
Settings (⚙️) → Toggle "💭 Mood System"

**Mood Levels:**
- 😊 80-100: Very Happy
- 🙂 60-79: Happy
- 😐 40-59: Neutral
- 😔 20-39: Sad
- 😢 0-19: Very Sad

---

## ⚠️ Error Handling

When errors occur:
1. Linda shows error message (persona-based)
2. Error banner appears with details
3. Click **🔄 Coba Lagi** to retry
4. Click **✕** to dismiss

**Error Types:**
- Network error (no internet)
- API error (server down)
- Rate limit (too many requests)
- Invalid input (bad request)

---

## 📥 Export Chat

**Via Button:**
- Click 💾 in header (TXT format)
- Click "📥 Export" in sidebar
  - Dropdown for TXT or JSON

**Via Keyboard:**
- `Ctrl+E` → TXT file
- `Ctrl+Shift+E` → JSON file

**Export Format:**
```
=== Chat dengan Linda ===
Gaya Bicara: Tsundere
Tanggal: 14/11/2025 11:17:02

Kamu:
Halo Linda!

Linda:
Hmph... kamu datang juga...
```

---

## 📊 Statistics

Click 📊 button to see:
- Your messages count
- Linda's messages count
- Total words
- Images sent

Updates in real-time!

---

## 🎨 Persona-Specific Features

Each persona has unique:
- **Error Messages**: Different tone per persona
- **Mood Greetings**: Personality-based responses
- **Colors**: UI adapts to persona theme

**Example (Tsundere mood greeting):**
```
Mood > 80: "Hmph... kamu datang juga akhirnya. Aku... aku senang kok! (>///<)"
Mood < 20: "...kamu lupa sama aku ya? Hmph! Terserah deh! (>__<)"
```

---

## 💾 Data Storage

**What's saved in localStorage:**
- `chatHistory` - All messages
- `styleName` - Selected persona
- `moodEnabled` - Mood system on/off
- `lastInteraction` - Last chat timestamp

**Clear data:**
```javascript
// In browser console
localStorage.clear();
location.reload();
```

---

## 🐛 Troubleshooting

### Chat tidak tersimpan
- Check browser localStorage quota
- Try clear old data
- Use Incognito if needed

### Mood tidak update
- Toggle off and on in settings
- Check lastInteraction timestamp
- Refresh page

### Export tidak work
- Check browser download settings
- Allow downloads from localhost
- Try different format (TXT vs JSON)

### Keyboard shortcuts tidak work
- Click anywhere on page first
- Check if input is focused (Ctrl+K)
- Refresh page

---

## 🎯 Best Practices

1. **Export regularly** - Backup your conversations
2. **Use keyboard shortcuts** - Faster workflow
3. **Enable mood system** - More immersive experience
4. **Check stats periodically** - Track your interactions
5. **Read error messages** - Linda gives helpful hints!

---

## 🔧 Advanced Tips

### Customize Mood Algorithm
Edit `utils/moodSystem.ts`:
```typescript
// Change base mood
let moodLevel = 70; // default is 70

// Adjust time penalties
if (hoursSinceLastChat > 24) {
  moodLevel -= 30; // change this value
}
```

### Customize Error Messages
Edit `utils/errorHandler.ts`:
```typescript
export function getLindasErrorResponse(errorInfo: ErrorInfo, persona: string): string {
  // Add your custom messages here
}
```

### Add More Shortcuts
Edit `utils/keyboardShortcuts.ts`:
```typescript
// Add new shortcut
if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
  e.preventDefault();
  handler('your_action');
}
```

---

## 📚 Documentation Files

- `ENHANCED_FEATURES.md` - Complete feature guide
- `IMPLEMENTATION_SUMMARY.md` - Technical details
- `QUICK_START.md` - This file!

---

Happy chatting with Linda! 💖✨
