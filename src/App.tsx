import { Routes, Route, useNavigate } from 'react-router-dom';
import { MapDashboard } from './components/MapDashboard';
import { DocsPage } from './components/DocsPage';
import { LoadingOverlay } from './components/LoadingOverlay';
import { SEO } from './components/SEO';
import { useState } from 'react';
import { SpeedInsights } from "@vercel/speed-insights/next"

function App() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);

  return (
    <>
      <SEO />
      <SpeedInsights />
      <LoadingOverlay onComplete={() => setIsLoading(false)} />
      {!isLoading && (
        <Routes>
          <Route path="/" element={<MapDashboard />} />
          <Route path="/docs" element={<DocsPage onBack={() => navigate('/')} />} />
        </Routes>
      )}
    </>
  );
}

export default App;
