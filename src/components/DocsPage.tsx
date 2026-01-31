import {
  ArrowLeft,
  BookOpen,
  Layers,
  MousePointer,
  Activity,
  Camera,
  Columns,
  Instagram,
} from "lucide-react";
import geoportalLogo from "../assets/geoportal360.png";

interface Props {
  onBack?: () => void;
}

export const DocsPage = ({ onBack }: Props) => {
  return (
    <div className="h-screen bg-gray-900 text-white font-sans overflow-hidden flex flex-col">
      {/* Header */}
      <div className="shrink-0 sticky top-0 z-50 bg-black/80 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between">
          <div className="flex items-center gap-3 sm:gap-4">
            <button
              onClick={onBack}
              className="cursor-pointer p-1.5 sm:p-2 hover:bg-white/10 rounded-full transition-colors text-gray-400 hover:text-white"
            >
              {/* ubah ukuran icon lewat w/h */}
              <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
            <div className="flex items-center gap-1.5 sm:gap-2">
              <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-lg bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow-lg shadow-blue-500/20">
                <BookOpen className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
              </div>
              <h1 className="text-lg sm:text-xl font-bold">Documentation</h1>
            </div>
          </div>
          <span className="text-xs font-mono text-blue-400 border border-blue-500/30 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded bg-blue-500/10">
            v1.0 Pro
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="max-w-4xl mx-auto px-6 py-12 space-y-16">
          {/* Intro */}
          <section className="space-y-4 text-center pb-6 sm:pb-8 border-b border-white/10">
            <div className="flex justify-center">
              <img
                src={geoportalLogo}
                alt="GeoPortal 360"
                className="w-16 h-16 sm:w-24 sm:h-24 object-contain"
              />
            </div>
            <h2 className="text-3xl sm:text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-white to-blue-400 bg-[length:200%_auto] animate-shine">
              GeoPortal 360
            </h2>
            <p className="text-sm sm:text-xl text-blue-200/80 font-light tracking-wide uppercase">
              Precision in Every Dimension
            </p>
            <p className="text-base sm:text-lg text-gray-400 leading-relaxed max-w-md sm:max-w-2xl mx-auto mt-4 sm:mt-6">
              GeoPortal 360 is a powerful web-based terrain visualization and
              analysis platform designed for professionals.
            </p>
            <p className="text-base sm:text-lg text-gray-400 leading-relaxed max-w-md sm:max-w-2xl mx-auto mt-4 sm:mt-6">
              It combines high-accuracy 3D mapping, real-time contour mapping,
              and precision plotting tools complete with Azimuth & Back Azimuth
              information, UTM coordinates, and Geographic coordinates to
              provide geospatial insights about the Earth's surface right in
              your browser.
            </p>
            {/* ... paragraf sebelumnya ... */}

            <div className="mt-10 flex justify-center">
              <a
                href="https://www.instagram.com/rizkybor/"
                target="_blank"
                rel="noopener noreferrer"
                className="group px-4 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-sm transition-all hover:bg-white/10 hover:border-blue-500/50 hover:shadow-[0_0_15px_rgba(59,130,246,0.2)]"
              >
                <p className="text-[10px] sm:text-xs text-gray-400 flex items-center gap-2 tracking-wider">
                  <span className="w-1 h-1 rounded-full bg-blue-400 group-hover:animate-ping"></span>
                  DEVELOPED BY{" "}
                  <span className="text-blue-100 group-hover:text-blue-400 transition-colors">
                    RIZKY AJIE KURNIAWAN
                  </span>
                  <span className="text-gray-700">/</span>
                  <span>JAKARTA, INDONESIA</span>
                </p>
              </a>
            </div>
          </section>

          <section className="grid md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-blue-400 mb-2">
                <MousePointer size={20} />
                <h3 className="text-xl font-bold">Navigation Controls</h3>
              </div>
              {/* Navigation & Controls */}
              <div className="bg-white/5 border border-white/10 rounded-xl p-6 space-y-4">
                <div>
                  <h4 className="font-bold text-white mb-1">
                    Camera Mode (Default)
                  </h4>
                  <ul className="text-sm text-gray-400 space-y-2 list-disc list-inside">
                    <li>
                      <strong className="text-gray-200">
                        Left Click + Drag:
                      </strong>{" "}
                      Rotate Camera (Orbit)
                    </li>
                    <li>
                      <strong className="text-gray-200">
                        Right Click + Drag:
                      </strong>{" "}
                      Pan Map
                    </li>
                    <li>
                      <strong className="text-gray-200">Scroll:</strong> Zoom
                      In/Out
                    </li>
                    <li>
                      <strong className="text-gray-200">Shift + Scroll:</strong>{" "}
                      Adjust Pitch (Tilt)
                    </li>
                  </ul>
                </div>
                <div className="pt-4 border-t border-white/10">
                  <h4 className="font-bold text-white mb-1">Map Mode</h4>
                  <ul className="text-sm text-gray-400 space-y-2 list-disc list-inside">
                    <li>
                      <strong className="text-gray-200">
                        Left Click + Drag:
                      </strong>{" "}
                      Pan Map
                    </li>
                    <li>
                      <strong className="text-gray-200">
                        Right Click + Drag:
                      </strong>{" "}
                      Rotate Camera
                    </li>
                  </ul>
                </div>
              </div>

              {/* Screenshot Feature Docs */}
              <div className="flex items-center gap-2 text-purple-400 mb-2 mt-8">
                <Camera size={20} />
                <h3 className="text-xl font-bold">Export & Capture</h3>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-xl p-6 space-y-4">
                <p className="text-sm text-gray-400">
                  Capture high-resolution snapshots of your current view for
                  reports or presentations.
                </p>
                <ul className="space-y-3 text-sm text-gray-400">
                  <li className="flex gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-purple-500 mt-2 shrink-0"></div>
                    <span>
                      <strong className="text-white">Save as PNG:</strong>{" "}
                      High-quality image export, best for digital presentations.
                    </span>
                  </li>
                  <li className="flex gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-purple-500 mt-2 shrink-0"></div>
                    <span>
                      <strong className="text-white">Save as JPG:</strong>{" "}
                      Compressed image export, optimized for sharing.
                    </span>
                  </li>
                  <li className="flex gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-purple-500 mt-2 shrink-0"></div>
                    <span>
                      <strong className="text-white">Export to PDF:</strong>{" "}
                      Generates a document-ready PDF of the current map view.
                      Note: UI overlays are excluded for a cleaner output.
                    </span>
                  </li>
                </ul>
              </div>
            </div>

            <div className="space-y-4">
              {/* Terrain & Analysis Tools */}
              <div className="flex items-center gap-2 text-green-400 mb-2">
                <Layers size={20} />
                <h3 className="text-xl font-bold">Terrain Analysis</h3>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-xl p-6 space-y-4">
                <p className="text-sm text-gray-400">
                  Use the <strong className="text-white">Control Panel</strong>{" "}
                  on the left to customize your view. Adjust parameters to
                  fine-tune your topographic analysis:
                </p>
                <ul className="space-y-3 text-sm text-gray-400">
                  <li className="flex gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 mt-2 shrink-0"></div>
                    <span>
                      <strong className="text-white">Contour Interval:</strong>{" "}
                      Adjust the vertical distance between contour lines (2.5m -
                      500m). Index contours appear every 5th line.
                      <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                        <strong>Standard RBI Reference:</strong>
                        <ul className="list-disc ml-4 mt-1">
                          <li>1:25,000 (12.5m) - Jawa, Bali, Nusa Tenggara</li>
                          <li>1:50,000 (25m) - Outside Jawa regions</li>
                          <li>1:100,000 (50m) - Medium scale</li>
                          <li>1:250,000 (125m) - Regional scale</li>
                        </ul>
                      </div>
                    </span>
                  </li>
                  <li className="flex gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 mt-2 shrink-0"></div>
                    <span>
                      <strong className="text-white">Exaggeration:</strong>
                      <br /> Increase the vertical scale to highlight subtle
                      terrain features (1.0x - 10.0x).
                    </span>
                  </li>
                  <li className="flex gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 mt-2 shrink-0"></div>
                    <span>
                      <strong className="text-white">Opacity:</strong>
                      <br /> Control the transparency of the contour layer
                      overlay (0% - 100%).
                    </span>
                  </li>
                </ul>
              </div>

              {/* Split Screen View */}
              <div className="flex items-center gap-2 text-red-400 mb-2">
                <Columns size={20} />
                <h3 className="text-xl font-bold">Split Screen View</h3>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                <p className="text-sm text-gray-400 leading-relaxed">
                  Enable dual-screen mode to compare two map perspectives side
                  by side. You can synchronize camera movements to analyze
                  terrain changes or layer differences in real time.
                </p>
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
                Enable{" "}
                <strong className="text-yellow-400">Navigator Mode</strong> to
                start plotting survey points and measuring distances.
              </p>

              <div className="grid md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <div className="w-8 h-8 bg-yellow-500/20 rounded-lg flex items-center justify-center text-yellow-400 font-bold border border-yellow-500/30">
                    1
                  </div>
                  <h4 className="font-bold text-white">Plot Points</h4>
                  <p className="text-xs text-gray-400">
                    Click anywhere on the map to drop a survey point. The system
                    automatically captures elevation data.
                  </p>
                </div>
                <div className="space-y-2">
                  <div className="w-8 h-8 bg-yellow-500/20 rounded-lg flex items-center justify-center text-yellow-400 font-bold border border-yellow-500/30">
                    2
                  </div>
                  <h4 className="font-bold text-white">Measure</h4>
                  <p className="text-xs text-gray-400">
                    Real-time distance, azimuth, and slope calculations are
                    displayed between consecutive points.
                  </p>
                </div>
                <div className="space-y-2">
                  <div className="w-8 h-8 bg-yellow-500/20 rounded-lg flex items-center justify-center text-yellow-400 font-bold border border-yellow-500/30">
                    3
                  </div>
                  <h4 className="font-bold text-white">Manage Groups</h4>
                  <p className="text-xs text-gray-400">
                    Organize your navigation into named groups using the
                    Navigator Panel on the right.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Footer */}
          <footer className="pt-12 pb-8 border-t border-white/5 text-center">
            <div className="max-w-4xl mx-auto px-4">
              {/* Contact Section */}
              <div className="group inline-flex flex-col items-center gap-2 mb-10">
                <div className="flex items-center gap-2 mb-1">
                  <span className="h-[1px] w-4 bg-blue-500/40"></span>
                  <p className="text-[10px] uppercase tracking-[0.4em] text-blue-400/70 font-bold">
                    Contact Information
                  </p>
                  <span className="h-[1px] w-4 bg-blue-500/40"></span>
                </div>

                <a
                  href="mailto:contact@jcdigital.co.id"
                  className="relative text-sm sm:text-lg text-gray-400 hover:text-white transition-all duration-500 font-light tracking-wide italic"
                >
                  contact@jcdigital.co.id
                  <span className="absolute bottom-[-4px] left-0 w-0 h-[1px] bg-gradient-to-r from-transparent via-blue-500 to-transparent transition-all duration-500 group-hover:w-full"></span>
                </a>

                {/* Collaboration Info */}
                <div className="mt-6 flex flex-col items-center gap-3">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-gray-500">
                    In Collaboration With
                  </p>
                  <a
                    href="https://www.instagram.com/jendelacakradigital/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-full hover:bg-white/10 hover:border-blue-500/50 transition-all duration-300"
                  >
                    <Instagram
                      size={14}
                      className="text-pink-500 group-hover:scale-110 transition-transform"
                    />
                    <span className="text-xs font-semibold tracking-wider text-gray-300 group-hover:text-white">
                      PT. JENDELA CAKRA DIGITAL
                    </span>
                  </a>
                </div>
              </div>

              {/* Secondary Info & Copyright */}
              <div className="flex flex-col md:flex-row items-center justify-between gap-6 pt-8 border-t border-white/5 opacity-50 text-[11px] sm:text-xs tracking-widest uppercase font-medium text-gray-500">
                <div className="flex items-center gap-4">
                  <span className="hover:text-blue-400 transition-colors cursor-default">
                    Precision Mapping
                  </span>
                  <span className="w-1 h-1 rounded-full bg-gray-800"></span>
                  <span className="hover:text-blue-400 transition-colors cursor-default">
                    Real-time Analysis
                  </span>
                </div>

                <p className="order-first md:order-last">
                  &copy; 2026{" "}
                  <span className="text-gray-300">GeoPortal 360</span>. All
                  Rights Reserved.
                </p>
              </div>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
};
