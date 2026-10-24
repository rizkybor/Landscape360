import type { ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, type LucideIcon } from "lucide-react";
import landscapeLogo from "../assets/LandscapeLogo.svg";
import { SEO } from "./SEO";

const SITE_LINKS = [
  { to: "/docs", label: "Documentation", short: "Docs" },
  { to: "/reviews", label: "Reviews", short: "Reviews" },
  { to: "/faq", label: "FAQ", short: "FAQ" },
  { to: "/terms", label: "Terms & Conditions", short: "Terms" },
  { to: "/privacy", label: "Privacy Policy", short: "Privacy" },
];

// Links to the content pages; used in page footers and the map sidebar
export const SiteLinks = ({
  className = "",
  compact = false,
  omit = [],
}: {
  className?: string;
  compact?: boolean;
  omit?: string[];
}) => {
  const linkClass = compact
    ? "text-[10px] text-sand-500 hover:text-forest-700 transition-colors"
    : "text-xs text-sand-600 hover:text-forest-700 transition-colors";
  return (
    <nav className={`flex flex-wrap items-center justify-center gap-x-3 gap-y-1 ${className}`} aria-label="Site">
      {SITE_LINKS.filter((l) => !omit.includes(l.to)).map((l) => (
        <Link key={l.to} to={l.to} className={linkClass}>
          {compact ? l.short : l.label}
        </Link>
      ))}
    </nav>
  );
};

interface Props {
  title: string;
  subtitle?: string;
  icon: LucideIcon;
  seoDescription: string;
  path: string;
  headerAction?: ReactNode;
  children: ReactNode;
}

// Shared shell for the Reviews, FAQ, Terms and Privacy pages
export const SitePageLayout = ({ title, subtitle, icon: Icon, seoDescription, path, headerAction, children }: Props) => {
  const navigate = useNavigate();
  return (
    // 100dvh: on phones 100vh is taller than the visible area (browser bars), hiding the footer
    <div className="h-screen h-dvh bg-white text-ink font-sans overflow-hidden flex flex-col">
      <SEO title={title} description={seoDescription} url={`https://landscape360.jcdigital.co.id${path}`} />

      <header className="shrink-0 sticky top-0 z-50 bg-white/95 backdrop-blur-xl border-b border-sand-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => navigate("/")}
              className="group cursor-pointer p-2 hover:bg-sand-100 rounded-full transition-all text-sand-600 hover:text-ink shrink-0"
              title="Back to the map"
              aria-label="Back to the map"
            >
              <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
            </button>
            <img src={landscapeLogo} alt="Landscape 360" className="w-8 h-8 object-contain shrink-0" />
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-bold leading-none flex items-center gap-2 truncate">
                <Icon className="w-4 h-4 text-forest-700 shrink-0" /> {title}
              </h1>
              {subtitle && <p className="text-[10px] text-sand-600 font-mono mt-1 truncate">{subtitle}</p>}
            </div>
          </div>
          {headerAction && <div className="shrink-0 w-40 sm:w-48">{headerAction}</div>}
        </div>
      </header>

      {/* Column layout: the content fills the free height, so the footer sits at the bottom
          of the screen on short pages and after the content on long ones */}
      <main className="flex-1 overflow-y-auto custom-scrollbar flex flex-col">
        <div className="flex-1 w-full max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12">{children}</div>

        <footer className="shrink-0 border-t border-sand-100 py-8 px-4 text-center space-y-3">
          <SiteLinks />
          <p className="text-[10px] uppercase tracking-widest text-sand-400">
            © {new Date().getFullYear()} Landscape 360 · contact@jcdigital.co.id
          </p>
        </footer>
      </main>
    </div>
  );
};

// Headed block of text for the legal pages
export const LegalSection = ({ id, title, children }: { id?: string; title: string; children: ReactNode }) => (
  <section id={id} className="scroll-mt-24 space-y-3">
    <h2 className="text-lg font-bold text-ink">{title}</h2>
    <div className="space-y-3 text-sm text-sand-700 leading-relaxed [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1.5 [&_strong]:text-ink">
      {children}
    </div>
  </section>
);
