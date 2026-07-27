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
        lang: 'en',
        categories: ['travel', 'food', 'lifestyle'],
        theme_color: '#ffffff',
        background_color: '#ffffff',
        display: 'standalone',
        // The layout adapts to landscape, so let an installed app rotate.
        orientation: 'any',
        // Relative, so the same manifest is correct at "/" locally and under
        // the "/curated/" subpath on Pages.
        id: '.',
        start_url: '.',
        scope: '.',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          // Android crops adaptive icons to a circle, so the maskable variant
          // is a separate asset with the mark inset into the safe zone —
          // reusing the full-bleed one clipped the pin.
          { src: 'maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        // Long-pressing the installed icon exposes these.
        shortcuts: [
          {
            name: 'Add a place',
            url: 'add',
            icons: [{ src: 'pwa-192.png', sizes: '192x192', type: 'image/png' }],
          },
          {
            name: 'Saved places',
            url: '?view=saved',
            icons: [{ src: 'pwa-192.png', sizes: '192x192', type: 'image/png' }],
          },
        ],
      },
      workbox: {
        // Precache the app shell only. Never runtime-cache map tiles or
        // geocoding responses — unbounded storage growth on mobile.
        // json covers atlas-places.json, so the imported atlas is available
        // offline like the rest of the shell.
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,json}'],
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
