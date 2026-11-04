import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Only scan the real app entry (not the standalone HTML copy in this folder)
  optimizeDeps: { entries: ['index.html'] },
  build: {
    target: 'es2020',
    // three.js is lazy-loaded with the hero scene (React.lazy), so it never blocks first paint
    chunkSizeWarningLimit: 1100,
    rollupOptions: {
      output: {
        manualChunks: {
          motion: ['framer-motion'],
        },
      },
    },
  },
})
