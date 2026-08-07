import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Bind IPv4 explicitly — on some Windows setups Vite otherwise only
    // listens on IPv6 [::1], and browsers hitting 127.0.0.1 get refused.
    host: '127.0.0.1',
    port: 5173,
  },
})
