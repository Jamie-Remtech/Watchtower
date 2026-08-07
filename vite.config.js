import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Unique id per production build. The app compares its baked-in id against
// the deployed /version.json to detect that a newer build was published.
const buildId = Date.now().toString(36)

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'watchtower-version',
      apply: 'build',
      generateBundle() {
        this.emitFile({
          type: 'asset',
          fileName: 'version.json',
          source: JSON.stringify({ build: buildId }),
        })
      },
    },
  ],
  define: {
    __BUILD_ID__: JSON.stringify(buildId),
  },
  server: {
    // Bind IPv4 explicitly — on some Windows setups Vite otherwise only
    // listens on IPv6 [::1], and browsers hitting 127.0.0.1 get refused.
    host: '127.0.0.1',
    port: 5173,
  },
})
