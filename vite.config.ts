import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  // Served from https://<user>.github.io/curated/ in production; "/" locally.
  base: process.env.GITHUB_PAGES === 'true' ? '/curated/' : '/',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'Curated — members atlas',
        short_name: 'Curated',
        description: 'Invite-only atlas of places worth your time, curated by people who share your taste.',
        theme_color: '#ffffff',
        background_color: '#ffffff',
        display: 'standalone',
        // The layout adapts to landscape, so let an installed app rotate.
        orientation: 'any',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Precache the app shell only. Never runtime-cache map tiles or
        // geocoding responses — unbounded storage growth on mobile.
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // The bundled guide locations make the main chunk exceed the 2 MiB
        // default; allow the app shell (still one modest download) to precache
        // in full so the atlas works offline.
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        navigateFallback: 'index.html',
        runtimeCaching: [],
      },
    }),
  ],
})
