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
  Navigation,
  MapPinned,
  Footprints,
  UserPlus,
  ShieldCheck,
  HardDrive,
} from "lucide-react";
import streetsView from "../assets/Street-View.png";
import outdoorsView from "../assets/Outdoors-View.png";
import satelliteView from "../assets/Satellite-View.png";
import landscapeLogo from "../assets/LandscapeLogo.svg";
import { SEO } from "./SEO";

interface Props {
  onBack?: () => void;
}

// Set to true to show the Pricing & Plans section again
const SHOW_PRICING = false;

const UPGRADE_EMAIL = "contact@jcdigital.co.id";

// Upgrade requests go by email; the message is prefilled so users only add their details
const upgradeMailto = (plan: string) =>
  `mailto:${UPGRADE_EMAIL}?subject=${encodeURIComponent(
    `Landscape 360 upgrade request: ${plan} plan`,
  )}&body=${encodeURIComponent(
    `Hello Landscape 360 team,\n\nI would like to upgrade my account to the ${plan} plan.\n\nAccount email: \nName: \nOrganization: \n\nThank you.`,
  )}`;

export const DocsPage = ({ onBack }: Props) => {
  return (
    <div className="h-screen bg-white text-ink font-sans overflow-hidden flex flex-col">
      <SEO
        title="Documentation & Guide"
        description="Learn how to use Landscape 360, 3D map navigation, contour analysis, and other advanced features."
      />
      {/* Header */}
      <div className="shrink-0 sticky top-0 z-50 bg-white/95 backdrop-blur-xl border-b border-sand-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="group cursor-pointer p-2 hover:bg-sand-100 rounded-full transition-all duration-300 text-sand-600 hover:text-ink"
            >
              <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
            </button>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-forest-900 flex items-center justify-center shadow-lg ring-1 ring-sand-200">
                <BookOpen className="w-4 h-4 text-gold-300" />
              </div>
              <div>
                <h1 className="text-lg font-bold leading-none">
                  Documentation
                </h1>
                <p className="text-[10px] text-sand-600 font-mono mt-1">
                  System Guide
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full bg-forest-50 border border-forest-200 text-forest-700 text-[10px] font-bold uppercase tracking-wider">
              <Zap size={10} />
              <span>Performance Optimized</span>
            </div>
            <span className="text-xs font-mono text-forest-700 border border-forest-200 px-2 py-1 rounded bg-forest-50">
              v3.3.0
            </span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar scroll-smooth">
        <div className="max-w-5xl mx-auto px-6 py-12 space-y-20">
          {/* Intro */}
          <section className="space-y-6 text-center pb-12 border-b border-sand-100 relative">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full bg-forest-50 blur-[100px] pointer-events-none rounded-full"></div>

            <div className="relative z-10 flex justify-center mb-8">
              <div className="relative group">
                <div className="absolute inset-0 bg-forest-50 blur-xl rounded-full group-hover:bg-forest-100 transition-all duration-500"></div>
                <img
                  src={landscapeLogo}
                  alt="360"
                  className="relative w-24 h-24 object-contain drop-shadow-2xl transform transition-transform duration-500 group-hover:scale-110"
                />
              </div>
            </div>

            <div className="relative z-10 space-y-4">
              <h2 className="text-4xl sm:text-6xl font-bold text-forest-900 tracking-tight">
                Landscape 360
              </h2>
              <p className="text-lg sm:text-xl text-forest-700 font-light tracking-[0.2em] uppercase">
                Explore without Limits, Guided by Precision
              </p>
            </div>

            <div className="relative z-10 max-w-2xl mx-auto space-y-4 text-sand-600 leading-relaxed text-sm sm:text-base">
              <p>
                Master the terrain with the ultimate engine for outdoor
                exploration. Engineered for{" "}
                <span className="text-forest-700">
                  Mountaineers and Wilderness Experts
                </span>{" "}
                who demand absolute precision in navigation, real-time tracking,
                and comprehensive terrain intelligence. <br />
                <br />
                Built upon a meticulously curated POI dataset.{" "}
                <span className="text-forest-700">
                  Compiled from real hiking experiences, field observations,
                  community knowledge, and verified official sources.
                </span>{" "}
                This platform empowers you to Explore without Limits, Guided by
                Precision, delivering trusted, data-driven insights for safer
                and smarter adventures.
              </p>
              <div className="flex flex-wrap justify-center gap-2 mt-4">
                <span className="px-3 py-1 rounded-full bg-sand-50 border border-sand-200 text-xs text-sand-700">
                  Advanced Land Navigation
                </span>
                <span className="px-3 py-1 rounded-full bg-sand-50 border border-sand-200 text-xs text-sand-700">
                  Activity Recording & GPX
                </span>
                <span className="px-3 py-1 rounded-full bg-sand-50 border border-sand-200 text-xs text-sand-700">
                  3D Contour Visualization
                </span>
                <span className="px-3 py-1 rounded-full bg-sand-50 border border-sand-200 text-xs text-sand-700">
                  Reliable Offline Maps
                </span>
                <span className="px-3 py-1 rounded-full bg-sand-50 border border-sand-200 text-xs text-sand-700">
                  Marked Locations & Sharing
                </span>
              </div>
            </div>

            <div className="mt-10 flex justify-center relative z-10">
              <a
                href="https://www.instagram.com/rizkybor/"
                target="_blank"
                rel="noopener noreferrer"
                className="group px-5 py-2.5 rounded-full bg-white border border-sand-200 transition-all hover:border-forest-300 flex items-center gap-3"
              >
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-forest-500 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-forest-700"></span>
                </span>
                <p className="text-[10px] sm:text-xs text-sand-600 flex items-center gap-1.5 tracking-wider font-medium">
                  DEVELOPED BY
                  <span className="text-ink group-hover:text-forest-700 transition-colors font-bold ml-1">
                    RIZKY AJIE KURNIAWAN
                  </span>
                </p>
              </a>
            </div>
          </section>

          {/* Quick Start Overview */}
          <section>
            <div className="flex items-center gap-3 text-ink mb-6">
              <div className="p-2 bg-gold-50 rounded-lg border border-gold-200">
                <Zap className="w-5 h-5 text-gold-700" />
              </div>
              <h3 className="text-2xl font-bold">Quick Start Overview</h3>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-white border border-sand-200 rounded-xl p-4 flex gap-4 items-start group hover:border-gold-200 transition-all">
                <div className="w-8 h-8 rounded-lg bg-forest-50 flex items-center justify-center text-forest-700 shrink-0">
                  <MousePointer size={16} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-ink mb-1">
                    Navigation
                  </h4>
                  <p className="text-xs text-sand-600 leading-relaxed">
                    <strong>Left-Click Drag</strong> to Rotate (3D) or Pan (2D).{" "}
                    <strong>Scroll</strong> to Zoom. Use on-screen buttons for
                    precision control.
                  </p>
                </div>
              </div>

              <div className="bg-white border border-sand-200 rounded-xl p-4 flex gap-4 items-start group hover:border-forest-200 transition-all">
                <div className="w-8 h-8 rounded-lg bg-forest-50 flex items-center justify-center text-forest-700 shrink-0">
                  <Layers size={16} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-ink mb-1">
                    Terrain Analysis
                  </h4>
                  <p className="text-xs text-sand-600 leading-relaxed">
                    Toggle <strong>Contours</strong> and adjust exaggeration in
                    the Control Panel. Switch between Streets, Outdoors, and
                    Satellite views.
                  </p>
                </div>
              </div>

              <div className="bg-white border border-sand-200 rounded-xl p-4 flex gap-4 items-start group hover:border-brick-200 transition-all">
                <div className="w-8 h-8 rounded-lg bg-brick-50 flex items-center justify-center text-brick-600 shrink-0">
                  <Camera size={16} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-ink mb-1">
                    Export & Share
                  </h4>
                  <p className="text-xs text-sand-600 leading-relaxed">
                    Capture high-res snapshots (PNG/JPG), generate PDF reports, 
                    or download recorded Tracking Activities as <strong>GPX files</strong>.
                  </p>
                </div>
              </div>

              <div className="bg-white border border-sand-200 rounded-xl p-4 flex gap-4 items-start group hover:border-forest-200 transition-all">
                <div className="w-8 h-8 rounded-lg bg-forest-50 flex items-center justify-center text-forest-700 shrink-0">
                  <Navigation size={16} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-ink mb-1">
                    Activity Tracking
                  </h4>
                  <p className="text-xs text-sand-600 leading-relaxed">
                    Click the <strong>GPS Icon</strong> to broadcast location, 
                    use <strong>Start Activity</strong> to record trails, and sync seamlessly 
                    even when offline.
                  </p>
                </div>
              </div>

              <div className="bg-white border border-sand-200 rounded-xl p-4 flex gap-4 items-start group hover:border-forest-200 transition-all">
                <div className="w-8 h-8 rounded-lg bg-forest-50 flex items-center justify-center text-forest-700 shrink-0">
                  <Map size={16} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-ink mb-1">
                    Route Planner
                  </h4>
                  <p className="text-xs text-sand-600 leading-relaxed">
                    Enable <strong>Route</strong> in Tools &amp; Exploration, click the map to set
                    start/end points, then choose <strong>Driving (Toll / No Toll)</strong> or{" "}
                    <strong>Walking</strong> to get distance and ETA.
                  </p>
                </div>
              </div>

              <div className="bg-white border border-sand-200 rounded-xl p-4 flex gap-4 items-start group hover:border-forest-200 transition-all">
                <div className="w-8 h-8 rounded-lg bg-forest-50 flex items-center justify-center text-forest-700 shrink-0">
                  <Layers size={16} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-ink mb-1">
                    Custom Basemaps
                  </h4>
                  <p className="text-xs text-sand-600 leading-relaxed">
                    Upload and overlay your own <strong>GeoTIFF/GeoPDF</strong> maps.
                    Manually adjust alignment with the visual georeference tool.
                  </p>
                </div>
              </div>

              <div className="bg-white border border-sand-200 rounded-xl p-4 flex gap-4 items-start group hover:border-gold-200 transition-all">
                <div className="w-8 h-8 rounded-lg bg-gold-50 flex items-center justify-center text-gold-700 shrink-0">
                  <Map size={16} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-ink mb-1">
                    Data Source & Attribution (POIs){" "}
                  </h4>
                  <p className="text-xs text-sand-600 leading-relaxed">
                    Curated POIs compiled from field observations, community knowledge,
                    and verified sources. Optimized for large datasets via clustering
                    and GPU-rendered layers (no heavy DOM markers). Click a POI to open details,
                    then click the map or the close button to dismiss.
                  </p>
                </div>
              </div>

              <div className="bg-white border border-sand-200 rounded-xl p-4 flex gap-4 items-start group hover:border-gold-200 transition-all">
                <div className="w-8 h-8 rounded-lg bg-gold-50 flex items-center justify-center text-gold-700 shrink-0">
                  <MapPinned size={16} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-ink mb-1">
                    Marked Locations
                  </h4>
                  <p className="text-xs text-sand-600 leading-relaxed">
                    Open <strong>Marked Locations</strong> in Tools &amp; Exploration to save
                    camps, water sources, summits and more with full details. Share them with
                    other users by <strong>email or name</strong> and export as{" "}
                    <strong>GPX</strong>.
                  </p>
                </div>
              </div>

              <div className="bg-white border border-sand-200 rounded-xl p-4 flex gap-4 items-start group hover:border-forest-200 transition-all">
                <div className="w-8 h-8 rounded-lg bg-forest-50 flex items-center justify-center text-forest-700 shrink-0">
                  <Footprints size={16} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-ink mb-1">
                    Track Recorder
                  </h4>
                  <p className="text-xs text-sand-600 leading-relaxed">
                    Record personal GPS tracks <strong>online or offline</strong> with distance,
                    duration and elevation, then share them by email or download them as GPX.
                    Recording is available for Enterprise accounts; Pro accounts can view, rename,
                    export and delete their tracks.
                  </p>
                </div>
              </div>

              <div className="bg-white border border-sand-200 rounded-xl p-4 flex gap-4 items-start group hover:border-forest-200 transition-all">
                <div className="w-8 h-8 rounded-lg bg-forest-50 flex items-center justify-center text-forest-700 shrink-0">
                  <UserPlus size={16} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-ink mb-1">
                    Request an Account
                  </h4>
                  <p className="text-xs text-sand-600 leading-relaxed">
                    New here? Click <strong>Sign In / Register</strong>, then{" "}
                    <strong>Request Account</strong> and fill in the form. Our team reviews it
                    and emails you your login details.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Plans & Features */}
          <section>
            <div className="flex items-center gap-3 text-ink mb-2">
              <div className="p-2 bg-forest-50 rounded-lg border border-forest-200">
                <Layers className="w-5 h-5 text-forest-700" />
              </div>
              <h3 className="text-2xl font-bold">Plans & Features</h3>
            </div>
            <p className="text-sm text-sand-600 mb-6">
              Every account starts on <strong>Free</strong>. Pro and Enterprise unlock more
              features and higher limits. To upgrade, send a request by email to{" "}
              <a href={upgradeMailto("Pro or Enterprise")} className="font-bold text-forest-700 hover:underline">
                contact@jcdigital.co.id
              </a>{" "}
              with the email of your Landscape 360 account and the plan you need.
            </p>

            <div className="bg-sand-50 border border-sand-200 rounded-xl p-4 mb-4">
              <h4 className="text-xs font-bold text-sand-600 uppercase tracking-wider mb-2">
                Included in every plan
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {[
                  "2D & 3D terrain",
                  "Contour lines",
                  "DMS coordinate grid",
                  "Streets, Outdoors & Satellite styles",
                  "Split screen",
                  "Location search",
                  "Weather",
                  "Route planner",
                  "Navigator survey tools",
                  "Points of interest",
                  "PNG / JPG / PDF export",
                  "Receive shared locations & tracks",
                ].map((f) => (
                  <span key={f} className="px-2 py-1 rounded-full bg-white border border-sand-200 text-[11px] text-sand-700">
                    {f}
                  </span>
                ))}
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-4 mb-6">
              {[
                {
                  plan: "Free",
                  tagline: "Explore and plan your trips",
                  badge: "bg-sand-100 text-sand-700 border-sand-300",
                  card: "border-sand-200",
                  features: [
                    "1 offline map (up to 1 MB)",
                    "2 saved surveys",
                    "10 marked locations",
                    "View your tracks and tracks shared with you",
                    "10 MB cloud storage",
                  ],
                },
                {
                  plan: "Pro",
                  tagline: "For hikers and field professionals",
                  badge: "bg-forest-50 text-forest-700 border-forest-200",
                  card: "border-forest-200",
                  features: [
                    "3 offline maps (up to 10 MB each)",
                    "4 saved surveys",
                    "100 marked locations, share by email or name",
                    "GPS Tracking: broadcast your location and record activities (GPX)",
                    "Rename your cloud tracks",
                    "100 MB cloud storage",
                  ],
                },
                {
                  plan: "Enterprise",
                  tagline: "For teams, clubs and organizations",
                  badge: "bg-gold-50 text-gold-700 border-gold-200",
                  card: "border-gold-200",
                  features: [
                    "10 offline maps (up to 25 MB each)",
                    "10 saved surveys",
                    "1,000 marked locations, share by email or name",
                    "Track Recorder: record online or offline, share and export GPX",
                    "GPS Tracking: broadcast your location",
                    "Team Monitor: follow every active member live (Monitor accounts)",
                    "Custom Basemaps: GeoTIFF / GeoPDF overlays (Monitor accounts)",
                    "1 GB cloud storage",
                  ],
                },
              ].map((p) => (
                <div key={p.plan} className={`bg-white border ${p.card} rounded-xl p-5 flex flex-col`}>
                  <span className={`self-start text-[10px] font-bold px-2 py-1 rounded border uppercase tracking-wider ${p.badge}`}>
                    {p.plan}
                  </span>
                  <p className="text-xs text-sand-600 mt-2 mb-4">{p.tagline}</p>
                  <ul className="space-y-2 text-xs text-sand-700 flex-1">
                    {p.features.map((f) => (
                      <li key={f} className="flex gap-2">
                        <span className="text-forest-700 font-bold">✓</span>
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                  {p.plan !== "Free" && (
                    <a
                      href={upgradeMailto(p.plan)}
                      className="mt-5 block w-full py-2 text-center rounded-lg bg-forest-800 hover:bg-forest-700 text-xs font-bold text-white transition-colors"
                    >
                      Request {p.plan} Upgrade
                    </a>
                  )}
                </div>
              ))}
            </div>

            <div className="bg-white border border-sand-200 rounded-xl p-5 overflow-x-auto">
              <h4 className="text-sm font-bold text-ink mb-3 flex items-center gap-2">
                <HardDrive size={16} className="text-forest-700" /> Limits & Storage
              </h4>
              <table className="w-full text-xs min-w-[420px]">
                <thead>
                  <tr className="text-left text-[10px] uppercase tracking-wider text-sand-500 border-b border-sand-200">
                    <th className="py-2 pr-3 font-bold">Limit</th>
                    <th className="py-2 pr-3 font-bold">Free</th>
                    <th className="py-2 pr-3 font-bold">Pro</th>
                    <th className="py-2 font-bold">Enterprise</th>
                  </tr>
                </thead>
                <tbody className="text-sand-700">
                  {[
                    ["Cloud storage", "10 MB", "100 MB", "1 GB"],
                    ["Offline maps", "1", "3", "10"],
                    ["Size per offline map", "1 MB", "10 MB", "25 MB"],
                    ["Saved surveys", "2", "4", "10"],
                    ["Marked locations", "10", "100", "1,000"],
                    ["Share locations", "—", "✓", "✓"],
                    ["Record tracks", "—", "—", "✓"],
                    ["Custom basemap storage", "—", "—", "5 MB"],
                  ].map(([label, ...values]) => (
                    <tr key={label} className="border-b border-sand-100 last:border-0">
                      <td className="py-2 pr-3 font-bold text-ink">{label}</td>
                      {values.map((v, i) => (
                        <td key={i} className="py-2 pr-3 font-mono">{v}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-[10px] text-sand-500 mt-3 leading-relaxed">
                <strong>Cloud storage</strong> is shared by your recorded tracks, marked
                locations, surveys and custom basemaps; your usage is shown in the{" "}
                <strong>User Account</strong> menu. <strong>Offline maps</strong> are saved on
                your device and do not use cloud storage. When a limit is reached nothing is
                deleted: new data is simply not saved until you free up space. Need more? Request
                it by email to {UPGRADE_EMAIL}.
              </p>
            </div>
          </section>

          {/* New Features Grid */}
          <section>
            <div className="flex items-center gap-3 text-ink mb-6">
              <div className="p-2 bg-forest-50 rounded-lg border border-forest-200">
                <Globe className="w-5 h-5 text-forest-700" />
              </div>
              <h3 className="text-2xl font-bold">Visualization & Styles</h3>
            </div>

            <div className="grid md:grid-cols-3 gap-4">
              {/* Streets */}
              <div className="group bg-white border border-sand-200 rounded-xl overflow-hidden hover:border-forest-200 transition-all duration-300">
                <div className="h-24 bg-sand-100 relative overflow-hidden">
                  <div className="absolute inset-0 opacity-90 group-hover:opacity-100 transition-opacity duration-500">
                    <img
                      src={streetsView}
                      alt="Streets View"
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>
                <div className="p-4">
                  <h4 className="font-bold text-ink mb-1 group-hover:text-forest-700 transition-colors">
                    Streets
                  </h4>
                  <p className="text-xs text-sand-600 leading-relaxed">
                    Vector-based street map with high clarity. Best for urban
                    navigation and location identification.
                  </p>
                </div>
              </div>

              {/* Outdoors */}
              <div className="group bg-white border border-sand-200 rounded-xl overflow-hidden hover:border-forest-200 transition-all duration-300">
                <div className="h-24 bg-sand-100 relative overflow-hidden">
                  <div className="absolute inset-0 opacity-90 group-hover:opacity-100 transition-opacity duration-500">
                    <img
                      src={outdoorsView}
                      alt="Outdoors View"
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>
                <div className="p-4">
                  <h4 className="font-bold text-ink mb-1 group-hover:text-forest-700 transition-colors">
                    Outdoors
                  </h4>
                  <p className="text-xs text-sand-600 leading-relaxed">
                    Topographic features with terrain shading. Ideal for hiking,
                    contour analysis, and nature surveys.
                  </p>
                </div>
              </div>

              {/* Satellite */}
              <div className="group bg-white border border-sand-200 rounded-xl overflow-hidden hover:border-gold-200 transition-all duration-300">
                <div className="h-24 bg-sand-100 relative overflow-hidden">
                  <div className="absolute inset-0 opacity-90 group-hover:opacity-100 transition-opacity duration-500">
                    <img
                      src={satelliteView}
                      alt="Satellite View"
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>
                <div className="p-4">
                  <h4 className="font-bold text-ink mb-1 group-hover:text-gold-700 transition-colors">
                    Satellite Streets
                  </h4>
                  <p className="text-xs text-sand-600 leading-relaxed">
                    High-resolution satellite imagery overlaid with street
                    labels. Perfect for real-world context verification.
                  </p>
                </div>
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2 text-xs text-sand-500 bg-sand-50 p-3 rounded-lg border border-sand-100">
              <Zap size={12} className="text-gold-700" />
              <span>
                Your preferred map style and view angle are automatically saved
                and restored on your next visit.
              </span>
            </div>
          </section>

          <div className="grid md:grid-cols-2 gap-8">
            <div className="space-y-8">
              {/* Navigation Controls */}
              <section>
                <div className="flex items-center gap-3 text-ink mb-6">
                  <div className="p-2 bg-gold-50 rounded-lg border border-gold-200">
                    <MousePointer className="w-5 h-5 text-gold-700" />
                  </div>
                  <h3 className="text-2xl font-bold">Navigation Controls</h3>
                </div>

                <div className="bg-white border border-sand-200 rounded-xl p-1 overflow-hidden">
                  <div className="grid grid-cols-2 divide-x divide-sand-200">
                    <div className="p-5 space-y-4">
                      <div className="flex items-center gap-2 text-sm font-bold text-ink">
                        <Map size={14} className="text-forest-700" /> Desktop
                      </div>
                      <ul className="space-y-3 text-xs text-sand-600">
                        <li className="flex justify-between">
                          <span>Left Drag</span>
                          <span className="text-sand-800 font-medium">
                            Rotate / Orbit
                          </span>
                        </li>
                        <li className="flex justify-between">
                          <span>Right Drag</span>
                          <span className="text-sand-800 font-medium">
                            Pan Map
                          </span>
                        </li>
                        <li className="flex justify-between">
                          <span>Scroll</span>
                          <span className="text-sand-800 font-medium">
                            Smooth Zoom
                          </span>
                        </li>
                        <li className="flex justify-between">
                          <span>Shift + Scroll</span>
                          <span className="text-sand-800 font-medium">
                            Tilt (Pitch)
                          </span>
                        </li>
                      </ul>
                    </div>
                    <div className="p-5 space-y-4 bg-sand-50">
                      <div className="flex items-center gap-2 text-sm font-bold text-ink">
                        <Smartphone size={14} className="text-forest-700" />{" "}
                        Mobile
                      </div>
                      <ul className="space-y-3 text-xs text-sand-600">
                        <li className="flex justify-between">
                          <span>One Finger</span>
                          <span className="text-sand-800 font-medium">Pan</span>
                        </li>
                        <li className="flex justify-between">
                          <span>Two Fingers</span>
                          <span className="text-sand-800 font-medium">
                            Pinch Zoom
                          </span>
                        </li>
                        <li className="flex justify-between">
                          <span>Twist</span>
                          <span className="text-sand-800 font-medium">
                            Rotate
                          </span>
                        </li>
                        <li className="flex justify-between">
                          <span>Two Finger Drag</span>
                          <span className="text-sand-800 font-medium">
                            Tilt (3D Only)
                          </span>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              </section>

              {/* Navigator Mode */}
              <section>
                <div className="flex items-center gap-3 text-ink mb-6">
                  <div className="p-2 bg-gold-50 rounded-lg border border-gold-200">
                    <Activity className="w-5 h-5 text-gold-700" />
                  </div>
                  <h3 className="text-2xl font-bold">Navigator Mode</h3>
                </div>

                <div className="bg-gradient-to-br from-gold-50 to-transparent border border-gold-200 rounded-xl p-6 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-gold-50 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>

                  <div className="relative z-10 space-y-6">
                    <div className="flex gap-4 items-start group">
                      <div className="w-8 h-8 bg-gold-50 rounded-lg flex items-center justify-center text-gold-700 font-bold border border-gold-200 shrink-0 group-hover:scale-110 transition-transform">
                        1
                      </div>
                      <div>
                        <h4 className="font-bold text-ink text-sm">
                          Precision Plotting
                        </h4>
                        <p className="text-xs text-sand-600 mt-1">
                          Click to drop points. Elevation data is automatically
                          captured from the terrain model.
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-4 items-start group">
                      <div className="w-8 h-8 bg-gold-50 rounded-lg flex items-center justify-center text-gold-700 font-bold border border-gold-200 shrink-0 group-hover:scale-110 transition-transform">
                        2
                      </div>
                      <div>
                        <h4 className="font-bold text-ink text-sm">
                          Real-time Measurement
                        </h4>
                        <p className="text-xs text-sand-600 mt-1">
                          Instant calculation of Distance, Azimuth, and Slope
                          between consecutive points.
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-4 items-start group">
                      <div className="w-8 h-8 bg-gold-50 rounded-lg flex items-center justify-center text-gold-700 font-bold border border-gold-200 shrink-0 group-hover:scale-110 transition-transform">
                        3
                      </div>
                      <div>
                        <h4 className="font-bold text-ink text-sm">
                          Group Management
                        </h4>
                        <p className="text-xs text-sand-600 mt-1">
                          Organize complex surveys into named groups via the
                          Navigator Panel.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              {/* Split Screen Feature */}
              <section>
                <div className="flex items-center gap-3 text-ink mb-6">
                  <div className="p-2 bg-forest-50 rounded-lg border border-forest-200">
                    <Activity className="w-5 h-5 text-forest-700" />
                  </div>
                  <h3 className="text-2xl font-bold">Split Screen</h3>
                </div>

                <div className="bg-white border border-sand-200 rounded-xl p-6 relative overflow-hidden group hover:border-forest-200 transition-all duration-300">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-forest-50 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>

                  <div className="grid grid-cols-2 gap-4 relative z-10 mb-4">
                    <div className="aspect-video bg-white rounded-lg border border-sand-200 flex items-center justify-center relative overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-br from-sand-100 to-white opacity-50"></div>
                      <span className="relative text-[10px] font-bold text-sand-500 uppercase tracking-widest">
                        2D Topo
                      </span>
                    </div>
                    <div className="aspect-video bg-forest-50 rounded-lg border border-forest-200 flex items-center justify-center relative overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-br from-forest-100 to-white opacity-50"></div>
                      <span className="relative text-[10px] font-bold text-forest-700 uppercase tracking-widest">
                        3D Sat
                      </span>
                    </div>
                  </div>

                  <h4 className="text-lg font-bold text-ink mb-2">
                    Synchronized Dual-View
                  </h4>
                  <p className="text-xs text-sand-600 leading-relaxed mb-4">
                    Compare different map styles side-by-side in real-time.
                    Camera movements (pan, zoom, rotate) are instantly
                    synchronized between both viewports.
                  </p>

                  <div className="flex flex-wrap gap-2">
                    <span className="px-2 py-1 rounded bg-forest-50 border border-forest-200 text-[10px] text-forest-700 font-bold uppercase">
                      Multi-Spectral Analysis
                    </span>
                    <span className="px-2 py-1 rounded bg-forest-50 border border-forest-200 text-[10px] text-forest-700 font-bold uppercase">
                      Cross-Reference
                    </span>
                  </div>
                </div>
              </section>
              {/* Weather Info */}
              <section>
                <div className="flex items-center gap-3 text-ink mb-6">
                  <div className="p-2 bg-forest-50 rounded-lg border border-forest-200">
                    <CloudSun className="w-5 h-5 text-forest-700" />
                  </div>
                  <h3 className="text-2xl font-bold">Weather Intelligence</h3>
                </div>

                <div className="bg-white border border-sand-200 rounded-xl p-6 relative overflow-hidden group hover:border-forest-200 transition-all duration-300">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-forest-50 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>

                  <div className="grid grid-cols-2 gap-4 relative z-10 mb-4">
                    <div className="aspect-video bg-white rounded-lg border border-sand-200 flex items-center justify-center relative overflow-hidden p-4">
                      <div className="text-center">
                        <span className="text-3xl font-bold text-ink block">
                          28°<span className="text-forest-700 text-lg">C</span>
                        </span>
                        <span className="text-[10px] text-sand-600 uppercase tracking-wider">
                          Current
                        </span>
                      </div>
                    </div>
                    <div className="aspect-video bg-forest-50 rounded-lg border border-forest-200 flex flex-col justify-center px-4 relative overflow-hidden">
                      <div className="flex justify-between items-center text-xs text-forest-700 mb-1">
                        <span>Humidity</span>
                        <span className="font-bold">81%</span>
                      </div>
                      <div className="w-full bg-forest-100 h-1.5 rounded-full overflow-hidden">
                        <div className="bg-forest-500 h-full w-[81%]"></div>
                      </div>
                      <div className="mt-2 flex justify-between items-center text-xs text-forest-700">
                        <span>Wind</span>
                        <span className="font-bold">10 km/h</span>
                      </div>
                    </div>
                  </div>

                  <h4 className="text-lg font-bold text-ink mb-2">
                    Real-time Atmospheric Data
                  </h4>
                  <p className="text-xs text-sand-600 leading-relaxed mb-4">
                    Integrated live weather feed from BMKG (Badan Meteorologi,
                    Klimatologi, dan Geofisika). Provides essential
                    environmental context for field surveys, including 3-day
                    forecasting.
                  </p>

                  <div className="flex flex-wrap gap-2">
                    <span className="px-2 py-1 rounded bg-forest-50 border border-forest-200 text-[10px] text-forest-700 font-bold uppercase">
                      Live Updates
                    </span>
                    <span className="px-2 py-1 rounded bg-forest-50 border border-forest-200 text-[10px] text-forest-700 font-bold uppercase">
                      Field Safety
                    </span>
                  </div>
                </div>
              </section>

              {/* GPS Tracker */}
              <section>
                <div className="flex items-center gap-3 text-ink mb-6">
                  <div className="p-2 bg-forest-50 rounded-lg border border-forest-200">
                    <Navigation size={20} className="text-forest-700" />
                  </div>
                  <h3 className="text-2xl font-bold">Realtime GPS Tracking</h3>
                  <span className="px-2 py-1 rounded bg-forest-50 text-[10px] text-forest-700 font-bold uppercase border border-forest-200">
                    Live Now
                  </span>
                  <span className="px-2 py-1 rounded bg-forest-50 text-[10px] text-forest-700 font-bold uppercase border border-forest-200">
                    Pro
                  </span>
                </div>

                <div className="bg-white border border-sand-200 rounded-xl p-6 relative overflow-hidden group hover:border-forest-200 transition-all duration-300">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-forest-50 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>

                  <div className="grid grid-cols-2 gap-4 relative z-10 mb-4">
                    <div className="aspect-video bg-white rounded-lg border border-sand-200 flex items-center justify-center relative overflow-hidden p-4">
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-3 h-3 bg-forest-700 rounded-full animate-ping"></div>
                        <span className="text-sm font-bold text-ink">
                          Live Position
                        </span>
                      </div>
                    </div>
                    <div className="aspect-video bg-forest-50 rounded-lg border border-forest-200 flex flex-col justify-center px-4 relative overflow-hidden">
                      <div className="space-y-2">
                        <div className="flex justify-between text-[10px] text-sand-600">
                          <span>Status</span>
                          <span className="text-forest-700 font-bold">
                            ONLINE
                          </span>
                        </div>
                        <div className="flex justify-between text-[10px] text-sand-600">
                          <span>Mode</span>
                          <span className="text-ink font-mono">
                            Broadcast / Monitor
                          </span>
                        </div>
                        <div className="flex justify-between text-[10px] text-sand-600">
                          <span>Timezone</span>
                          <span className="text-ink font-mono">
                            WIB (UTC+7)
                          </span>
                        </div>
                        <div className="flex justify-between text-[10px] text-sand-600">
                          <span>Latency</span>
                          <span className="text-ink font-mono">
                            &lt; 100ms
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <h4 className="text-lg font-bold text-ink mb-2">
                    Command Center & Field Tracking
                  </h4>
                  <p className="text-xs text-sand-600 leading-relaxed mb-4">
                    Advanced personnel tracking system with Role-Based Access
                    Control.
                    <strong> Enterprise Monitors</strong> can visualize all
                    active field units in real-time, while
                    <strong> Pro Users</strong> can broadcast their secure
                    location data.
                  </p>

                  <div className="flex flex-wrap gap-2">
                    <span className="px-2 py-1 rounded bg-forest-50 border border-forest-200 text-[10px] text-forest-700 font-bold uppercase">
                      Realtime Websocket
                    </span>
                    <span className="px-2 py-1 rounded bg-forest-50 border border-forest-200 text-[10px] text-forest-700 font-bold uppercase">
                      Multi-User Support
                    </span>
                    <span className="px-2 py-1 rounded bg-forest-50 border border-forest-200 text-[10px] text-forest-700 font-bold uppercase">
                      Heartbeat Sync
                    </span>
                    <span className="px-2 py-1 rounded bg-forest-50 border border-forest-200 text-[10px] text-forest-700 font-bold uppercase">
                      5s Update Interval
                    </span>
                  </div>

                  <div className="mt-4 p-3 rounded-lg bg-gold-50 border border-gold-200">
                    <h5 className="text-xs font-bold text-gold-700 mb-1 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-gold-300 animate-pulse"></span>
                      Connectivity & Data Rate
                    </h5>
                    <p className="text-[10px] text-sand-600 leading-relaxed">
                      This feature requires an active internet connection
                      (4G/WiFi). Data is refreshed every{" "}
                      <strong>5 seconds</strong> to ensure realtime accuracy
                      while optimizing battery life. If connection is lost, data
                      is buffered locally and automatically flushed when back
                      online (Smart Reconnect).
                      <strong>
                        Offline tracking is currently not supported.
                      </strong>
                    </p>
                  </div>
                </div>
              </section>
            </div>

            <div className="space-y-8">
              {/* Terrain & Analysis Tools */}
              <section>
                <div className="flex items-center gap-3 text-ink mb-6">
                  <div className="p-2 bg-forest-50 rounded-lg border border-forest-200">
                    <Layers className="w-5 h-5 text-forest-700" />
                  </div>
                  <h3 className="text-2xl font-bold">Terrain Analysis</h3>
                </div>

                <div className="bg-white border border-sand-200 rounded-xl p-6 space-y-6">
                  {/* Data Source Info */}
                  <div className="p-4 bg-forest-50 rounded-lg border border-forest-200 mb-6">
                    <h4 className="text-sm font-bold text-forest-700 mb-2 flex items-center gap-2">
                      <Activity size={14} className="text-forest-700" /> Data
                      Sources
                    </h4>
                    <p className="text-xs text-sand-700 leading-relaxed">
                      Topographic data and contours are generated in real-time
                      from the <strong>Mapbox Terrain-RGB v1</strong> tile set.
                      This global Digital Elevation Model (DEM) aggregates data
                      from multiple sources:
                    </p>
                    <ul className="mt-2 space-y-1 ml-4 list-disc text-[11px] text-sand-600">
                      <li>
                        <strong>SRTM 30m</strong> (Shuttle Radar Topography
                        Mission) for global coverage.
                      </li>
                      <li>
                        <strong>ASTER GDEM</strong> (Advanced Spaceborne Thermal
                        Emission and Reflection Radiometer).
                      </li>
                      <li>
                        High-resolution local government data (LiDAR/Sonar)
                        where available (e.g., USGS, EEA).
                      </li>
                    </ul>
                    <p className="text-[10px] text-sand-500 mt-2 italic">
                      *Vertical accuracy varies by location (typically ±5m to
                      ±10m RMSE globally, sub-meter in high-res zones).
                    </p>
                  </div>

                  <div className="p-4 bg-sand-50 rounded-lg border border-sand-100">
                    <h4 className="text-sm font-bold text-ink mb-3 flex items-center gap-2">
                      <span className="w-2 h-2 bg-forest-700 rounded-full"></span>
                      Contour Configuration
                    </h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <span className="text-[10px] uppercase text-sand-500 font-bold tracking-wider">
                          Interval
                        </span>
                        <p className="text-xs text-sand-700">2.5m - 500m</p>
                      </div>
                      <div className="space-y-1">
                        <span className="text-[10px] uppercase text-sand-500 font-bold tracking-wider">
                          Exaggeration
                        </span>
                        <p className="text-xs text-sand-700">1.0x - 10.0x</p>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-sand-50 rounded-lg border border-sand-100">
                    <h4 className="text-sm font-bold text-ink mb-2 flex items-center gap-2">
                      <span className="w-2 h-2 bg-forest-700 rounded-full"></span>
                      Opacity Control
                    </h4>
                    <p className="text-xs text-sand-600">
                      Fine-tune the transparency of contour layers to blend
                      seamlessly with satellite imagery or street maps.
                    </p>
                  </div>
                </div>
              </section>

              {/* Geospatial Grid System */}
              <section>
                <div className="flex items-center gap-3 text-ink mb-6">
                  <div className="p-2 bg-forest-50 rounded-lg border border-forest-200">
                    <Globe className="w-5 h-5 text-forest-700" />
                  </div>
                  <h3 className="text-2xl font-bold">Geospatial Grid System</h3>
                </div>

                <div className="bg-white border border-sand-200 rounded-xl p-6 space-y-6">
                  <div className="p-4 bg-forest-50 rounded-lg border border-forest-200 mb-2">
                    <h4 className="text-sm font-bold text-forest-700 mb-2 flex items-center gap-2">
                      <Activity size={14} className="text-forest-700" /> Dynamic
                      DMS Grid
                    </h4>
                    <p className="text-xs text-sand-700 leading-relaxed">
                      A high-precision coordinate grid overlay that
                      automatically adjusts based on your zoom level. Displays
                      Latitude/Longitude in{" "}
                      <strong>DMS (Degrees, Minutes, Seconds)</strong> format
                      for professional cartography.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-4 bg-sand-50 rounded-lg border border-sand-100">
                      <h4 className="text-sm font-bold text-ink mb-3">
                        Scale-based Intervals
                      </h4>
                      <ul className="space-y-2 text-xs text-sand-600">
                        <li className="flex justify-between border-b border-sand-100 pb-1">
                          <span>1:10.000</span>
                          <span className="text-forest-700 font-mono">
                            15" (~450m)
                          </span>
                        </li>
                        <li className="flex justify-between border-b border-sand-100 pb-1">
                          <span>1:25.000</span>
                          <span className="text-forest-700 font-mono">
                            30" (~900m)
                          </span>
                        </li>
                        <li className="flex justify-between border-b border-sand-100 pb-1">
                          <span>1:50.000</span>
                          <span className="text-forest-700 font-mono">
                            1' (~1.8km)
                          </span>
                        </li>
                        <li className="flex justify-between pb-1">
                          <span>1:250.000</span>
                          <span className="text-forest-700 font-mono">
                            5' (~9km)
                          </span>
                        </li>
                      </ul>
                    </div>

                    <div className="p-4 bg-sand-50 rounded-lg border border-sand-100 flex flex-col justify-center">
                      <h4 className="text-sm font-bold text-ink mb-2">
                        Visual Customization
                      </h4>
                      <p className="text-xs text-sand-600 mb-3">
                        Full control over grid visibility to ensure it
                        complements your map without obstructing critical data.
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <span className="px-2 py-1 rounded bg-forest-50 border border-forest-200 text-[10px] text-forest-700 font-bold uppercase">
                          Adjustable Opacity
                        </span>
                        <span className="px-2 py-1 rounded bg-forest-50 border border-forest-200 text-[10px] text-forest-700 font-bold uppercase">
                          Auto-Scaling
                        </span>
                        <span className="px-2 py-1 rounded bg-forest-50 border border-forest-200 text-[10px] text-forest-700 font-bold uppercase">
                          Client-Side Rendering
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              {/* Export & Capture */}
              <section>
                <div className="flex items-center gap-3 text-ink mb-6">
                  <div className="p-2 bg-brick-50 rounded-lg border border-brick-200">
                    <Camera className="w-5 h-5 text-brick-600" />
                  </div>
                  <h3 className="text-2xl font-bold">Export Tools</h3>
                </div>

                <div className="bg-white border border-sand-200 rounded-xl p-6">
                  <div className="grid grid-cols-3 gap-3 mb-6">
                    <div className="text-center p-3 rounded-lg bg-sand-50 hover:bg-sand-100 transition-colors border border-sand-100">
                      <span className="block text-xs font-bold text-ink mb-1">
                        PNG
                      </span>
                      <span className="text-[10px] text-sand-500">
                        High Res
                      </span>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-sand-50 hover:bg-sand-100 transition-colors border border-sand-100">
                      <span className="block text-xs font-bold text-ink mb-1">
                        JPG
                      </span>
                      <span className="text-[10px] text-sand-500">
                        Compressed
                      </span>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-sand-50 hover:bg-sand-100 transition-colors border border-sand-100">
                      <span className="block text-xs font-bold text-ink mb-1">
                        PDF
                      </span>
                      <span className="text-[10px] text-sand-500">
                        Document
                      </span>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="text-xs font-bold text-sand-600 uppercase tracking-wider mb-2">
                      Included Metadata
                    </h4>
                    <div className="space-y-3">
                      <div className="flex items-start gap-3 p-3 bg-sand-50 rounded-lg border border-sand-100">
                        <div className="mt-0.5 text-brick-600 font-bold text-[10px]">
                          01
                        </div>
                        <div>
                          <strong className="text-ink text-xs block">
                            Geospatial Telemetry
                          </strong>
                          <p className="text-[10px] text-sand-600">
                            Exact Center Point coordinates (Lat/Lng), Average
                            Elevation (mdpl), and Heading/Pitch angles.
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3 p-3 bg-sand-50 rounded-lg border border-sand-100">
                        <div className="mt-0.5 text-brick-600 font-bold text-[10px]">
                          02
                        </div>
                        <div>
                          <strong className="text-ink text-xs block">
                            Survey Data Table
                          </strong>
                          <p className="text-[10px] text-sand-600">
                            Comprehensive list of all plotted points including
                            individual coordinates, elevation, and segment
                            distances.
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3 p-3 bg-sand-50 rounded-lg border border-sand-100">
                        <div className="mt-0.5 text-brick-600 font-bold text-[10px]">
                          03
                        </div>
                        <div>
                          <strong className="text-ink text-xs block">
                            Elevation Profile
                          </strong>
                          <p className="text-[10px] text-sand-600">
                            Visual chart showing Min, Max, and Elevation Gain
                            along the survey path.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <p className="text-[10px] text-sand-500 mt-4 text-center italic border-t border-sand-100 pt-4">
                    *Exports automatically hide UI controls for a clean,
                    presentation-ready output.
                  </p>
                </div>
              </section>
            </div>
          </div>

          {/* Video Tutorial */}
          {/* <section className="space-y-8 pt-8 border-t border-sand-100">
            <div className="flex items-center gap-3 text-ink mb-6">
              <div className="p-2 bg-brick-50 rounded-lg border border-brick-200">
                 <svg 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="2" 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    className="w-5 h-5 text-brick-600"
                 >
                    <path d="M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17" />
                    <path d="m10 15 5-3-5-3z" />
                 </svg>
              </div>
              <h3 className="text-2xl font-bold">Video Tutorials</h3>
            </div>

            <div className="grid md:grid-cols-2 gap-6"> */}
          {/* Video 1 */}
          {/* <div className="group bg-white border border-sand-200 rounded-xl overflow-hidden hover:border-brick-200 transition-all duration-300">
                    <div className="aspect-video relative bg-white">
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
                        <h4 className="font-bold text-ink mb-1 group-hover:text-brick-600 transition-colors">Quick Start Guide</h4>
                        <p className="text-xs text-sand-600">
                            Learn the basics of navigation, map styles, and essential tools in under 5 minutes.
                        </p>
                    </div>
                </div> */}

          {/* Video 2 */}
          {/* <div className="group bg-white border border-sand-200 rounded-xl overflow-hidden hover:border-brick-200 transition-all duration-300">
                     <div className="aspect-video relative bg-white">
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
                        <h4 className="font-bold text-ink mb-1 group-hover:text-brick-600 transition-colors">Advanced Analysis</h4>
                        <p className="text-xs text-sand-600">
                            Deep dive into contour configuration, slope measurement, and exporting professional reports.
                        </p>
                    </div>
                </div>
            </div>
          </section> */}

          {/* Real-time Telemetry & Tooltips */}
          <section className="space-y-8 pt-8 border-t border-sand-100">
            <div className="flex items-center gap-3 text-ink mb-6">
              <div className="p-2 bg-gold-50 rounded-lg border border-gold-200">
                <Activity className="w-5 h-5 text-gold-700" />
              </div>
              <h3 className="text-2xl font-bold">Real-time Telemetry</h3>
            </div>

            <div className="space-y-12">
              {/* Navigator Tooltip */}
              <div className="space-y-4">
                <h4 className="text-lg font-bold text-ink">
                  Navigator Tooltip
                </h4>
                <p className="text-xs text-sand-600 leading-relaxed">
                  When using Navigator Mode (Plotting), a reactive tooltip
                  appears next to your cursor to provide instant feedback before
                  you place a point.
                </p>

                <div className="bg-white border border-sand-200 rounded-xl p-6 flex flex-col items-center justify-center relative overflow-hidden group">
                  {/* Mock Map Background */}
                  <div className="absolute inset-0 bg-forest-50 blur-sm opacity-50"></div>

                  {/* The Tooltip UI */}
                  <div className="relative z-10 bg-sand-200 backdrop-blur-md text-ink text-[10px] rounded px-3 py-2 shadow-xl border border-sand-300 flex flex-col gap-1 min-w-[140px] transform group-hover:scale-105 transition-transform duration-300">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sand-700 font-bold uppercase text-[8px]">
                        Azim
                      </span>
                      <span className="font-bold font-mono text-ink">
                        120.0°
                      </span>
                    </div>
                  </div>

                  {/* Caption */}
                  <div className="absolute bottom-2 left-0 right-0 text-center">
                    <span className="text-[9px] text-sand-500 font-mono uppercase tracking-widest">
                      Reactive Feedback
                    </span>
                  </div>
                </div>

                <div className="grid gap-3 mt-4">
                  <div className="bg-sand-50 p-3 rounded-lg border border-sand-100">
                    <span className="text-[10px] font-bold text-sand-600 block mb-1">
                      AZIM (Azimuth)
                    </span>
                    <p className="text-[10px] text-sand-700">
                      The compass bearing (0-360°) from your last point to the
                      cursor location. Essential for orienteering.
                    </p>
                  </div>
                </div>
              </div>

              {/* Telemetry Overlay */}
              <div className="space-y-4">
                <h4 className="text-lg font-bold text-ink">
                  Survey Data Panel
                </h4>
                <p className="text-xs text-sand-600 leading-relaxed">
                  Comprehensive metrics for the currently viewed area or active
                  survey segment.
                </p>

                <div className="bg-white border border-sand-200 rounded-xl p-4 relative overflow-hidden">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <div className="flex justify-between border-b border-sand-200 pb-1">
                        <span className="text-[10px] text-forest-700">Lat</span>
                        <span className="text-[10px] font-mono text-ink">
                          -6.68397{" "}
                          <span className="text-sand-500 text-[9px]">
                            (6°41'2.30" S)
                          </span>
                        </span>
                      </div>
                      <div className="flex justify-between border-b border-sand-200 pb-1">
                        <span className="text-[10px] text-forest-700">Lng</span>
                        <span className="text-[10px] font-mono text-ink">
                          106.97216{" "}
                          <span className="text-sand-500 text-[9px]">
                            (106°58'19.76" E)
                          </span>
                        </span>
                      </div>
                      <div className="flex justify-between border-b border-sand-200 pb-1">
                        <span className="text-[10px] text-forest-700">Elev</span>
                        <span className="text-[10px] font-mono text-gold-700">
                          1214.3 mdpl
                        </span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between border-b border-sand-200 pb-1">
                        <span className="text-[10px] text-forest-700">Pitch</span>
                        <span className="text-[10px] font-mono text-ink">
                          0.0°
                        </span>
                      </div>
                      <div className="flex justify-between border-b border-sand-200 pb-1">
                        <span className="text-[10px] text-forest-700">
                          Bearing
                        </span>
                        <span className="text-[10px] font-mono text-ink">
                          0.0°
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 bg-sand-50 rounded-lg p-3 border border-sand-200">
                    <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                      <div>
                        <span className="text-[9px] text-sand-500 font-bold block">
                          AZIMUTH
                        </span>
                        <span className="text-xs font-mono text-gold-700 font-bold">
                          120.0°
                        </span>
                      </div>
                      <div>
                        <span className="text-[9px] text-sand-500 font-bold block">
                          BACK AZIMUTH
                        </span>
                        <span className="text-xs font-mono text-gold-700 font-bold">
                          300.0°
                        </span>
                      </div>
                      <div>
                        <span className="text-[9px] text-sand-500 font-bold block">
                          HORIZ DIST
                        </span>
                        <span className="text-xs font-mono text-forest-700 font-bold">
                          110.8 m
                        </span>
                      </div>
                      <div>
                        <span className="text-[9px] text-sand-500 font-bold block">
                          SLOPE
                        </span>
                        <span className="text-xs font-mono text-brick-600 font-bold">
                          18.7%{" "}
                          <span className="text-sand-500 font-normal text-[9px]">
                            (10.6°)
                          </span>
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mt-4">
                  <div className="bg-sand-50 p-3 rounded-lg border border-sand-100">
                    <span className="text-[10px] font-bold text-sand-600 block mb-1">
                      Back Azimuth
                    </span>
                    <p className="text-[10px] text-sand-700">
                      The reverse bearing (opposite direction) of the current
                      line. Useful for verifying return paths.
                    </p>
                  </div>
                  <div className="bg-sand-50 p-3 rounded-lg border border-sand-100">
                    <span className="text-[10px] font-bold text-sand-600 block mb-1">
                      Slope % (Deg)
                    </span>
                    <p className="text-[10px] text-sand-700">
                      Gradient steepness. Shown in percentage for grade and
                      degrees (°) for angle. Red values indicate &gt;15%
                      steepness.
                    </p>
                  </div>
                  <div className="bg-sand-50 p-3 rounded-lg border border-sand-100">
                    <span className="text-[10px] font-bold text-sand-600 block mb-1">
                      Pitch
                    </span>
                    <p className="text-[10px] text-sand-700">
                      Camera tilt angle (0-60°). 0° is top-down view, while
                      higher values provide a 3D perspective view.
                    </p>
                  </div>
                  <div className="bg-sand-50 p-3 rounded-lg border border-sand-100">
                    <span className="text-[10px] font-bold text-sand-600 block mb-1">
                      Bearing
                    </span>
                    <p className="text-[10px] text-sand-700">
                      Current camera heading/direction relative to North (0°).
                      Rotates as you orbit the map.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Custom Basemaps */}
          <section className="space-y-8 pt-8 border-t border-sand-100">
            <div className="flex items-center gap-3 text-ink mb-6">
              <div className="p-2 bg-forest-50 rounded-lg border border-forest-200">
                <Layers className="w-5 h-5 text-forest-700" />
              </div>
              <h3 className="text-2xl font-bold">Custom Basemaps Manager</h3>
              <span className="px-2 py-1 rounded bg-forest-50 text-[10px] text-forest-700 font-bold uppercase border border-forest-200">
                Enterprise
              </span>
            </div>

            <div className="bg-white border border-sand-200 rounded-xl p-6 relative overflow-hidden group hover:border-forest-200 transition-all duration-300">
              <div className="absolute top-0 right-0 w-32 h-32 bg-forest-50 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>

              <div className="grid md:grid-cols-2 gap-6 relative z-10">
                <div className="space-y-4">
                  <h4 className="text-lg font-bold text-ink">
                    Bring Your Own Maps
                  </h4>
                  <p className="text-xs text-sand-600 leading-relaxed">
                    Upload high-resolution <strong>GeoTIFF</strong> or{" "}
                    <strong>GeoPDF</strong> files to overlay on the 3D terrain.
                    Ideal for project-specific site plans, historical maps, or
                    drone orthomosaics.
                  </p>

                  <div className="space-y-3 pt-2">
                    <div className="flex items-start gap-3 p-3 bg-sand-50 rounded-lg border border-sand-100">
                      <div className="mt-0.5 text-forest-700 font-bold text-[10px]">
                        01
                      </div>
                      <div>
                        <strong className="text-ink text-xs block">
                          Visual Georeferencing
                        </strong>
                        <p className="text-[10px] text-sand-600">
                          Interactive tool to manually position, scale, and
                          rotate non-georeferenced PDFs or images directly on
                          the map canvas.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 p-3 bg-sand-50 rounded-lg border border-sand-100">
                      <div className="mt-0.5 text-forest-700 font-bold text-[10px]">
                        02
                      </div>
                      <div>
                        <strong className="text-ink text-xs block">
                          Auto-Reprojection
                        </strong>
                        <p className="text-[10px] text-sand-600">
                          Automatic detection and reprojection of GeoTIFFs to
                          WGS84 coordinate system for seamless integration.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-forest-50 rounded-lg border border-forest-200 p-4 flex flex-col justify-center">
                  <div className="space-y-2 mb-4">
                    <div className="flex justify-between items-center text-xs text-forest-700">
                      <span>Supported Formats</span>
                      <span className="font-bold">GeoTIFF, GeoPDF</span>
                    </div>
                    <div className="flex justify-between items-center text-xs text-forest-700">
                      <span>Max Resolution</span>
                      <span className="font-bold">2500px (Optimized)</span>
                    </div>
                    <div className="flex justify-between items-center text-xs text-forest-700">
                      <span>Storage</span>
                      <span className="font-bold">5 MB Limit (Cloud)</span>
                    </div>
                  </div>

                  <div className="mt-auto p-3 rounded bg-forest-50 border border-forest-200">
                    <p className="text-[10px] text-forest-700 italic text-center">
                      "Essential for cross-referencing official survey data with
                      real-world terrain features."
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Marked Locations */}
          <section className="space-y-8 pt-8 border-t border-sand-100">
            <div className="flex items-center gap-3 text-ink mb-6">
              <div className="p-2 bg-gold-50 rounded-lg border border-gold-200">
                <MapPinned className="w-5 h-5 text-gold-700" />
              </div>
              <h3 className="text-2xl font-bold">Marked Locations</h3>
              <span className="px-2 py-1 rounded bg-gold-50 text-[10px] text-gold-700 font-bold uppercase border border-gold-200">
                All Accounts
              </span>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-white border border-sand-200 rounded-xl p-6 space-y-4">
                <h4 className="text-lg font-bold text-ink">Save Places That Matter</h4>
                <p className="text-xs text-sand-600 leading-relaxed">
                  Keep your own list of important places on the map: one location
                  or hundreds. Each location stores its <strong>name</strong>,{" "}
                  <strong>category</strong>, <strong>coordinates</strong> (decimal and
                  DMS), <strong>elevation</strong>, <strong>area / address</strong>,{" "}
                  <strong>contact</strong>, a <strong>description</strong> and up to 10{" "}
                  <strong>tags</strong>.
                </p>

                <div className="space-y-3">
                  {[
                    {
                      title: "Add a location",
                      desc: "Open Marked Locations in Tools & Exploration and press Add. Set the position with Pick on map (elevation is filled in from the terrain), Map center, My GPS, or type the latitude and longitude.",
                    },
                    {
                      title: "Find it again",
                      desc: "Search by name, tag or area. Click a location in the list to fly to it, or click its marker on the map to see every detail, get Directions, or copy the coordinates.",
                    },
                    {
                      title: "Export",
                      desc: "Download the listed or selected locations as a GPX file, ready for Garmin, OsmAnd, Avenza and most GPS apps.",
                    },
                  ].map((step, i) => (
                    <div key={step.title} className="flex items-start gap-3 p-3 bg-sand-50 rounded-lg border border-sand-100">
                      <div className="mt-0.5 text-gold-700 font-bold text-[10px]">
                        {String(i + 1).padStart(2, "0")}
                      </div>
                      <div>
                        <strong className="text-ink text-xs block">{step.title}</strong>
                        <p className="text-[10px] text-sand-600">{step.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div>
                  <h5 className="text-xs font-bold text-sand-600 uppercase tracking-wider mb-2">
                    Categories
                  </h5>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      "Point of Interest",
                      "Camp / Basecamp",
                      "Summit",
                      "Water Source",
                      "Shelter / Pos",
                      "Viewpoint",
                      "Trailhead",
                      "Hazard",
                      "Cave",
                      "Parking",
                    ].map((c) => (
                      <span key={c} className="px-2 py-1 rounded bg-gold-50 border border-gold-200 text-[10px] text-gold-700 font-bold">
                        {c}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div className="bg-white border border-sand-200 rounded-xl p-6 space-y-3">
                  <h4 className="text-lg font-bold text-ink">Share with Other Users</h4>
                  <p className="text-xs text-sand-600 leading-relaxed">
                    Share one location, or tick several and share them all at once, with
                    another Landscape 360 account. Type their <strong>email</strong> or
                    their exact <strong>display name</strong>; if several accounts use the
                    same name, share by email instead.
                  </p>
                  <ul className="space-y-2 text-[11px] text-sand-700">
                    <li className="flex gap-2">
                      <span className="text-gold-700">•</span> Recipients find it under the{" "}
                      <strong>Shared</strong> tab and on their map. They can view it but not
                      change it.
                    </li>
                    <li className="flex gap-2">
                      <span className="text-gold-700">•</span> Owners can see who has access
                      and remove it at any time. Recipients can remove a shared location from
                      their own list.
                    </li>
                    <li className="flex gap-2">
                      <span className="text-gold-700">•</span> Email addresses of other users
                      are always shown masked (e.g. <span className="font-mono">s***@gmail.com</span>).
                    </li>
                  </ul>
                  <div className="flex flex-wrap gap-3 pt-2 text-[10px] text-sand-600">
                    <span className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-full bg-forest-700 ring-2 ring-white shadow" /> Ring: white = yours
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-full bg-forest-700 ring-2 ring-gold-300 shadow" /> gold = shared with you
                    </span>
                  </div>
                </div>

                <div className="bg-white border border-sand-200 rounded-xl p-6">
                  <h4 className="text-sm font-bold text-ink mb-3">Limits by Account</h4>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left text-[10px] uppercase tracking-wider text-sand-500 border-b border-sand-200">
                        <th className="py-2 font-bold">Account</th>
                        <th className="py-2 font-bold">Locations</th>
                        <th className="py-2 font-bold">Share</th>
                      </tr>
                    </thead>
                    <tbody className="text-sand-700">
                      <tr className="border-b border-sand-100">
                        <td className="py-2 font-bold">Free</td>
                        <td className="py-2 font-mono">10</td>
                        <td className="py-2">Receive only</td>
                      </tr>
                      <tr className="border-b border-sand-100">
                        <td className="py-2 font-bold">Pro</td>
                        <td className="py-2 font-mono">100</td>
                        <td className="py-2 text-forest-700 font-bold">✓</td>
                      </tr>
                      <tr>
                        <td className="py-2 font-bold">Enterprise</td>
                        <td className="py-2 font-mono">1,000</td>
                        <td className="py-2 text-forest-700 font-bold">✓</td>
                      </tr>
                    </tbody>
                  </table>
                  <p className="text-[10px] text-sand-500 mt-3 leading-relaxed">
                    Every account can receive shared locations. Locations need an internet
                    connection to load and save.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Accounts & Access */}
          <section className="space-y-8 pt-8 border-t border-sand-100">
            <div className="flex items-center gap-3 text-ink mb-6">
              <div className="p-2 bg-forest-50 rounded-lg border border-forest-200">
                <ShieldCheck className="w-5 h-5 text-forest-700" />
              </div>
              <h3 className="text-2xl font-bold">Accounts & Access</h3>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-white border border-sand-200 rounded-xl p-6 space-y-3">
                <h4 className="text-lg font-bold text-ink flex items-center gap-2">
                  <UserPlus size={18} className="text-forest-700" /> Request an Account
                </h4>
                <p className="text-xs text-sand-600 leading-relaxed">
                  To get an account, click <strong>Sign In / Register</strong> and then{" "}
                  <strong>Request Account</strong>. All fields are required: email, full name,
                  organization, phone / WhatsApp and a short message about how you will use
                  Landscape 360. New accounts start on the <strong>Free</strong> plan; Pro and
                  Enterprise are available as an upgrade once your account is active.
                </p>
                <ul className="space-y-2 text-[11px] text-sand-700">
                  <li className="flex gap-2">
                    <span className="text-forest-700">•</span> Our team reviews your request and
                    emails your login details once it is approved.
                  </li>
                  <li className="flex gap-2">
                    <span className="text-forest-700">•</span> Only one open request per email
                    address is kept, so there is no need to send it twice.
                  </li>
                  <li className="flex gap-2">
                    <span className="text-forest-700">•</span> Forgot your password? Use{" "}
                    <strong>Forgot Password</strong> in the same window to contact us.
                  </li>
                </ul>
              </div>

              <div className="bg-white border border-sand-200 rounded-xl p-6 space-y-3">
                <h4 className="text-lg font-bold text-ink flex items-center gap-2">
                  <HardDrive size={18} className="text-forest-700" /> Cloud Storage
                </h4>
                <p className="text-xs text-sand-600 leading-relaxed">
                  Every account has a cloud storage limit shared by its{" "}
                  <strong>recorded tracks</strong>, <strong>marked locations</strong>,{" "}
                  <strong>surveys</strong> and <strong>custom basemaps</strong>. Your usage
                  is shown in the <strong>User Account</strong> menu (hover it for the
                  breakdown per feature).
                </p>
                <div className="bg-forest-50 rounded-lg border border-forest-200 p-3 space-y-1.5">
                  {[
                    ["Free", "10 MB"],
                    ["Pro", "100 MB"],
                    ["Enterprise", "1 GB"],
                  ].map(([plan, limit]) => (
                    <div key={plan} className="flex justify-between items-center text-xs text-forest-700 border-b border-forest-200 last:border-0 pb-1">
                      <span>{plan}</span>
                      <span className="font-bold font-mono">{limit}</span>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-sand-600 leading-relaxed">
                  When the limit is reached, new data is not saved until you delete
                  something. Deleting or shortening data always works, and nothing is ever
                  removed automatically. Offline maps are stored on your device and have
                  their own limits. Need more space? Contact us at{" "}
                  <strong>contact@jcdigital.co.id</strong>.
                </p>
              </div>
            </div>
          </section>

          {/* Pricing & Plans (temporarily hidden, see SHOW_PRICING) */}
          {SHOW_PRICING && (
          <section className="space-y-8 pt-8 border-t border-sand-100">
            <div className="text-center max-w-2xl mx-auto space-y-3">
              <h3 className="text-2xl font-bold text-ink">Pricing & Plans</h3>
              <p className="text-sm text-sand-600">
                Flexible options for individual users and professional teams.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              {/* Free Plan */}
              <div className="bg-white border border-sand-200 rounded-xl p-6 flex flex-col hover:border-sand-300 transition-all duration-300">
                <div className="mb-4">
                  <span className="text-xs font-bold px-2 py-1 bg-sand-100 text-sand-700 rounded uppercase tracking-wider">
                    Starter
                  </span>
                </div>
                <h4 className="text-2xl font-bold text-ink mb-1">Free</h4>
                <p className="text-xs text-sand-600 mb-6">
                  Basic exploration tools
                </p>

                <ul className="space-y-3 mb-8 flex-1">
                  <li className="flex items-center gap-2 text-xs text-sand-700">
                    <span className="w-1.5 h-1.5 rounded-full bg-sand-400"></span>{" "}
                    1 MB Max Download
                  </li>
                  <li className="flex items-center gap-2 text-xs text-sand-700">
                    <span className="w-1.5 h-1.5 rounded-full bg-sand-400"></span>{" "}
                    1 Offline Maps
                  </li>
                  <li className="flex items-center gap-2 text-xs text-sand-700">
                    <span className="w-1.5 h-1.5 rounded-full bg-sand-400"></span>{" "}
                    2 Saved Surveys
                  </li>
                  <li className="flex items-center gap-2 text-xs text-sand-500 line-through decoration-sand-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-brick-100"></span>{" "}
                    No GPS Tracking
                  </li>
                </ul>

                <a
                  href="mailto:contact@jcdigital.co.id?subject=Account Request: Landscape360 Starter Plan&body=Dear Admin,%0D%0A%0D%0AI hope this message finds you well.%0D%0A%0D%0AI would like to request the creation of a Starter (Free) account for the Landscape360 platform.%0D%0A%0D%0APlease let me know if any further information is required from my side.%0D%0A%0D%0AThank you,%0D%0A[Your Name]"
                  className="block w-full py-2 text-center rounded-lg bg-sand-50 hover:bg-sand-100 text-xs font-bold text-ink border border-sand-200 transition-colors"
                >
                  Request Account
                </a>
              </div>

              {/* Pro Plan */}
              <div className="bg-forest-50 border border-forest-200 rounded-xl p-6 flex flex-col relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-24 h-24 bg-forest-50 blur-2xl -translate-y-1/2 translate-x-1/2 group-hover:bg-forest-50 transition-all"></div>
                <div className="mb-4 flex items-center justify-between">
                  <span className="text-xs font-bold px-2 py-1 bg-forest-50 text-forest-700 rounded uppercase tracking-wider border border-forest-200">
                    Recommended
                  </span>
                  <span className="text-[10px] font-bold px-2 py-1 bg-brick-50 text-brick-600 rounded uppercase tracking-wider border border-brick-200 animate-pulse">
                    Promo
                  </span>
                </div>
                <div className="flex items-end gap-2 mb-1">
                  <span className="text-sm text-sand-500 line-through decoration-brick-600 decoration-1">
                    Rp 85.000
                  </span>
                </div>
                <h4 className="text-2xl font-bold text-ink mb-1">
                  Rp 10.000
                  <span className="text-sm font-normal text-sand-500">
                    /bln
                  </span>
                </h4>
                <p className="text-xs text-sand-600 mb-6">
                  For field professionals
                </p>

                <ul className="space-y-3 mb-8 flex-1">
                  <li className="flex items-center gap-2 text-xs text-sand-800">
                    <span className="w-1.5 h-1.5 rounded-full bg-forest-700"></span>{" "}
                    10 MB Max Download
                  </li>
                  <li className="flex items-center gap-2 text-xs text-sand-800">
                    <span className="w-1.5 h-1.5 rounded-full bg-forest-700"></span>{" "}
                    3 Offline Maps
                  </li>
                  <li className="flex items-center gap-2 text-xs text-sand-800">
                    <span className="w-1.5 h-1.5 rounded-full bg-forest-700"></span>{" "}
                    4 Saved Surveys
                  </li>
                  <li className="flex items-center gap-2 text-xs text-sand-800">
                    <span className="w-1.5 h-1.5 rounded-full bg-forest-700"></span>{" "}
                    High-Res Export
                  </li>
                  <li className="flex items-center gap-2 text-xs text-ink font-bold">
                    <span className="w-1.5 h-1.5 rounded-full bg-forest-500"></span>{" "}
                    GPS Broadcast
                  </li>
                </ul>

                <a
                  href="mailto:contact@jcdigital.co.id?subject=Request Upgrade to Pro Plan"
                  className="block w-full py-2 text-center rounded-lg bg-forest-800 hover:bg-forest-700 text-xs font-bold text-white transition-colors"
                >
                  Upgrade to Pro
                </a>
              </div>

              {/* Enterprise Plan */}
              <div className="bg-white border border-sand-200 rounded-xl p-6 flex flex-col hover:border-forest-200 transition-all duration-300">
                <div className="mb-4 flex items-center justify-between">
                  <span className="text-xs font-bold px-2 py-1 bg-forest-100 text-forest-700 rounded uppercase tracking-wider border border-forest-200">
                    Enterprise
                  </span>
                </div>   
                <h4 className="text-2xl font-bold text-ink mb-6">
                  Available Upon Request
                </h4>

                <ul className="space-y-3 mb-8 flex-1">
                  <li className="flex items-center gap-2 text-xs text-sand-700">
                    <span className="w-1.5 h-1.5 rounded-full bg-forest-700"></span>{" "}
                    25 MB Max Download
                  </li>
                  <li className="flex items-center gap-2 text-xs text-sand-700">
                    <span className="w-1.5 h-1.5 rounded-full bg-forest-700"></span>{" "}
                    10 Offline Maps
                  </li>
                  <li className="flex items-center gap-2 text-xs text-sand-700">
                    <span className="w-1.5 h-1.5 rounded-full bg-forest-700"></span>{" "}
                    10 Saved Surveys
                  </li>
                  <li className="flex items-center gap-2 text-xs text-ink font-bold">
                    <span className="w-1.5 h-1.5 rounded-full bg-forest-500"></span>{" "}
                    Realtime Monitoring
                  </li>
                  <li className="flex items-center gap-2 text-xs text-ink font-bold">
                    <span className="w-1.5 h-1.5 rounded-full bg-forest-500"></span>{" "}
                    Custom Basemaps (5MB)
                  </li>
                  <li className="flex items-center gap-2 text-xs text-sand-700">
                    <span className="w-1.5 h-1.5 rounded-full bg-forest-700"></span>{" "}
                    24/7 Priority Support
                  </li>
                </ul>

                <a
                  href="mailto:contact@jcdigital.co.id?subject=Subscription Upgrade: Landscape360 Enterprise Plan&body=Dear Admin,%0D%0A%0D%0AI hope this message finds you well.%0D%0A%0D%0AWe are interested in upgrading our organization's access to the Landscape360 Enterprise Plan to leverage the Realtime Monitoring and dedicated support features.%0D%0A%0D%0APlease contact us to arrange the upgrade and discuss any specific requirements.%0D%0A%0D%0ABest regards,%0D%0A[Your Name/Organization]"
                  className="block w-full py-2 text-center rounded-lg bg-sand-50 hover:bg-sand-100 text-xs font-bold text-ink border border-sand-200 transition-colors"
                >
                  Upgrade to Enterprise
                </a>
              </div>
            </div>
          </section>
          )}

          {/* Footer */}
          <footer className="pt-16 pb-8 border-t border-sand-100 text-center">
            <div className="max-w-4xl mx-auto px-4">
              <div className="group inline-flex flex-col items-center gap-2 mb-10">
                <div className="flex items-center gap-2 mb-1">
                  <span className="h-[1px] w-6 bg-forest-100"></span>
                  <p className="text-[10px] uppercase tracking-[0.4em] text-forest-700 font-bold">
                    Contact Information
                  </p>
                  <span className="h-[1px] w-6 bg-forest-100"></span>
                </div>

                <a
                  href="mailto:contact@jcdigital.co.id"
                  className="relative text-base sm:text-lg text-sand-700 hover:text-ink transition-all duration-300 font-light tracking-wide italic"
                >
                  contact@jcdigital.co.id
                </a>

                <div className="mt-10 flex flex-col items-center gap-6">
                  <p className="text-[9px] uppercase tracking-[0.3em] text-sand-400 font-bold">
                    In Collaboration With
                  </p>

                  <div className="flex flex-wrap justify-center gap-4">
                    <a
                      href="https://instagram.com/jcdigital.co.id"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group flex items-center gap-3 px-5 py-2.5 bg-white border border-sand-100 rounded-full hover:border-brick-200 transition-all duration-300 "
                    >
                      <Instagram size={14} className="text-brick-600" />
                      <span className="text-[10px] font-bold tracking-widest text-sand-600 group-hover:text-ink transition-colors">
                        JENDELA CAKRA DIGITAL
                      </span>
                    </a>

                    <a
                      href="https://www.instagram.com/makopala_ubl/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group flex items-center gap-3 px-5 py-2.5 bg-white border border-sand-100 rounded-full hover:border-forest-200 transition-all duration-300 "
                    >
                      <Instagram size={14} className="text-forest-700" />
                      <span className="text-[10px] font-bold tracking-widest text-sand-600 group-hover:text-ink transition-colors">
                        MAKOPALA UBL
                      </span>
                    </a>
                  </div>
                </div>
              </div>

              <div className="flex flex-col md:flex-row items-center justify-between gap-6 pt-8 border-t border-sand-100 opacity-40 text-[10px] tracking-widest uppercase font-medium text-sand-500">
                <div className="flex items-center gap-4">
                  <span>Precision Mapping</span>
                  <span className="w-1 h-1 rounded-full bg-sand-200"></span>
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
