import { Routes, Route, useNavigate } from 'react-router-dom';
import { DocsPage } from './components/DocsPage';
import { LoadingOverlay } from './components/LoadingOverlay';
import { SEO } from './components/SEO';
import { useState, useEffect, Suspense, lazy, useCallback } from 'react';
import { SpeedInsights } from "@vercel/speed-insights/react"
import { Loader2 } from 'lucide-react';

// Lazy load heavy map component
const MapDashboard = lazy(() => import('./components/MapDashboard').then(module => ({ default: module.MapDashboard })));

function App() {
  const navigate = useNavigate();
  // Use session storage to prevent splash screen from showing again on refresh/navigation if desired
  // But for now, let's keep it simple. If "reloading twice" happens, it might be due to strict mode or mounting issues.
  const [isLoading, setIsLoading] = useState(true);
  const [initialLocation, setInitialLocation] = useState<[number, number] | null>(null);

  useEffect(() => {
    // We defer geolocation to user interaction (handleStart) to follow best practices
  }, []);

  const handleStart = useCallback(() => {
    // Request geolocation when user explicitly starts the app
    if (!initialLocation && navigator.geolocation) {
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
      <SEO />
      <SpeedInsights />
      
      {/* Conditionally render LoadingOverlay so it unmounts completely when done */}
      {isLoading && <LoadingOverlay onComplete={handleStart} />}
      
      {!isLoading && (
        <Suspense fallback={
            <div className="fixed inset-0 flex items-center justify-center bg-black text-white">
                <Loader2 size={32} className="animate-spin text-blue-500" />
            </div>
        }>
            <Routes>
            <Route path="/" element={<MapDashboard initialLocation={initialLocation} />} />
            <Route path="/docs" element={<DocsPage onBack={() => navigate('/')} />} />
            </Routes>
        </Suspense>
      )}
    </>
  );
}

export default App;
