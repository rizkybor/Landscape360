import {
  ArrowLeft,
  BookOpen,
  Layers,
  MousePointer,
  Activity,
  Camera,
  Instagram,
  Map,
  Zap,
  Smartphone,
  Globe,
  CloudSun,
} from "lucide-react";
import streetsView from "../assets/Street-View.png";
import outdoorsView from "../assets/Outdoors-View.png";
import satelliteView from "../assets/Satellite-View.png";
import geoportalLogo from "../assets/geoportal360.png";
import { SEO } from './SEO';

interface Props {
  onBack?: () => void;
}

export const DocsPage = ({ onBack }: Props) => {
  return (
    <div className="h-screen bg-[#050505] text-white font-sans overflow-hidden flex flex-col">
      <SEO 
        title="Dokumentasi & Panduan"
        description="Pelajari cara menggunakan Landscape 360, navigasi peta 3D, analisis kontur, dan fitur-fitur canggih lainnya."
      />
      {/* Header */}
      <div className="shrink-0 sticky top-0 z-50 bg-black/80 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="group cursor-pointer p-2 hover:bg-white/10 rounded-full transition-all duration-300 text-gray-400 hover:text-white"
            >
              <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
            </button>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center shadow-lg shadow-blue-500/20 ring-1 ring-white/10">
                <BookOpen className="w-4 h-4 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold leading-none">Documentation</h1>
                <p className="text-[10px] text-gray-400 font-mono mt-1">System Guide</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
             <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full bg-green-500/10 border border-green-500/20 text-green-400 text-[10px] font-bold uppercase tracking-wider">
                <Zap size={10} />
                <span>Performance Optimized</span>
             </div>
             <span className="text-xs font-mono text-blue-400 border border-blue-500/30 px-2 py-1 rounded bg-blue-500/10">
                v1.2.0
             </span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar scroll-smooth">
        <div className="max-w-5xl mx-auto px-6 py-12 space-y-20">
          {/* Intro */}
          <section className="space-y-6 text-center pb-12 border-b border-white/5 relative">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full bg-blue-500/5 blur-[100px] pointer-events-none rounded-full"></div>
            
            <div className="relative z-10 flex justify-center mb-8">
              <div className="relative group">
                <div className="absolute inset-0 bg-blue-500/20 blur-xl rounded-full group-hover:bg-blue-500/30 transition-all duration-500"></div>
                <img
                  src={geoportalLogo}
                  alt="Landscape 360"
                  className="relative w-24 h-24 object-contain drop-shadow-2xl transform transition-transform duration-500 group-hover:scale-110"
                />
              </div>
            </div>
            
            <div className="relative z-10 space-y-4">
                <h2 className="text-4xl sm:text-6xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-white to-blue-400 bg-[length:200%_auto] animate-shine tracking-tight">
                  Landscape 360
                </h2>
                <p className="text-lg sm:text-xl text-blue-200/60 font-light tracking-[0.2em] uppercase">
                  Precision in Every Dimension
                </p>
            </div>

            <div className="relative z-10 max-w-2xl mx-auto space-y-4 text-gray-400 leading-relaxed text-sm sm:text-base">
                <p>
                  A professional-grade terrain visualization platform combining high-accuracy 3D mapping, 
                  real-time contour generation, and precision survey tools.
                </p>
                <div className="flex flex-wrap justify-center gap-2 mt-4">
                    <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs text-gray-300">WebGL Powered</span>
                    <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs text-gray-300">Offline Capable</span>
                    <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs text-gray-300">Sub-meter Accuracy</span>
                </div>
            </div>

            <div className="mt-10 flex justify-center relative z-10">
              <a
                href="https://www.instagram.com/rizkybor/"
                target="_blank"
                rel="noopener noreferrer"
                className="group px-5 py-2.5 rounded-full bg-[#0A0A0A] border border-white/10 transition-all hover:border-blue-500/50 hover:shadow-[0_0_20px_rgba(59,130,246,0.15)] flex items-center gap-3"
              >
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                </span>
                <p className="text-[10px] sm:text-xs text-gray-400 flex items-center gap-1.5 tracking-wider font-medium">
                  DEVELOPED BY
                  <span className="text-white group-hover:text-blue-400 transition-colors font-bold ml-1">
                    RIZKY AJIE KURNIAWAN
                  </span>
                </p>
              </a>
            </div>
          </section>

          {/* New Features Grid */}
          <section>
            <div className="flex items-center gap-3 text-white mb-6">
                <div className="p-2 bg-blue-500/10 rounded-lg border border-blue-500/20">
                    <Globe className="w-5 h-5 text-blue-400" />
                </div>
                <h3 className="text-2xl font-bold">Visualization & Styles</h3>
            </div>
            
            <div className="grid md:grid-cols-3 gap-4">
                {/* Streets */}
                <div className="group bg-[#0A0A0A] border border-white/10 rounded-xl overflow-hidden hover:border-blue-500/30 transition-all duration-300">
                    <div className="h-24 bg-gradient-to-br from-blue-900/20 to-gray-900/50 relative overflow-hidden">
                        <div className="absolute inset-0 opacity-40 group-hover:opacity-60 transition-opacity duration-500">
                             <img src={streetsView} alt="Streets View" className="w-full h-full object-cover" />
                        </div>
                    </div>
                    <div className="p-4">
                        <h4 className="font-bold text-white mb-1 group-hover:text-blue-400 transition-colors">Streets</h4>
                        <p className="text-xs text-gray-400 leading-relaxed">
                            Vector-based street map with high clarity. Best for urban navigation and location identification.
                        </p>
                    </div>
                </div>

                {/* Outdoors */}
                <div className="group bg-[#0A0A0A] border border-white/10 rounded-xl overflow-hidden hover:border-green-500/30 transition-all duration-300">
                    <div className="h-24 bg-gradient-to-br from-green-900/20 to-gray-900/50 relative overflow-hidden">
                         <div className="absolute inset-0 opacity-40 group-hover:opacity-60 transition-opacity duration-500">
                             <img src={outdoorsView} alt="Outdoors View" className="w-full h-full object-cover" />
                         </div>
                    </div>
                    <div className="p-4">
                        <h4 className="font-bold text-white mb-1 group-hover:text-green-400 transition-colors">Outdoors</h4>
                        <p className="text-xs text-gray-400 leading-relaxed">
                            Topographic features with terrain shading. Ideal for hiking, contour analysis, and nature surveys.
                        </p>
                    </div>
                </div>

                {/* Satellite */}
                <div className="group bg-[#0A0A0A] border border-white/10 rounded-xl overflow-hidden hover:border-purple-500/30 transition-all duration-300">
                    <div className="h-24 bg-gradient-to-br from-gray-900 to-black relative overflow-hidden">
                         <div className="absolute inset-0 opacity-40 group-hover:opacity-60 transition-opacity duration-500">
                             <img src={satelliteView} alt="Satellite View" className="w-full h-full object-cover" />
                         </div>
                    </div>
                    <div className="p-4">
                        <h4 className="font-bold text-white mb-1 group-hover:text-purple-400 transition-colors">Satellite Streets</h4>
                        <p className="text-xs text-gray-400 leading-relaxed">
                            High-resolution satellite imagery overlaid with street labels. Perfect for real-world context verification.
                        </p>
                    </div>
                </div>
            </div>
            <div className="mt-4 flex items-center gap-2 text-xs text-gray-500 bg-white/5 p-3 rounded-lg border border-white/5">
                <Zap size={12} className="text-yellow-500" />
                <span>Your preferred map style and view angle are automatically saved and restored on your next visit.</span>
            </div>
          </section>

          <div className="grid md:grid-cols-2 gap-8">
            <div className="space-y-8">
              {/* Navigation Controls */}
              <section>
                <div className="flex items-center gap-3 text-white mb-6">
                    <div className="p-2 bg-purple-500/10 rounded-lg border border-purple-500/20">
                        <MousePointer className="w-5 h-5 text-purple-400" />
                    </div>
                    <h3 className="text-2xl font-bold">Navigation Controls</h3>
                </div>
                
                <div className="bg-[#0A0A0A] border border-white/10 rounded-xl p-1 overflow-hidden">
                    <div className="grid grid-cols-2 divide-x divide-white/10">
                        <div className="p-5 space-y-4">
                            <div className="flex items-center gap-2 text-sm font-bold text-white">
                                <Map size={14} className="text-blue-400"/> Desktop
                            </div>
                            <ul className="space-y-3 text-xs text-gray-400">
                                <li className="flex justify-between">
                                    <span>Left Drag</span>
                                    <span className="text-gray-200 font-medium">Rotate / Orbit</span>
                                </li>
                                <li className="flex justify-between">
                                    <span>Right Drag</span>
                                    <span className="text-gray-200 font-medium">Pan Map</span>
                                </li>
                                <li className="flex justify-between">
                                    <span>Scroll</span>
                                    <span className="text-gray-200 font-medium">Smooth Zoom</span>
                                </li>
                                <li className="flex justify-between">
                                    <span>Shift + Scroll</span>
                                    <span className="text-gray-200 font-medium">Tilt (Pitch)</span>
                                </li>
                            </ul>
                        </div>
                        <div className="p-5 space-y-4 bg-white/[0.02]">
                            <div className="flex items-center gap-2 text-sm font-bold text-white">
                                <Smartphone size={14} className="text-green-400"/> Mobile
                            </div>
                            <ul className="space-y-3 text-xs text-gray-400">
                                <li className="flex justify-between">
                                    <span>One Finger</span>
                                    <span className="text-gray-200 font-medium">Pan</span>
                                </li>
                                <li className="flex justify-between">
                                    <span>Two Fingers</span>
                                    <span className="text-gray-200 font-medium">Pinch Zoom</span>
                                </li>
                                <li className="flex justify-between">
                                    <span>Twist</span>
                                    <span className="text-gray-200 font-medium">Rotate</span>
                                </li>
                                <li className="flex justify-between">
                                    <span>Two Finger Drag</span>
                                    <span className="text-gray-200 font-medium">Tilt (3D Only)</span>
                                </li>
                            </ul>
                        </div>
                    </div>
                </div>
              </section>

              {/* Navigator Mode */}
              <section>
                <div className="flex items-center gap-3 text-white mb-6">
                  <div className="p-2 bg-yellow-500/10 rounded-lg border border-yellow-500/20">
                    <Activity className="w-5 h-5 text-yellow-400" />
                  </div>
                  <h3 className="text-2xl font-bold">Navigator Mode</h3>
                </div>
                
                <div className="bg-gradient-to-br from-yellow-500/5 to-transparent border border-yellow-500/20 rounded-xl p-6 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                  
                  <div className="relative z-10 space-y-6">
                    <div className="flex gap-4 items-start group">
                      <div className="w-8 h-8 bg-yellow-500/10 rounded-lg flex items-center justify-center text-yellow-400 font-bold border border-yellow-500/20 shrink-0 group-hover:scale-110 transition-transform">1</div>
                      <div>
                        <h4 className="font-bold text-white text-sm">Precision Plotting</h4>
                        <p className="text-xs text-gray-400 mt-1">Click to drop points. Elevation data is automatically captured from the terrain model.</p>
                      </div>
                    </div>
                    
                    <div className="flex gap-4 items-start group">
                      <div className="w-8 h-8 bg-yellow-500/10 rounded-lg flex items-center justify-center text-yellow-400 font-bold border border-yellow-500/20 shrink-0 group-hover:scale-110 transition-transform">2</div>
                      <div>
                        <h4 className="font-bold text-white text-sm">Real-time Measurement</h4>
                        <p className="text-xs text-gray-400 mt-1">Instant calculation of Distance, Azimuth, and Slope between consecutive points.</p>
                      </div>
                    </div>

                    <div className="flex gap-4 items-start group">
                      <div className="w-8 h-8 bg-yellow-500/10 rounded-lg flex items-center justify-center text-yellow-400 font-bold border border-yellow-500/20 shrink-0 group-hover:scale-110 transition-transform">3</div>
                      <div>
                        <h4 className="font-bold text-white text-sm">Group Management</h4>
                        <p className="text-xs text-gray-400 mt-1">Organize complex surveys into named groups via the Navigator Panel.</p>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              {/* Split Screen Feature */}
              <section>
                <div className="flex items-center gap-3 text-white mb-6">
                  <div className="p-2 bg-indigo-500/10 rounded-lg border border-indigo-500/20">
                     <Activity className="w-5 h-5 text-indigo-400" />
                  </div>
                  <h3 className="text-2xl font-bold">Split Screen</h3>
                </div>
                
                <div className="bg-[#0A0A0A] border border-white/10 rounded-xl p-6 relative overflow-hidden group hover:border-indigo-500/30 transition-all duration-300">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                    
                    <div className="grid grid-cols-2 gap-4 relative z-10 mb-4">
                        <div className="aspect-video bg-gray-900 rounded-lg border border-white/10 flex items-center justify-center relative overflow-hidden">
                            <div className="absolute inset-0 bg-gradient-to-br from-gray-800 to-black opacity-50"></div>
                            <span className="relative text-[10px] font-bold text-gray-500 uppercase tracking-widest">2D Topo</span>
                        </div>
                        <div className="aspect-video bg-indigo-900/20 rounded-lg border border-indigo-500/20 flex items-center justify-center relative overflow-hidden">
                            <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/40 to-black opacity-50"></div>
                            <span className="relative text-[10px] font-bold text-indigo-400 uppercase tracking-widest">3D Sat</span>
                        </div>
                    </div>
                    
                    <h4 className="text-lg font-bold text-white mb-2">Synchronized Dual-View</h4>
                    <p className="text-xs text-gray-400 leading-relaxed mb-4">
                        Compare different map styles side-by-side in real-time. Camera movements (pan, zoom, rotate) are instantly synchronized between both viewports.
                    </p>
                    
                    <div className="flex flex-wrap gap-2">
                        <span className="px-2 py-1 rounded bg-indigo-500/10 border border-indigo-500/20 text-[10px] text-indigo-300 font-bold uppercase">Multi-Spectral Analysis</span>
                        <span className="px-2 py-1 rounded bg-indigo-500/10 border border-indigo-500/20 text-[10px] text-indigo-300 font-bold uppercase">Cross-Reference</span>
                    </div>
                </div>
              </section>
              {/* Weather Info */}
              <section>
                <div className="flex items-center gap-3 text-white mb-6">
                  <div className="p-2 bg-cyan-500/10 rounded-lg border border-cyan-500/20">
                     <CloudSun className="w-5 h-5 text-cyan-400" />
                  </div>
                  <h3 className="text-2xl font-bold">Weather Intelligence</h3>
                </div>
                
                <div className="bg-[#0A0A0A] border border-white/10 rounded-xl p-6 relative overflow-hidden group hover:border-cyan-500/30 transition-all duration-300">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                    
                    <div className="grid grid-cols-2 gap-4 relative z-10 mb-4">
                        <div className="aspect-video bg-gray-900 rounded-lg border border-white/10 flex items-center justify-center relative overflow-hidden p-4">
                            <div className="text-center">
                                <span className="text-3xl font-bold text-white block">28°<span className="text-cyan-400 text-lg">C</span></span>
                                <span className="text-[10px] text-gray-400 uppercase tracking-wider">Current</span>
                            </div>
                        </div>
                        <div className="aspect-video bg-cyan-900/10 rounded-lg border border-cyan-500/20 flex flex-col justify-center px-4 relative overflow-hidden">
                            <div className="flex justify-between items-center text-xs text-cyan-200 mb-1">
                                <span>Humidity</span>
                                <span className="font-bold">81%</span>
                            </div>
                            <div className="w-full bg-cyan-900/30 h-1.5 rounded-full overflow-hidden">
                                <div className="bg-cyan-400 h-full w-[81%]"></div>
                            </div>
                            <div className="mt-2 flex justify-between items-center text-xs text-emerald-200">
                                <span>Wind</span>
                                <span className="font-bold">10 km/h</span>
                            </div>
                        </div>
                    </div>
                    
                    <h4 className="text-lg font-bold text-white mb-2">Real-time Atmospheric Data</h4>
                    <p className="text-xs text-gray-400 leading-relaxed mb-4">
                        Integrated live weather feed from BMKG (Badan Meteorologi, Klimatologi, dan Geofisika). 
                        Provides essential environmental context for field surveys, including 3-day forecasting.
                    </p>
                    
                    <div className="flex flex-wrap gap-2">
                        <span className="px-2 py-1 rounded bg-cyan-500/10 border border-cyan-500/20 text-[10px] text-cyan-300 font-bold uppercase">Live Updates</span>
                        <span className="px-2 py-1 rounded bg-cyan-500/10 border border-cyan-500/20 text-[10px] text-cyan-300 font-bold uppercase">Field Safety</span>
                    </div>
                </div>
              </section>
            </div>

            <div className="space-y-8">
              {/* Terrain & Analysis Tools */}
              <section>
                <div className="flex items-center gap-3 text-white mb-6">
                  <div className="p-2 bg-green-500/10 rounded-lg border border-green-500/20">
                     <Layers className="w-5 h-5 text-green-400" />
                  </div>
                  <h3 className="text-2xl font-bold">Terrain Analysis</h3>
                </div>
                
                <div className="bg-[#0A0A0A] border border-white/10 rounded-xl p-6 space-y-6">
                  {/* Data Source Info */}
                  <div className="p-4 bg-blue-500/5 rounded-lg border border-blue-500/10 mb-6">
                     <h4 className="text-sm font-bold text-blue-300 mb-2 flex items-center gap-2">
                        <Activity size={14} className="text-blue-400"/> Data Sources
                     </h4>
                     <p className="text-xs text-gray-300 leading-relaxed">
                        Topographic data and contours are generated in real-time from the <strong>Mapbox Terrain-RGB v1</strong> tile set. 
                        This global Digital Elevation Model (DEM) aggregates data from multiple sources:
                     </p>
                     <ul className="mt-2 space-y-1 ml-4 list-disc text-[11px] text-gray-400">
                        <li><strong>SRTM 30m</strong> (Shuttle Radar Topography Mission) for global coverage.</li>
                        <li><strong>ASTER GDEM</strong> (Advanced Spaceborne Thermal Emission and Reflection Radiometer).</li>
                        <li>High-resolution local government data (LiDAR/Sonar) where available (e.g., USGS, EEA).</li>
                     </ul>
                     <p className="text-[10px] text-gray-500 mt-2 italic">
                        *Vertical accuracy varies by location (typically ±5m to ±10m RMSE globally, sub-meter in high-res zones).
                     </p>
                  </div>

                  <div className="p-4 bg-white/5 rounded-lg border border-white/5">
                    <h4 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                        <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                        Contour Configuration
                    </h4>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <span className="text-[10px] uppercase text-gray-500 font-bold tracking-wider">Interval</span>
                            <p className="text-xs text-gray-300">2.5m - 500m</p>
                        </div>
                         <div className="space-y-1">
                            <span className="text-[10px] uppercase text-gray-500 font-bold tracking-wider">Exaggeration</span>
                            <p className="text-xs text-gray-300">1.0x - 10.0x</p>
                        </div>
                    </div>
                  </div>
                  
                  <div className="p-4 bg-white/5 rounded-lg border border-white/5">
                     <h4 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
                        <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                        Opacity Control
                     </h4>
                     <p className="text-xs text-gray-400">
                        Fine-tune the transparency of contour layers to blend seamlessly with satellite imagery or street maps.
                     </p>
                  </div>
                </div>
              </section>

              {/* Export & Capture */}
              <section>
                <div className="flex items-center gap-3 text-white mb-6">
                   <div className="p-2 bg-pink-500/10 rounded-lg border border-pink-500/20">
                      <Camera className="w-5 h-5 text-pink-400" />
                   </div>
                   <h3 className="text-2xl font-bold">Export Tools</h3>
                </div>
                
                <div className="bg-[#0A0A0A] border border-white/10 rounded-xl p-6">
                    <div className="grid grid-cols-3 gap-3 mb-6">
                        <div className="text-center p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors border border-white/5">
                            <span className="block text-xs font-bold text-white mb-1">PNG</span>
                            <span className="text-[10px] text-gray-500">High Res</span>
                        </div>
                         <div className="text-center p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors border border-white/5">
                            <span className="block text-xs font-bold text-white mb-1">JPG</span>
                            <span className="text-[10px] text-gray-500">Compressed</span>
                        </div>
                         <div className="text-center p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors border border-white/5">
                            <span className="block text-xs font-bold text-white mb-1">PDF</span>
                            <span className="text-[10px] text-gray-500">Document</span>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Included Metadata</h4>
                        <div className="space-y-3">
                             <div className="flex items-start gap-3 p-3 bg-white/5 rounded-lg border border-white/5">
                                <div className="mt-0.5 text-pink-400 font-bold text-[10px]">01</div>
                                <div>
                                    <strong className="text-white text-xs block">Geospatial Telemetry</strong>
                                    <p className="text-[10px] text-gray-400">Exact Center Point coordinates (Lat/Lng), Average Elevation (mdpl), and Heading/Pitch angles.</p>
                                </div>
                             </div>
                             <div className="flex items-start gap-3 p-3 bg-white/5 rounded-lg border border-white/5">
                                <div className="mt-0.5 text-pink-400 font-bold text-[10px]">02</div>
                                <div>
                                    <strong className="text-white text-xs block">Survey Data Table</strong>
                                    <p className="text-[10px] text-gray-400">Comprehensive list of all plotted points including individual coordinates, elevation, and segment distances.</p>
                                </div>
                             </div>
                             <div className="flex items-start gap-3 p-3 bg-white/5 rounded-lg border border-white/5">
                                <div className="mt-0.5 text-pink-400 font-bold text-[10px]">03</div>
                                <div>
                                    <strong className="text-white text-xs block">Elevation Profile</strong>
                                    <p className="text-[10px] text-gray-400">Visual chart showing Min, Max, and Elevation Gain along the survey path.</p>
                                </div>
                             </div>
                        </div>
                    </div>

                    <p className="text-[10px] text-gray-500 mt-4 text-center italic border-t border-white/5 pt-4">
                        *Exports automatically hide UI controls for a clean, presentation-ready output.
                    </p>
                </div>
              </section>

            </div>
          </div>

          {/* Video Tutorial */}
          {/* <section className="space-y-8 pt-8 border-t border-white/5">
            <div className="flex items-center gap-3 text-white mb-6">
              <div className="p-2 bg-red-600/10 rounded-lg border border-red-600/20">
                 <svg 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="2" 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    className="w-5 h-5 text-red-500"
                 >
                    <path d="M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17" />
                    <path d="m10 15 5-3-5-3z" />
                 </svg>
              </div>
              <h3 className="text-2xl font-bold">Video Tutorials</h3>
            </div>

            <div className="grid md:grid-cols-2 gap-6"> */}
                {/* Video 1 */}
                {/* <div className="group bg-[#0A0A0A] border border-white/10 rounded-xl overflow-hidden hover:border-red-500/30 transition-all duration-300">
                    <div className="aspect-video relative bg-black">
                        <iframe 
                            className="w-full h-full absolute inset-0"
                            src="https://www.youtube.com/embed/dQw4w9WgXcQ?si=DummyVideoID" 
                            title="Landscape 360 - Quick Start Guide"
                            frameBorder="0" 
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
                            referrerPolicy="strict-origin-when-cross-origin" 
                            allowFullScreen
                        ></iframe>
                    </div>
                    <div className="p-4">
                        <h4 className="font-bold text-white mb-1 group-hover:text-red-400 transition-colors">Quick Start Guide</h4>
                        <p className="text-xs text-gray-400">
                            Learn the basics of navigation, map styles, and essential tools in under 5 minutes.
                        </p>
                    </div>
                </div> */}

                {/* Video 2 */}
                {/* <div className="group bg-[#0A0A0A] border border-white/10 rounded-xl overflow-hidden hover:border-red-500/30 transition-all duration-300">
                     <div className="aspect-video relative bg-black">
                        <iframe 
                            className="w-full h-full absolute inset-0"
                            src="https://www.youtube.com/embed/ScMzIvxBSi4?si=DummyVideoID2" 
                            title="Advanced Terrain Analysis"
                            frameBorder="0" 
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
                            referrerPolicy="strict-origin-when-cross-origin" 
                            allowFullScreen
                        ></iframe>
                    </div>
                    <div className="p-4">
                        <h4 className="font-bold text-white mb-1 group-hover:text-red-400 transition-colors">Advanced Analysis</h4>
                        <p className="text-xs text-gray-400">
                            Deep dive into contour configuration, slope measurement, and exporting professional reports.
                        </p>
                    </div>
                </div>
            </div>
          </section> */}

          {/* Pricing & Plans */}
          <section className="space-y-8 pt-8 border-t border-white/5">
            <div className="text-center max-w-2xl mx-auto space-y-3">
                 <h3 className="text-2xl font-bold text-white">Pricing & Plans</h3>
                 <p className="text-sm text-gray-400">Flexible options for individual surveyors and professional teams.</p>
            </div>
            
            <div className="grid md:grid-cols-3 gap-6">
                {/* Free Plan */}
                <div className="bg-[#0A0A0A] border border-white/10 rounded-xl p-6 flex flex-col hover:border-white/20 transition-all duration-300">
                  <div className="mb-4">
                     <span className="text-xs font-bold px-2 py-1 bg-gray-800 text-gray-300 rounded uppercase tracking-wider">Starter</span>
                  </div>
                  <h4 className="text-2xl font-bold text-white mb-1">Free</h4>
                  <p className="text-xs text-gray-400 mb-6">Basic exploration tools</p>
                  
                  <ul className="space-y-3 mb-8 flex-1">
                      <li className="flex items-center gap-2 text-xs text-gray-300">
                          <span className="w-1.5 h-1.5 rounded-full bg-gray-500"></span> 1 MB Max Download
                      </li>
                      <li className="flex items-center gap-2 text-xs text-gray-300">
                          <span className="w-1.5 h-1.5 rounded-full bg-gray-500"></span> 1 Offline Maps
                      </li>
                      <li className="flex items-center gap-2 text-xs text-gray-300">
                          <span className="w-1.5 h-1.5 rounded-full bg-gray-500"></span> 2 Saved Surveys
                      </li>
                  </ul>
                </div>

                {/* Pro Plan */}
                <div className="bg-gradient-to-b from-blue-900/20 to-[#0A0A0A] border border-blue-500/30 rounded-xl p-6 flex flex-col relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/10 blur-2xl -translate-y-1/2 translate-x-1/2 group-hover:bg-blue-500/20 transition-all"></div>
                  <div className="mb-4">
                     <span className="text-xs font-bold px-2 py-1 bg-blue-500/20 text-blue-400 rounded uppercase tracking-wider border border-blue-500/20">Recommended</span>
                  </div>
                  <h4 className="text-2xl font-bold text-white mb-1">$3.5<span className="text-sm font-normal text-gray-500">/mo</span></h4>
                  <p className="text-xs text-gray-400 mb-6">For field professionals</p>
                  
                  <ul className="space-y-3 mb-8 flex-1">
                      <li className="flex items-center gap-2 text-xs text-gray-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span> 10 MB Max Download
                      </li>
                      <li className="flex items-center gap-2 text-xs text-gray-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span> 3 Offline Maps
                      </li>
                      <li className="flex items-center gap-2 text-xs text-gray-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span> 4 Saved Surveys
                      </li>
                       <li className="flex items-center gap-2 text-xs text-gray-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span> High-Res Export
                      </li>
                  </ul>
                  
                  <a href="mailto:contact@jcdigital.co.id?subject=Request Upgrade to Pro Plan" className="block w-full py-2 text-center rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-bold text-white transition-colors">
                      Upgrade to Pro
                  </a>
                </div>

                {/* Enterprise Plan */}
                <div className="bg-[#0A0A0A] border border-white/10 rounded-xl p-6 flex flex-col hover:border-cyan-500/30 transition-all duration-300">
                  <div className="mb-4">
                     <span className="text-xs font-bold px-2 py-1 bg-cyan-900/30 text-cyan-400 rounded uppercase tracking-wider border border-cyan-500/20">Enterprise</span>
                  </div>
                  <h4 className="text-2xl font-bold text-white mb-1">$7<span className="text-sm font-normal text-gray-500">/mo</span></h4>
                  <p className="text-xs text-gray-400 mb-6">Maximum power & support</p>
                  
                  <ul className="space-y-3 mb-8 flex-1">
                      <li className="flex items-center gap-2 text-xs text-gray-300">
                          <span className="w-1.5 h-1.5 rounded-full bg-cyan-500"></span> 25 MB Max Download
                      </li>
                      <li className="flex items-center gap-2 text-xs text-gray-300">
                          <span className="w-1.5 h-1.5 rounded-full bg-cyan-500"></span> 10 Offline Maps
                      </li>
                      <li className="flex items-center gap-2 text-xs text-gray-300">
                          <span className="w-1.5 h-1.5 rounded-full bg-cyan-500"></span> 10 Saved Surveys
                      </li>
                      <li className="flex items-center gap-2 text-xs text-gray-300">
                          <span className="w-1.5 h-1.5 rounded-full bg-cyan-500"></span> 24/7 Priority Support
                      </li>
                  </ul>

                   <a href="mailto:contact@jcdigital.co.id?subject=Request Upgrade to Enterprise Plan" className="block w-full py-2 text-center rounded-lg bg-white/5 hover:bg-white/10 text-xs font-bold text-white border border-white/10 transition-colors">
                      Contact Sales
                  </a>
                </div>
            </div>
          </section>

          {/* Footer */}
          <footer className="pt-16 pb-8 border-t border-white/5 text-center">
            <div className="max-w-4xl mx-auto px-4">
              <div className="group inline-flex flex-col items-center gap-2 mb-10">
                <div className="flex items-center gap-2 mb-1">
                  <span className="h-[1px] w-6 bg-blue-500/40"></span>
                  <p className="text-[10px] uppercase tracking-[0.4em] text-blue-400/70 font-bold">
                    Contact Information
                  </p>
                  <span className="h-[1px] w-6 bg-blue-500/40"></span>
                </div>

                <a
                  href="mailto:contact@jcdigital.co.id"
                  className="relative text-base sm:text-lg text-gray-300 hover:text-white transition-all duration-300 font-light tracking-wide italic"
                >
                  contact@jcdigital.co.id
                </a>

                <div className="mt-10 flex flex-col items-center gap-6">
                  <p className="text-[9px] uppercase tracking-[0.3em] text-gray-600 font-bold">
                    In Collaboration With
                  </p>

                  <div className="flex flex-wrap justify-center gap-4">
                    <a
                      href="https://instagram.com/jcdigital.co.id"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group flex items-center gap-3 px-5 py-2.5 bg-[#0F0F0F] border border-white/5 rounded-full hover:border-pink-500/30 transition-all duration-300 hover:shadow-[0_0_15px_rgba(236,72,153,0.1)]"
                    >
                      <Instagram size={14} className="text-pink-500" />
                      <span className="text-[10px] font-bold tracking-widest text-gray-400 group-hover:text-white transition-colors">
                        JENDELA CAKRA DIGITAL
                      </span>
                    </a>

                    <a
                      href="https://www.instagram.com/makopala_ubl/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group flex items-center gap-3 px-5 py-2.5 bg-[#0F0F0F] border border-white/5 rounded-full hover:border-emerald-500/30 transition-all duration-300 hover:shadow-[0_0_15px_rgba(16,185,129,0.1)]"
                    >
                      <Instagram size={14} className="text-emerald-500" />
                      <span className="text-[10px] font-bold tracking-widest text-gray-400 group-hover:text-white transition-colors">
                        MAKOPALA UBL
                      </span>
                    </a>
                  </div>
                </div>
              </div>

              <div className="flex flex-col md:flex-row items-center justify-between gap-6 pt-8 border-t border-white/5 opacity-40 text-[10px] tracking-widest uppercase font-medium text-gray-500">
                <div className="flex items-center gap-4">
                  <span>Precision Mapping</span>
                  <span className="w-1 h-1 rounded-full bg-gray-700"></span>
                  <span>Real-time Analysis</span>
                </div>

                <p className="order-first md:order-last">
                  &copy; 2026 Landscape 360. All Rights Reserved.
                </p>
              </div>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
};