/// <reference types="vitest" />
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "")
  const enablePwaDev = env.VITE_PWA_DEV === "true"

  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        strategies: 'injectManifest',
        srcDir: 'src',
        filename: 'sw.ts',
        injectManifest: {
          maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
          globPatterns: ['**/*.{js,css,html,ico,png,svg,json,woff2}'],
        },
        workbox: {
          cleanupOutdatedCaches: true,
          clientsClaim: true,
          skipWaiting: true,
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/api\.mapbox\.com\/.*/i,
              handler: 'NetworkFirst',
              options: {
                cacheName: 'mapbox-api-cache',
                expiration: {
                  maxEntries: 50,
                  maxAgeSeconds: 60 * 60 * 24 * 7
                },
                cacheableResponse: {
                  statuses: [0, 200]
                }
              }
            },
            {
              urlPattern: /^https:\/\/events\.mapbox\.com\/.*/i,
              handler: 'NetworkOnly',
            }
          ]
        },
        includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg', 'sitemap.xml', 'robots.txt', '*.png', '*.jpg', '*.jpeg', '*.svg'],
        manifest: {
          name: 'Landscape 360',
          short_name: 'Landscape360',
          description: '3D Landscape Survey & Mapping Tool',
          theme_color: '#000000',
          background_color: '#000000',
          icons: [
            {
              src: 'pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png'
            },
            {
              src: 'pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png'
            }
          ]
        },
        devOptions: {
          enabled: enablePwaDev,
          type: 'module',
        }
      }),
    ],
    build: {
      sourcemap: true,
      rollupOptions: {
        output: {
          manualChunks: {
            'mapbox-gl': ['mapbox-gl'],
            'three': ['three'],
            'turf': ['@turf/turf'],
            'react-vendor': ['react', 'react-dom', 'react-router-dom', 'zustand'],
          },
        },
      },
      chunkSizeWarningLimit: 2000,
    },
  }
})
