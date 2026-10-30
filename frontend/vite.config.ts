import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Dev server proxies API, SSE and uploaded images to the FastAPI backend on :8000.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://127.0.0.1:8000', changeOrigin: true },
      '/uploads': { target: 'http://127.0.0.1:8000', changeOrigin: true },
    },
  },
  build: { chunkSizeWarningLimit: 900 },
})
