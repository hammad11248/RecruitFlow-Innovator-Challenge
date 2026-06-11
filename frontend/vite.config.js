import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '../', '')
  // Strip trailing /api so proxy /api/* → backend /api/* (not /api/api/*)
  const rawTarget = env.VITE_API_URL || 'http://127.0.0.1:8001'
  const apiTarget = rawTarget.replace(/\/api\/?$/, '')

  return {
    plugins: [react()],
    envDir: '../', // Load .env from project root
    build: {
      outDir: 'dist',
      emptyOutDir: true,
    },
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: true,
        },
      },
    },
  }
})
