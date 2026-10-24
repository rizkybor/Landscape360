import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import './index.css'
import App from './App.tsx'

// --- PERFORMANCE: cap the pixel ratio the map renders at on phones ---
// Mapbox GL renders at window.devicePixelRatio and has no option to lower it. On a 3x
// phone screen that is 2.25x more pixels than at 2x, with no visible gain on a map, and
// keeps the GPU busy (the phone gets warm). Only JavaScript reads this value (the map,
// three.js, screenshots); text and the rest of the page still render at full sharpness.
const MAX_MOBILE_PIXEL_RATIO = 2;
if (window.matchMedia('(max-width: 767px)').matches && window.devicePixelRatio > MAX_MOBILE_PIXEL_RATIO) {
  try {
    Object.defineProperty(window, 'devicePixelRatio', {
      configurable: true,
      get: () => MAX_MOBILE_PIXEL_RATIO,
    });
  } catch {
    // Not allowed in this browser: keep the native ratio
  }
}

// --- GLOBAL ERROR HANDLER FOR CHUNK LOADING ---
// This handles the case where a new deployment occurs, but the user's browser
// has cached an old index.html pointing to old JS/CSS chunks that no longer exist.
// Not when offline (a reload cannot fetch anything new; the caller shows its own error and
// the user keeps their work) and at most once per 10 s, so a missing file cannot cause a
// reload loop.
const RELOAD_GUARD_KEY = 'l360-preload-reload-at';
window.addEventListener('vite:preloadError', (event) => {
  if (!navigator.onLine) return;
  let last = 0;
  try {
    last = Number(sessionStorage.getItem(RELOAD_GUARD_KEY)) || 0;
    if (Date.now() - last < 10_000) return;
    sessionStorage.setItem(RELOAD_GUARD_KEY, String(Date.now()));
  } catch {
    // sessionStorage blocked (private mode): still reload once below
  }
  console.warn('Vite preload error detected. Reloading page to fetch latest version...', event);
  event.preventDefault();
  window.location.reload(); // Force reload to get fresh index.html
});

// Register Service Worker after window load to avoid blocking critical path
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    import('virtual:pwa-register').then(({ registerSW }) => {
      registerSW({
        immediate: true, // Activate immediately
        onNeedRefresh() {
          console.log('New content available. Reloading...');
          // Prompt user or auto-reload. For a tracking app, auto-reload is often safer to ensure critical updates.
          // In production, we might want a toast "New version available", but for now, auto-reload on next navigation or immediately.
          // Let's reload immediately to fix the "broken app" state if they are on an old version.
          window.location.reload(); 
        },
        onOfflineReady() {
          console.log('App ready to work offline');
        },
      });
    });
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HelmetProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </HelmetProvider>
  </StrictMode>,
)
