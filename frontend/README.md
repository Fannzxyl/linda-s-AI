# Frontend – Alfan Chat UI

React + Vite interface with a streaming chat view and animated anime avatar.

## Setup

```bash
npm install
```

Copy `.env.example` to `.env` if you need to change the backend endpoint (defaults to `http://localhost:8000`).

## Development

```bash
npm run dev
```

The dev server runs at `http://localhost:5173`.

## Build & Preview

```bash
npm run build
npm run preview
```

## Avatar Calibration

- Open the “Kalibrasi” pill on the avatar panel to reveal the dev controls or press **Kalibrasi Ulang Mata** to reset and show the panel.
- Adjust X/Y sliders for each eye plus pupil radius until the SVG pupils line up with the underlying image.
- Settings persist automatically in `localStorage`. Click “Reset” to return to the defaults.

## Streaming Chat

- Messages stream token-by-token using an SSE client implemented in `src/lib/sse.ts`. The typing bubble now animates dots while the backend streams.
- Use the **Gaya bicara** selector to send an extra persona hint to the backend. Hit **Clear Chat** to wipe the local conversation history.

Ensure the backend FastAPI server is running locally before sending a message.
