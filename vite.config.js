import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

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
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'icon-192.png', 'icon-512.png'],
      manifest: {
        id: '/',
        name: 'Watchtower',
        short_name: 'Watchtower',
        description: 'Tactical coordination hub',
        start_url: '/',
        display: 'standalone',
        background_color: '#020617',
        theme_color: '#0f172a',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Precache the app shell; live data (Supabase, weather, tiles) stays
        // network-only so nothing operational is ever served stale.
        navigateFallback: '/index.html',
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      },
    }),
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
