import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import './index.css'
import App from './App.tsx'

// --- GLOBAL ERROR HANDLER FOR CHUNK LOADING ---
// This handles the case where a new deployment occurs, but the user's browser
// has cached an old index.html pointing to old JS/CSS chunks that no longer exist.
window.addEventListener('vite:preloadError', (event) => {
  console.warn('Vite preload error detected. Reloading page to fetch latest version...', event);
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
