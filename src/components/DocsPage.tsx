import {
  ArrowLeft,
  BookOpen,
  Layers,
  MousePointer,
  Activity,
  Camera,
  Columns,
  Instagram,
  DollarSign,
  Map,
  Zap,
  Smartphone,
  Globe,
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

                  <div className="space-y-4">
                     <div className="flex items-start gap-3">
                        <div className="mt-1 w-1.5 h-1.5 rounded-full bg-green-500 shrink-0"></div>
                        <p className="text-xs text-gray-400">
                           <strong className="text-white block mb-0.5">Opacity Control</strong>
                           Fine-tune the transparency of contour layers to blend with satellite imagery.
                        </p>
                     </div>
                     <div className="flex items-start gap-3">
                        <div className="mt-1 w-1.5 h-1.5 rounded-full bg-green-500 shrink-0"></div>
                        <p className="text-xs text-gray-400">
                           <strong className="text-white block mb-0.5">Split Screen</strong>
                           Compare 2D topography and 3D terrain side-by-side with synchronized camera movement.
                        </p>
                     </div>
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
                    <div className="grid grid-cols-3 gap-3">
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
                    <p className="text-[10px] text-gray-500 mt-4 text-center italic">
                        *Exports include current view, scale, and attribution. UI overlays are automatically hidden.
                    </p>
                </div>
              </section>
            </div>
          </div>

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
                          <span className="w-1.5 h-1.5 rounded-full bg-gray-500"></span> 2 MB Max Download
                      </li>
                      <li className="flex items-center gap-2 text-xs text-gray-300">
                          <span className="w-1.5 h-1.5 rounded-full bg-gray-500"></span> 3 Offline Maps
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
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span> 6 Offline Maps
                      </li>
                      <li className="flex items-center gap-2 text-xs text-gray-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span> 5 Saved Surveys
                      </li>
                       <li className="flex items-center gap-2 text-xs text-gray-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span> High-Res Export
                      </li>
                  </ul>
                  
                  <a href="mailto:contact@jcdigital.co.id?subject=Request Upgrade to Pro Plan" className="block w-full py-2 text-center rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-bold text-white transition-colors">
                      Upgrade to Pro
                  </a>
                </div>

                {/* Ultimate Plan */}
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
                          <span className="w-1.5 h-1.5 rounded-full bg-cyan-500"></span> Unlimited Layers
                      </li>
                      <li className="flex items-center gap-2 text-xs text-gray-300">
                          <span className="w-1.5 h-1.5 rounded-full bg-cyan-500"></span> 24/7 Priority Support
                      </li>
                  </ul>

                   <a href="mailto:contact@jcdigital.co.id?subject=Request Upgrade to Ultimate Plan" className="block w-full py-2 text-center rounded-lg bg-white/5 hover:bg-white/10 text-xs font-bold text-white border border-white/10 transition-colors">
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
