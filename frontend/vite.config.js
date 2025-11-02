import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// ✅ Replace this with your actual Replit domain:
const allowedHost = 'e4638e5d-8ef3-4904-9fd5-350805fe2597-00-oo7v1uk2fqf1.pike.replit.dev'

export default defineConfig({
  plugins: [react()],
  server: {
    allowedHosts: [allowedHost],
    host: true,
    port: 5173,
    strictPort: true,
  },
  preview: {
    allowedHosts: [allowedHost],
    host: true,
    port: 5173,
    strictPort: true,
  }
})
