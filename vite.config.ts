/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      injectManifest: {
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024, // Increased to 10MB for larger assets
        globPatterns: ['**/*.{js,css,html,ico,png,svg,json,woff2}'], // Explicitly cache these types
        // Large modules only used on demand are cached when first used (see sw.ts) instead of
        // being downloaded by every visitor on install: basemap import (GeoTIFF, PDF,
        // reprojection), PDF export and screenshots
        globIgnores: [
          // Only the Latin subset of the brand font is used; the others stay on demand
          '**/assets/inter-cyrillic*',
          '**/assets/inter-greek*',
          '**/assets/inter-vietnamese*',
          '**/pdf.worker*',
          '**/assets/pdf-*',
          '**/assets/main-dist-*',
          '**/assets/geotiff-*',
          '**/assets/lerc-*',
          '**/assets/zstd-*',
          '**/assets/jspdf*',
          '**/assets/html2canvas*',
          '**/assets/jszip*',
        ],
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
                maxAgeSeconds: 60 * 60 * 24 * 7 // 7 days
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: /^https:\/\/events\.mapbox\.com\/.*/i,
            handler: 'NetworkOnly', // Don't cache telemetry
          }
        ]
      },
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg', 'sitemap.xml', 'robots.txt', '*.png', '*.jpg', '*.jpeg', '*.svg'],
      manifest: {
        name: 'Landscape 360',
        short_name: 'Landscape360',
        description: 'Your ultimate companion for outdoor adventures.',
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
        enabled: true,
        type: 'module',
      }
    }),
  ],
  build: {
    // No public source maps: they expose the full source code. Set to 'hidden' locally if
    // you need them to debug a production stack trace (and don't deploy the .map files).
    sourcemap: false,
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
})
