// Builds the Design Lab as one self-contained HTML file (fonts and scripts inlined).
// Usage: npx vite build --config vite.lab.config.ts   → dist-lab/lab.html
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

export default defineConfig({
  plugins: [react(), viteSingleFile()],
  build: { outDir: 'dist-lab', emptyOutDir: true, rollupOptions: { input: 'lab.html' }, assetsInlineLimit: 100_000_000 },
})
