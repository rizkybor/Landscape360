import { ArrowLeft, BookOpen, Layers, MousePointer, Activity } from 'lucide-react';

interface Props {
  onBack?: () => void;
}

export const DocsPage = ({ onBack }: Props) => {
  return (
    <div className="h-screen bg-gray-900 text-white font-sans overflow-hidden flex flex-col">
      {/* Header */}
      <div className="shrink-0 sticky top-0 z-50 bg-black/80 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={onBack}
              className="p-2 hover:bg-white/10 rounded-full transition-colors text-gray-400 hover:text-white"
            >
              <ArrowLeft size={20} />
            </button>
            <div className="flex items-center gap-2">
               <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow-lg shadow-blue-500/20">
                 <BookOpen size={16} className="text-white" />
               </div>
               <h1 className="text-xl font-bold">Documentation</h1>
            </div>
          </div>
          <span className="text-xs font-mono text-blue-400 border border-blue-500/30 px-2 py-1 rounded bg-blue-500/10">v1.0 Pro</span>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="max-w-4xl mx-auto px-6 py-12 space-y-16">
          
          {/* Intro */}
        <section className="space-y-4">
          <h2 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-white">
            GeoPortal 360 User Guide
          </h2>
          <p className="text-xl text-gray-400 leading-relaxed">
            Welcome to the comprehensive guide for GeoPortal 360. This platform provides professional-grade terrain visualization, contour analysis, and survey plotting tools directly in your browser.
          </p>
        </section>

        {/* Navigation & Controls */}
        <section className="grid md:grid-cols-2 gap-8">
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-blue-400 mb-2">
              <MousePointer size={20} />
              <h3 className="text-xl font-bold">Navigation Controls</h3>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl p-6 space-y-4">
              <div>
                <h4 className="font-bold text-white mb-1">Camera Mode (Default)</h4>
                <ul className="text-sm text-gray-400 space-y-2 list-disc list-inside">
                  <li><strong className="text-gray-200">Left Click + Drag:</strong> Rotate Camera (Orbit)</li>
                  <li><strong className="text-gray-200">Right Click + Drag:</strong> Pan Map</li>
                  <li><strong className="text-gray-200">Scroll:</strong> Zoom In/Out</li>
                  <li><strong className="text-gray-200">Shift + Scroll:</strong> Adjust Pitch (Tilt)</li>
                </ul>
              </div>
              <div className="pt-4 border-t border-white/10">
                <h4 className="font-bold text-white mb-1">Map Mode</h4>
                <ul className="text-sm text-gray-400 space-y-2 list-disc list-inside">
                  <li><strong className="text-gray-200">Left Click + Drag:</strong> Pan Map</li>
                  <li><strong className="text-gray-200">Right Click + Drag:</strong> Rotate Camera</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-2 text-green-400 mb-2">
              <Layers size={20} />
              <h3 className="text-xl font-bold">Terrain Analysis</h3>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl p-6 space-y-4">
              <p className="text-sm text-gray-400">
                Use the Control Panel on the left to customize the terrain visualization.
              </p>
              <ul className="space-y-3 text-sm text-gray-400">
                <li className="flex gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-500 mt-2 shrink-0"></div>
                  <span><strong>Contour Interval:</strong> Adjust the vertical distance between contour lines (10m - 500m). Index contours appear every 4th or 5th line.</span>
                </li>
                <li className="flex gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-500 mt-2 shrink-0"></div>
                  <span><strong>Exaggeration:</strong> Increase the vertical scale to highlight subtle terrain features (1.0x - 10.0x).</span>
                </li>
                <li className="flex gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-500 mt-2 shrink-0"></div>
                  <span><strong>Opacity:</strong> Control the transparency of the contour layer overlay.</span>
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* Navigator Mode */}
        <section className="space-y-6">
           <div className="flex items-center gap-2 text-yellow-400 mb-2">
              <Activity size={20} />
              <h3 className="text-xl font-bold">Navigator Mode</h3>
            </div>
            <div className="bg-gradient-to-br from-yellow-500/10 to-transparent border border-yellow-500/20 rounded-xl p-8">
              <p className="text-gray-300 mb-6">
                Enable <strong className="text-yellow-400">Navigator Mode</strong> to start plotting survey points and measuring distances.
              </p>
              
              <div className="grid md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <div className="w-8 h-8 bg-yellow-500/20 rounded-lg flex items-center justify-center text-yellow-400 font-bold border border-yellow-500/30">1</div>
                  <h4 className="font-bold text-white">Plot Points</h4>
                  <p className="text-xs text-gray-400">Click anywhere on the map to drop a survey point. The system automatically captures elevation data.</p>
                </div>
                <div className="space-y-2">
                  <div className="w-8 h-8 bg-yellow-500/20 rounded-lg flex items-center justify-center text-yellow-400 font-bold border border-yellow-500/30">2</div>
                  <h4 className="font-bold text-white">Measure</h4>
                  <p className="text-xs text-gray-400">Real-time distance, azimuth, and slope calculations are displayed between consecutive points.</p>
                </div>
                <div className="space-y-2">
                  <div className="w-8 h-8 bg-yellow-500/20 rounded-lg flex items-center justify-center text-yellow-400 font-bold border border-yellow-500/30">3</div>
                  <h4 className="font-bold text-white">Manage Groups</h4>
                  <p className="text-xs text-gray-400">Organize your navigation into named groups using the Navigator Panel on the right.</p>
                </div>
              </div>
            </div>
        </section>

        {/* Footer */}
        <footer className="pt-12 border-t border-white/10 text-center text-gray-600 text-sm">
          <p>&copy; 2026 GeoPortal 360. Developed by 532 |  Makopala Universitas Budi Luhur.</p>
        </footer>
        </div>
      </div>
    </div>
  );
};
