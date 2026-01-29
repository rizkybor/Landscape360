import { Routes, Route, useNavigate } from 'react-router-dom';
import { MapDashboard } from './components/MapDashboard';
import { DocsPage } from './components/DocsPage';
import { LoadingOverlay } from './components/LoadingOverlay';

function App() {
  const navigate = useNavigate();

  return (
    <>
      <LoadingOverlay />
      <Routes>
        <Route path="/" element={<MapDashboard />} />
        <Route path="/docs" element={<DocsPage onBack={() => navigate('/')} />} />
      </Routes>
    </>
  );
}

export default App;
