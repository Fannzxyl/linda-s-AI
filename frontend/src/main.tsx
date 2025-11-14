import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import "./enhancements.css";

const container = document.getElementById("root");
if (!container) {
  throw new Error("Elemen #root tidak ditemukan di index.html");
}

const root = createRoot(container);

// CATATAN: <React.StrictMode> dapat menyebabkan useEffect di Avatar.tsx (yang berisi setTimeout) 
// terjalankan dua kali di mode dev. Jika transisi/blink terasa glitchy di dev,
// coba nonaktifkan StrictMode (hapus tag-nya) saat debugging loop mata/fade.
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

