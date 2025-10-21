import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    vueDevTools(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    },
  },
  server: {
    proxy: {
      // Proxy API calls during development to backend
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        // Do not rewrite since frontend will call `/api/...`
        // and backend serves under `/api` as well.
        // If backend does not include `/api` prefix, use:
        // rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
})
