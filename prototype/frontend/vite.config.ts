import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The backend runs on :8000. We proxy /api and /ws so the browser talks to a
// single origin in dev -- no CORS preflight, and the WebSocket URL needs no
// separate host config.
const BACKEND = process.env.BACKEND_URL ?? 'http://localhost:8000'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: BACKEND, changeOrigin: true },
      '/ws': { target: BACKEND.replace(/^http/, 'ws'), ws: true },
    },
  },
})
