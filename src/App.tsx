import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { DocsPage } from './components/DocsPage';
import { LoadingOverlay } from './components/LoadingOverlay';
import { useState, useEffect, Suspense, lazy, useCallback } from 'react';
import { SpeedInsights } from "@vercel/speed-insights/react"
import { Analytics } from "@vercel/analytics/react"
import { Loader2 } from 'lucide-react';
import { parseAreaToken, parseClassicToken, parsePlaceToken, parseSharedPoint } from './lib/shareLocation';

// Lazy load heavy map component
const MapDashboard = lazy(() => import('./components/MapDashboard').then(module => ({ default: module.MapDashboard })));
const ReviewsPage = lazy(() => import('./components/ReviewsPage').then(module => ({ default: module.ReviewsPage })));
const FaqPage = lazy(() => import('./components/FaqPage').then(module => ({ default: module.FaqPage })));
const TermsPage = lazy(() => import('./components/TermsPage').then(module => ({ default: module.TermsPage })));
const PrivacyPage = lazy(() => import('./components/PrivacyPage').then(module => ({ default: module.PrivacyPage })));
const DeleteAccountPage = lazy(() => import('./components/DeleteAccountPage').then(module => ({ default: module.DeleteAccountPage })));

function App() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  // Use session storage to prevent splash screen from showing again on refresh/navigation if desired
  // But for now, let's keep it simple. If "reloading twice" happens, it might be due to strict mode or mounting issues.
  const [isLoading, setIsLoading] = useState(true);
  // A shared location link (/?at=lat,lng) opens the map at that point
  const [initialLocation, setInitialLocation] = useState<[number, number] | null>(() => {
    const shared = parseSharedPoint(window.location.search);
    return shared ? [shared.lng, shared.lat] : null;
  });

  useEffect(() => {
    // We defer geolocation to user interaction (handleStart) to follow best practices
  }, []);

  const handleStart = useCallback(() => {
    // Request geolocation when user explicitly starts the app (not when opening a shared
    // location link: the map flies there, and a late GPS fix would pull it away)
    const opensSharedLink =
      parsePlaceToken(window.location.search) || parseAreaToken(window.location.search) || parseClassicToken(window.location.search);
    if (!initialLocation && !opensSharedLink && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setInitialLocation([position.coords.longitude, position.coords.latitude]);
        },
        (error) => console.warn("Geolocation error:", error),
        { enableHighAccuracy: true, timeout: 5000 }
      );
    }
    setIsLoading(false);
  }, [initialLocation]);

  return (
    <>
      <SpeedInsights />
      <Analytics />

      {/* The start screen is for the map only; content pages open directly */}
      {isLoading && pathname === '/' && <LoadingOverlay onComplete={handleStart} />}

      {/* The map mounts right away, under the start screen, so its heavy first load happens
          while the start screen is shown. Waiting for "Start" made the first taps on the
          panel (e.g. Sign In) feel stuck while the map was still loading. */}
      <Suspense fallback={
            <div className="fixed inset-0 flex items-center justify-center bg-ink/40 text-ink">
                <Loader2 size={32} className="animate-spin text-forest-700" />
            </div>
        }>
            <Routes>
            <Route path="/" element={<MapDashboard initialLocation={initialLocation} />} />
            <Route path="/docs" element={<DocsPage onBack={() => navigate('/')} />} />
            <Route path="/reviews" element={<ReviewsPage />} />
            <Route path="/faq" element={<FaqPage />} />
            <Route path="/terms" element={<TermsPage />} />
            <Route path="/privacy" element={<PrivacyPage />} />
            <Route path="/delete-account" element={<DeleteAccountPage />} />
            </Routes>
      </Suspense>
    </>
  );
}

export default App;
