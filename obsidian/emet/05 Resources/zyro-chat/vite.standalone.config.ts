// Builds a single self-contained HTML file (dist-standalone/index.html)
// that opens with a double-click, no server or internet needed.
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'

export default defineConfig({
  plugins: [react(), viteSingleFile()],
  build: { outDir: 'dist-standalone', target: 'es2020', chunkSizeWarningLimit: 5000, assetsInlineLimit: 100_000_000 },
})
