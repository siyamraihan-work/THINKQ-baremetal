import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/auth': 'http://localhost:8080',
      '/users': 'http://localhost:8080',
      '/admin': 'http://localhost:8080',
      '/tickets': 'http://localhost:8080',
      '/analytics': 'http://localhost:8080',
      '/events': 'http://localhost:8080',
      '/queue': 'http://localhost:8080',
      '/student': 'http://localhost:8080'
    }
  }
})
