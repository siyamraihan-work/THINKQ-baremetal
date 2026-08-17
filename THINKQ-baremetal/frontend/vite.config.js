import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    // Target 127.0.0.1 explicitly rather than "localhost": on hosts where localhost
    // resolves to ::1 first, an unrelated IPv6 listener on one of these ports would
    // silently shadow the ThinkQ service. This matches nginx and the env templates,
    // which all address the backend services as 127.0.0.1.
    proxy: {
      '/auth': 'http://127.0.0.1:3001',
      '/users': 'http://127.0.0.1:3001',
      '/api/admin': 'http://127.0.0.1:3002',
      '/tickets': 'http://127.0.0.1:3003',
      '/analytics': 'http://127.0.0.1:3005',
      '/events': 'http://127.0.0.1:3004',
      '/queue': 'http://127.0.0.1:3004',
      '/student/live': 'http://127.0.0.1:3004'
    }
  }
})
