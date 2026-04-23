import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/auth': 'http://localhost:3001',
      '/users': 'http://localhost:3001',
      '/api/admin': 'http://localhost:3002',
      '/tickets': 'http://localhost:3003',
      '/analytics': 'http://localhost:3005',
      '/events': 'http://localhost:3004',
      '/queue': 'http://localhost:3004',
      '/student/live': 'http://localhost:3004'
    }
  }
})
