import { useState, useEffect, useRef } from "react";
import { useMapStore } from "../store/useMapStore";
import { Search, X, MapPin, Loader2, CornerDownLeft, Mountain, Tent, Navigation, BadgeCheck, Crosshair } from "lucide-react";
import customLocations from "../data/myDataLocation.json";

// Using the same token as in MapBoxContainer
const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

interface SearchResult {
  id: string;
  place_name: string;
  text: string;
  center: [number, number];
  place_type: string[];
}

export const SearchPanel = () => {
  const { showSearch, setShowSearch, setCenter, setZoom } = useMapStore();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Fetch user location on mount
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation([position.coords.longitude, position.coords.latitude]);
        },
        (error) => {
          console.warn("Location access denied or error:", error);
        }
      );
    }
  }, []);

  // Auto-focus and Keyboard Shortcuts
  useEffect(() => {
    if (showSearch) {
      if (inputRef.current) inputRef.current.focus();
      document.body.style.overflow = 'hidden'; // Prevent background scrolling
    } else {
      document.body.style.overflow = '';
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && showSearch) {
        setShowSearch(false);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        // Since we are inside useEffect with showSearch dependency, we can use the value directly
        setShowSearch(!showSearch);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [showSearch, setShowSearch]);

  // Click Outside to Close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowSearch(false);
      }
    };

    if (showSearch) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showSearch, setShowSearch]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.length > 2) {
        performSearch(query);
      } else {
        setResults([]);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [query]);

  const performSearch = async (searchText: string) => {
    setLoading(true);
    try {
      let query = searchText;
      let isCoordinate = false;

      // Check if input is coordinate (lat, lon) or (lon, lat)
      const coordMatch = searchText.match(/^(-?\d+(\.\d+)?),\s*(-?\d+(\.\d+)?)$/);

      if (coordMatch) {
        const v1 = parseFloat(coordMatch[1]);
        const v2 = parseFloat(coordMatch[3]);

        if (Math.abs(v1) <= 90 && Math.abs(v2) <= 180) {
          query = `${v2},${v1}`;
          isCoordinate = true;
        }
      }

      const countryParam = isCoordinate ? "" : "&country=id";
      const proximityParam = userLocation ? `&proximity=${userLocation[0]},${userLocation[1]}` : "&proximity=ip";
      const typesParam = isCoordinate ? "" : "&types=country,region,district,place,locality,neighborhood,address,poi";

      // Local Search
      let customResults: SearchResult[] = [];
      if (!isCoordinate) {
        customResults = (customLocations as any[])
          .filter((loc) => {
            const matchesName = loc.place_name.toLowerCase().includes(searchText.toLowerCase());
            const isNotWater = !loc.type || loc.type.toLowerCase() !== "water";
            return matchesName && isNotWater;
          })
          .map((loc) => {
            const baseTypes = Array.isArray(loc.place_type)
              ? loc.place_type
              : loc.place_type
              ? [loc.place_type]
              : [];

            return {
              ...loc,
              place_type: [...baseTypes, "custom"],
              text: loc.text,
            };
          });
      }

      // Remote Search
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${MAPBOX_TOKEN}&limit=10&language=id${countryParam}${typesParam}${proximityParam}`
      );
      const data = await response.json();

      let mapboxResults: SearchResult[] = [];
      if (data.features && data.features.length > 0) {
        mapboxResults = data.features.map((f: any) => ({
          id: f.id,
          place_name: f.place_name,
          center: f.center,
          place_type: f.place_type,
        }));
      }

      // Merge & Deduplicate
      const seen = new Set();
      const finalResults = [...customResults, ...mapboxResults].filter((item) => {
        const key = item.id || `${item.center[0]},${item.center[1]}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      setResults(finalResults);
      setActiveIndex(0);
    } catch (error) {
      console.error("Search error:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (result: SearchResult) => {
    setCenter(result.center);
    setZoom(16);
    setShowSearch(false);
    setQuery("");
  };

  // Keep the keyboard-selected result in view
  useEffect(() => {
    listRef.current
      ?.querySelector('[data-active="true"]')
      ?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + results.length) % results.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const selected = results[activeIndex];
      if (selected) handleSelect(selected);
    }
  };

  if (!showSearch) return null;

  const isCoordinateQuery = /^(-?\d+(\.\d+)?),\s*(-?\d+(\.\d+)?)$/.test(query.trim());
  const verifiedResults = results.filter((r) => r.place_type.includes("custom"));
  const placeResults = results.filter((r) => !r.place_type.includes("custom"));

  const iconFor = (types: string[]) => {
    if (types.includes("mountain")) return { icon: <Mountain size={16} />, tone: "bg-ember-50 text-ember-700 border-ember-100" };
    if (types.includes("basecamp")) return { icon: <Tent size={16} />, tone: "bg-forest-50 text-forest-700 border-forest-100" };
    if (types.includes("poi")) return { icon: <MapPin size={16} />, tone: "bg-gold-50 text-gold-700 border-gold-100" };
    return { icon: <Navigation size={16} />, tone: "bg-sand-100 text-sand-600 border-sand-200" };
  };

  const renderResult = (res: SearchResult) => {
    const index = results.indexOf(res);
    const isActive = index === activeIndex;
    const { icon, tone } = iconFor(res.place_type);
    const [title, ...rest] = res.place_name.split(",");
    return (
      <li key={res.id}>
        <button
          onClick={() => handleSelect(res)}
          onMouseEnter={() => setActiveIndex(index)}
          data-active={isActive}
          className={`cursor-pointer w-full text-left px-3 py-2.5 rounded-xl flex items-center gap-3 transition-colors ${
            isActive ? "bg-forest-50 ring-1 ring-forest-200" : "hover:bg-sand-50"
          }`}
        >
          <div className={`w-9 h-9 rounded-lg border flex items-center justify-center shrink-0 ${tone}`}>
            {icon}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className={`font-semibold text-sm truncate ${isActive ? "text-forest-800" : "text-ink"}`}>
                {title}
              </span>
              {res.place_type.includes("custom") && (
                <BadgeCheck size={14} className="text-gold-600 shrink-0" aria-label="Verified location" />
              )}
            </div>
            <div className="text-xs text-sand-500 truncate">
              {rest.join(",").trim() || res.text}
            </div>
          </div>
          <CornerDownLeft
            size={14}
            className={`shrink-0 transition-opacity ${isActive ? "opacity-100 text-forest-700" : "opacity-0"}`}
          />
        </button>
      </li>
    );
  };

  return (
    <div className="fixed inset-0 z-[70] bg-ink/40 backdrop-blur-sm flex items-start justify-center p-4 sm:pt-24 animate-in fade-in duration-200">
      <div
        ref={containerRef}
        className="w-full max-w-2xl bg-white border border-sand-200 rounded-2xl shadow-2xl shadow-sand-900/10 overflow-hidden flex flex-col max-h-[80vh] animate-in slide-in-from-top-4 duration-300"
      >
        {/* Input */}
        <div className="p-3 border-b border-sand-200">
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-sand-50 border border-sand-200 focus-within:border-forest-400 focus-within:bg-white focus-within:ring-4 focus-within:ring-forest-100 transition-all">
            <Search className="text-forest-700 shrink-0" size={20} />
            <input
              ref={inputRef}
              type="text"
              placeholder="Search mountains, basecamp, or cities..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleInputKeyDown}
              className="flex-1 min-w-0 bg-transparent border-none outline-none text-ink text-base sm:text-lg placeholder-sand-400 font-medium"
            />
            {loading ? (
              <Loader2 className="animate-spin text-forest-700 shrink-0" size={18} />
            ) : (
              query && (
                <button
                  onClick={() => { setQuery(""); setResults([]); inputRef.current?.focus(); }}
                  className="cursor-pointer p-1 rounded-md text-sand-500 hover:text-ink hover:bg-sand-100 transition-colors"
                  title="Clear"
                >
                  <X size={16} />
                </button>
              )
            )}
            <kbd className="hidden sm:inline-flex items-center text-[10px] font-mono text-sand-500 bg-white border border-sand-200 rounded-md px-1.5 py-0.5">
              ESC
            </kbd>
          </div>
          {isCoordinateQuery && (
            <div className="mt-2 flex items-center gap-1.5 px-1 text-[11px] text-forest-700">
              <Crosshair size={12} /> Coordinate search (Lat, Lon)
            </div>
          )}
        </div>

        {/* Results */}
        <div ref={listRef} className="flex-1 overflow-y-auto custom-scrollbar p-2">
          {results.length > 0 ? (
            <div className="space-y-3">
              {verifiedResults.length > 0 && (
                <section>
                  <div className="px-3 pt-1 pb-1.5 text-[10px] font-bold text-gold-700 uppercase tracking-widest flex items-center gap-1.5">
                    <BadgeCheck size={12} /> Verified Locations
                  </div>
                  <ul className="space-y-0.5">{verifiedResults.map(renderResult)}</ul>
                </section>
              )}
              {placeResults.length > 0 && (
                <section>
                  <div className="px-3 pt-1 pb-1.5 text-[10px] font-bold text-sand-500 uppercase tracking-widest">
                    Places
                  </div>
                  <ul className="space-y-0.5">{placeResults.map(renderResult)}</ul>
                </section>
              )}
            </div>
          ) : query.length > 2 && !loading ? (
            <div className="py-12 px-6 text-center">
              <div className="w-14 h-14 bg-sand-50 border border-sand-200 rounded-2xl flex items-center justify-center mx-auto mb-4 text-sand-400">
                <Search size={24} />
              </div>
              <h3 className="text-ink font-semibold mb-1">No locations found</h3>
              <p className="text-sand-500 text-sm">Try a different keyword, or paste coordinates like <span className="font-mono text-sand-700">-6.77, 106.98</span>.</p>
            </div>
          ) : (
            <div className="p-4">
              <div className="text-[10px] font-bold text-sand-500 uppercase tracking-widest mb-3">
                Quick Suggestions
              </div>
              <div className="flex flex-wrap gap-2">
                {[
                  { name: "Gunung Gede", type: "mountain" },
                  // { name: "Gunung Semeru", type: "mountain" },
                  { name: "Sekretariat Makopala", type: "basecamp" },
                  // { name: "Ranu Kumbolo", type: "poi" },
                ].map((item, idx) => {
                  const { icon, tone } = iconFor([item.type]);
                  return (
                    <button
                      key={idx}
                      onClick={() => { setQuery(item.name); performSearch(item.name); }}
                      className="cursor-pointer inline-flex items-center gap-2 pl-1.5 pr-3 py-1.5 rounded-full bg-white border border-sand-200 hover:border-forest-300 hover:bg-forest-50 transition-colors text-sm text-sand-700 hover:text-forest-800"
                    >
                      <span className={`w-6 h-6 rounded-full border flex items-center justify-center ${tone}`}>{icon}</span>
                      {item.name}
                    </button>
                  );
                })}
              </div>
              <p className="mt-4 text-xs text-sand-500">
                Tip: search by name, or paste coordinates (Lat, Lon).
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 bg-sand-50 border-t border-sand-200 flex justify-between items-center text-[10px] text-sand-500">
          <div className="hidden sm:flex items-center gap-3">
            <span className="flex items-center gap-1"><kbd className="font-mono bg-white border border-sand-200 rounded px-1">↑</kbd><kbd className="font-mono bg-white border border-sand-200 rounded px-1">↓</kbd> navigate</span>
            <span className="flex items-center gap-1"><kbd className="font-mono bg-white border border-sand-200 rounded px-1">↵</kbd> go to location</span>
          </div>
          <span className="sm:hidden flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-forest-700"></span>
            Landscape 360
          </span>
          <div className="font-mono">
            {results.length} results
          </div>
        </div>
      </div>
    </div>
  );
};
