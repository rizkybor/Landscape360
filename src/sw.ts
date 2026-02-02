import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';
import { clientsClaim } from 'workbox-core';
import { registerRoute } from 'workbox-routing';
import { NetworkFirst } from 'workbox-strategies';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { ExpirationPlugin } from 'workbox-expiration';
import { getTile } from './utils/offline-db';

cleanupOutdatedCaches();
// @ts-expect-error - __WB_MANIFEST is injected by Workbox
precacheAndRoute(self.__WB_MANIFEST);

self.addEventListener('install', () => {
  // @ts-expect-error - skipWaiting exists on ServiceWorkerGlobalScope
  self.skipWaiting();
});

clientsClaim();

// 1. TILES: Intercept Mapbox Tile requests -> Check IDB first
// Matches: /v4/mapbox.satellite/ or /mapbox.mapbox-terrain-dem-v1/
const isMapboxTile = ({ url }: { url: URL }) => {
  return url.href.includes('/mapbox.satellite/') || 
         url.href.includes('/mapbox.mapbox-terrain-dem-v1/');
};

registerRoute(
  isMapboxTile,
  async ({ request, url }) => {
    try {
      // 1. Try Offline DB first
      const blob = await getTile(url.href);
      if (blob) {
        // console.log('[SW] Serving tile from IndexedDB:', url.pathname);
        return new Response(blob, {
          headers: {
            'Content-Type': blob.type,
            'X-Offline-Source': 'IndexedDB'
          }
        });
      }
    } catch (e) {
      console.error('[SW] Error reading from IndexedDB:', e);
    }

    // 2. Network Fallback
    try {
      // console.log('[SW] Fetching tile from network:', url.pathname);
      const response = await fetch(request);
      return response;
    } catch (error) {
      console.error('[SW] Network fetch failed:', error);
      throw error;
    }
  }
);

// 2. ASSETS: Cache Styles, Glyphs, Sprites automatically
// Use standard Cache Storage for these as they are small and global.
registerRoute(
  ({ url }) => {
    return url.origin === 'https://api.mapbox.com' && 
           (url.pathname.includes('/styles/') || 
            url.pathname.includes('/fonts/') || 
            url.pathname.includes('.json') || // TileJSON/Source metadata
            url.href.includes('sprite')); 
  },
  new NetworkFirst({
    cacheName: 'mapbox-assets',
    plugins: [
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
      new ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 30 * 24 * 60 * 60, // 30 Days
      }),
    ],
  })
);
