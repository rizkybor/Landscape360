/// <reference types="vitest" />
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

const inlineCss = (): Plugin => {
  return {
    name: 'inline-css',
    apply: 'build',
    enforce: 'post',
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        if (!ctx.bundle) return html
        
        const cssAssets = Object.keys(ctx.bundle).filter(key => key.endsWith('.css'))
        let newHtml = html
        
        for (const cssFile of cssAssets) {
          const chunk = ctx.bundle[cssFile]
          if (chunk.type === 'asset' && typeof chunk.source === 'string') {
            // Only inline if the CSS file is explicitly linked in the HTML
            const linkRegex = new RegExp(`<link[^>]*href=["']\\/?${cssFile}["'][^>]*>`, 'g')
            if (linkRegex.test(newHtml)) {
              newHtml = newHtml.replace(linkRegex, '')
              newHtml = newHtml.replace(
                '</head>', 
                `<style>${chunk.source}</style></head>`
              )
              // Only delete from bundle if we inlined it
              delete ctx.bundle[cssFile]
            }
          }
        }
        return newHtml
      }
    }
  }
}

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
        enabled: true,
        type: 'module',
      }
    }),
    inlineCss()
  ],
  build: {
    sourcemap: false, // Disable sourcemaps for production
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
