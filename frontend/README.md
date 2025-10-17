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

- Messages stream token-by-token using an SSE client implemented in `src/lib/sse.ts`. Dots animasi muncul sebelum token pertama dan lenyap otomatis.
- Kotak input tumbuh otomatis mengikuti panjang teks dan memutar bunyi notifikasi singkat saat respons pertama kali masuk.
- Persona visual ikut berubah (filter cahaya berbeda per gaya bicara). Gunakan **Gaya bicara** untuk memilih preset, lalu tekan **Clear Chat** jika ingin mulai ulang sesi dengan Linda.

Ensure the backend FastAPI server is running locally before sending a message.
