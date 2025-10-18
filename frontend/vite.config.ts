import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Proxy semua request /api ke backend FastAPI di 8000
export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // biar kebaca di jaringan lokal kalau perlu
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api/, ""),
      },
    },
  },
});