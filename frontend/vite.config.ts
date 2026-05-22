import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return undefined
          }

          if (id.includes('react-router-dom')) {
            return 'vendor-router'
          }

          if (id.includes('react-dom') || id.includes('react')) {
            return 'vendor-react'
          }

          if (id.includes('axios')) {
            return 'vendor-http'
          }

          return 'vendor'
        },
      },
    },
  },
})
