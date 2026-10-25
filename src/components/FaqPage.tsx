import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, HelpCircle, Search } from "lucide-react";
import { SitePageLayout } from "./SitePageLayout";

interface Faq {
  q: string;
  a: React.ReactNode;
  text: string; // plain text for search
}

const faq = (q: string, text: string, a?: React.ReactNode): Faq => ({ q, text, a: a ?? text });

const GROUPS: { title: string; items: Faq[] }[] = [
  {
    title: "Getting started",
    items: [
      faq(
        "What is Landscape 360?",
        "Landscape 360 is a web app for outdoor navigation: 2D and 3D terrain maps, contour lines, survey tools, offline maps, GPS tracking and saved places, built for hikers, climbers and field teams.",
      ),
      faq(
        "Do I need an account?",
        "You can explore the map, terrain, contours, search, weather and route planner without an account. Saving surveys, offline maps, marked locations, tracks and writing reviews need an account.",
      ),
      faq(
        "How do I get an account?",
        "Click Sign In / Register, choose Request Account and fill in the form. Our team reviews every request and emails your login details once it is approved. New accounts start on the Free plan.",
      ),
      faq(
        "Does it work on my phone?",
        "Yes. Landscape 360 runs in any modern browser on Android, iPhone and desktop. You can also add it to your home screen to open it like an app.",
      ),
    ],
  },
  {
    title: "Plans & limits",
    items: [
      faq(
        "What is included in Free, Pro and Enterprise?",
        "Every plan includes the map, terrain, contours, search, weather, route planner, survey tools and exports. Pro and Enterprise add more offline maps, surveys, marked locations, sharing, GPS tracking and more cloud storage. See the Plans & Features section of the Documentation for the full comparison.",
        <>
          Every plan includes the map, terrain, contours, search, weather, route planner, survey
          tools and exports. Pro and Enterprise add more offline maps, surveys, marked locations,
          sharing, GPS tracking and more cloud storage. See <strong>Plans & Features</strong> in
          the <Link to="/docs" className="text-forest-700 font-semibold hover:underline">Documentation</Link>{" "}
          for the full comparison.
        </>,
      ),
      faq(
        "How do I upgrade my plan?",
        "Send a request by email to contact@jcdigital.co.id with the email of your Landscape 360 account and the plan you need. Upgrades are handled by our team.",
      ),
      faq(
        "What happens when I reach my storage limit?",
        "Nothing is deleted. New data simply isn't saved to the cloud until you free up space or your limit is raised. Track recordings stay safe on your device and can be uploaded later. Your usage is shown in the User Account menu.",
      ),
    ],
  },
  {
    title: "Maps & navigation",
    items: [
      faq(
        "How do offline maps work?",
        "Draw an area and download it while you have signal. The map tiles are stored on your device, so that area keeps working without internet. The number and size of offline maps depend on your plan.",
      ),
      faq(
        "Can Landscape 360 replace a map and compass?",
        "No. Use it as a planning and navigation aid, and always carry a paper map, compass and enough battery. GPS, elevation and route data can be inaccurate, especially in steep terrain, forests or poor weather.",
      ),
      faq(
        "Where does the weather data come from?",
        "Weather information comes from BMKG (Badan Meteorologi, Klimatologi, dan Geofisika). Always check official forecasts before your trip.",
      ),
      faq(
        "Why is the Directions button opening Google Maps?",
        "Directions to a marked location open Google Maps with the destination filled in, so you get turn-by-turn road directions. It needs an internet connection.",
      ),
    ],
  },
  {
    title: "Tracking, locations & sharing",
    items: [
      faq(
        "Does the Track Recorder work without signal?",
        "Yes. Every GPS point is saved on your device first, so recording continues without signal and survives a closed browser. In online mode, tracks sync to the cloud when the connection returns.",
      ),
      faq(
        "Who can see my location and tracks?",
        "Only you, unless you share them. Marked locations and tracks are visible to the accounts you share them with. Live GPS broadcast is visible to monitor accounts of your team. You can stop sharing at any time.",
      ),
      faq(
        "How do I share a marked location?",
        "On Pro and Enterprise, open Marked Locations, press Share on a location (or select several) then tap someone under Recent, or type part of their name or email and tap them in the list (typing their full email also works). They will find it under the Shared tab.",
      ),
    ],
  },
  {
    title: "Account & privacy",
    items: [
      faq(
        "I forgot my password. What now?",
        "Click Sign In / Register, then Forgot Password, and send the request. We will help you reset it.",
      ),
      faq(
        "How do I delete my account and data?",
        "Email contact@jcdigital.co.id from the address of your account and ask us to delete it. We remove your account and the data stored with it, as described in our Privacy Policy.",
        <>
          Email <strong>contact@jcdigital.co.id</strong> from the address of your account and ask
          us to delete it. We remove your account and the data stored with it, as described in our{" "}
          <Link to="/privacy" className="text-forest-700 font-semibold hover:underline">Privacy Policy</Link>.
        </>,
      ),
      faq(
        "Who can write and reply to reviews?",
        "Anyone can read reviews. Only account holders can write one (one review per account, which you can edit or delete). Replies come from the Landscape 360 team.",
      ),
      faq(
        "What cookies do you use?",
        "Necessary browser storage keeps you signed in and remembers your map and offline data. Our analytics are anonymous and do not use cookies. Our advertising partner may set its own cookies, which you can block or delete in your browser settings. Details are in our Privacy Policy.",
      ),
    ],
  },
];

// Google's FAQ rich result, built from the same questions shown on the page
const FAQ_SCHEMA = [
  {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: GROUPS.flatMap((g) =>
      g.items.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.text },
      })),
    ),
  },
];

export const FaqPage = () => {
  const [query, setQuery] = useState("");
  const [openKey, setOpenKey] = useState<string | null>("Getting started-0");

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return GROUPS;
    return GROUPS.map((g) => ({
      ...g,
      items: g.items.filter((f) => f.q.toLowerCase().includes(q) || f.text.toLowerCase().includes(q)),
    })).filter((g) => g.items.length > 0);
  }, [query]);

  return (
    <SitePageLayout
      title="FAQ"
      subtitle="Frequently asked questions"
      icon={HelpCircle}
      path="/faq"
      seoDescription="Answers to common questions about Landscape 360: accounts, plans, offline maps, GPS tracking, sharing and privacy."
      structuredData={FAQ_SCHEMA}
    >
      <div className="relative mb-8">
        <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-sand-500" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search questions..."
          aria-label="Search questions"
          className="w-full bg-sand-50 border border-sand-200 rounded-2xl py-3 pl-11 pr-4 text-sm text-ink placeholder:text-sand-400 outline-none focus:border-forest-300 focus:ring-1 focus:ring-forest-300"
        />
      </div>

      {groups.length === 0 && (
        <p className="text-center text-sm text-sand-500 py-12">
          No questions match your search. Email us at contact@jcdigital.co.id.
        </p>
      )}

      <div className="space-y-8">
        {groups.map((g) => (
          <section key={g.title}>
            <h2 className="text-xs font-bold text-sand-500 uppercase tracking-wider mb-3">{g.title}</h2>
            <div className="rounded-2xl border border-sand-200 divide-y divide-sand-100 overflow-hidden">
              {g.items.map((f, i) => {
                const key = `${g.title}-${i}`;
                const isOpen = openKey === key || query.trim() !== "";
                return (
                  <div key={key}>
                    <button
                      onClick={() => setOpenKey(openKey === key ? null : key)}
                      aria-expanded={isOpen}
                      className="cursor-pointer w-full flex items-center justify-between gap-3 px-5 py-4 text-left hover:bg-sand-50 transition-colors"
                    >
                      <span className="text-sm font-bold text-ink">{f.q}</span>
                      <ChevronDown
                        size={16}
                        className={`shrink-0 text-sand-500 transition-transform ${isOpen ? "rotate-180" : ""}`}
                      />
                    </button>
                    {isOpen && <div className="px-5 pb-4 text-sm text-sand-700 leading-relaxed text-justify hyphens-auto">{f.a}</div>}
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      <div className="mt-10 p-5 rounded-2xl bg-forest-50 border border-forest-200 text-center">
        <p className="text-sm text-forest-700">
          Still have a question? Email us at <strong>contact@jcdigital.co.id</strong>.
        </p>
      </div>
    </SitePageLayout>
  );
};
