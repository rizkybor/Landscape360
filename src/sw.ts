import { cleanupOutdatedCaches, precacheAndRoute, createHandlerBoundToURL } from 'workbox-precaching';
import { clientsClaim } from 'workbox-core';
import { registerRoute, NavigationRoute } from 'workbox-routing';
import { StaleWhileRevalidate, CacheFirst } from 'workbox-strategies';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { ExpirationPlugin } from 'workbox-expiration';
import { getTile } from './utils/offline-db'; // Custom DB for Map Tiles

// 1. PRECACHE MANIFEST
cleanupOutdatedCaches();
// @ts-expect-error - __WB_MANIFEST is injected by Workbox
precacheAndRoute(self.__WB_MANIFEST);

// 2. LIFECYCLE
self.addEventListener('install', () => {
  // @ts-expect-error - skipWaiting exists on ServiceWorkerGlobalScope
  self.skipWaiting();
});

self.addEventListener('activate', () => {
  clientsClaim();
});

// 3. NAVIGATION FALLBACK (SPA)
// Serve index.html for navigation requests that don't match precached files
const handler = createHandlerBoundToURL('/index.html');
const navigationRoute = new NavigationRoute(handler, {
  denylist: [
    new RegExp('^\\/_'), // Exclude internal routes
    new RegExp('\\/[^\\/]+\\.[^\\/]+$'), // Exclude files with extensions
  ],
});
registerRoute(navigationRoute);

// 4. MAP TILES (Custom Offline Strategy)
// Intercept Mapbox Tile requests -> Check IndexedDB first -> Network Fallback
const isMapboxTile = ({ url }: { url: URL }) => {
  return url.href.includes('/mapbox.satellite/') || 
         url.href.includes('/mapbox.mapbox-terrain-dem-v1/') ||
         url.href.includes('/mapbox.mapbox-streets-v8/') ||
         url.href.includes('/mapbox.mapbox-outdoors-v12/');
};

registerRoute(
  isMapboxTile,
  async ({ request, url }) => {
    try {
      // A. Try Offline DB (Manual Downloaded Tiles)
      const blob = await getTile(url.href);
      if (blob) {
        return new Response(blob, {
          headers: {
            'Content-Type': blob.type,
            'X-Offline-Source': 'IndexedDB'
          }
        });
      }
    } catch (e) {
      // console.error('[SW] IDB Error:', e);
    }

    // B. Network Fallback (Live Fetch)
    try {
      const response = await fetch(request);
      return response;
    } catch (error) {
      // console.error('[SW] Network Error:', error);
      throw error;
    }
  }
);

// 5. MAPBOX ASSETS (Styles, Fonts, Sprites)
// StaleWhileRevalidate: Serve fast from cache, update in background
registerRoute(
  ({ url }) => {
    return url.origin === 'https://api.mapbox.com' && 
           (url.pathname.includes('/styles/') || 
            url.pathname.includes('/fonts/') || 
            url.pathname.includes('.json') || 
            url.href.includes('sprite')); 
  },
  new StaleWhileRevalidate({
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

// 6. STATIC ASSETS (Images, Fonts not in precache)
// CacheFirst: Once cached, never fetch again until expired
registerRoute(
  ({ request }) => request.destination === 'image' || request.destination === 'font',
  new CacheFirst({
    cacheName: 'static-resources',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 60,
        maxAgeSeconds: 30 * 24 * 60 * 60, // 30 Days
      }),
    ],
  })
);
