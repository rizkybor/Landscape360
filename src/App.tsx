import { Routes, Route, useNavigate } from 'react-router-dom';
import { DocsPage } from './components/DocsPage';
import { LoadingOverlay } from './components/LoadingOverlay';
import { SEO } from './components/SEO';
import { useState, useEffect, Suspense, lazy } from 'react';
import { SpeedInsights } from "@vercel/speed-insights/react"
import { Loader2 } from 'lucide-react';

// Lazy load heavy map component
const MapDashboard = lazy(() => import('./components/MapDashboard').then(module => ({ default: module.MapDashboard })));

function App() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [initialLocation, setInitialLocation] = useState<[number, number] | null>(null);

  useEffect(() => {
    // Start geolocation as soon as the app mounts so it's ready when user clicks Start
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setInitialLocation([position.coords.longitude, position.coords.latitude]);
        },
        (error) => console.warn("Pre-emptive geolocation error:", error),
        { enableHighAccuracy: true, timeout: 10000 }
      );
    }
  }, []);

  const handleStart = () => {
    // If we don't have location yet, try one more time quickly
    if (!initialLocation && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setInitialLocation([position.coords.longitude, position.coords.latitude]);
        },
        (error) => console.warn("Final attempt geolocation error:", error),
        { enableHighAccuracy: true, timeout: 3000 }
      );
    }
    setIsLoading(false);
  };

  return (
    <>
      <SEO />
      <SpeedInsights />
      <LoadingOverlay onComplete={handleStart} />
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
