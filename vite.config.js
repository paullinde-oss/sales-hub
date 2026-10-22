import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
 
export default defineConfig({
  plugins: [react()],
  base: '/sales-hub/',
  build: {
    outDir: 'dist',
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
        entryFileNames: 'app.js',
        chunkFileNames: 'app.js',
        // the PDF reader's worker gets its own name so it doesn't collide with app.js
        assetFileNames: info => (info.name || '').includes('pdf.worker') ? 'pdf.worker.js' : 'app.[ext]'
      }
    }
  }
})
 
