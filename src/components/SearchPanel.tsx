import { useState, useEffect, useRef } from "react";
import { useMapStore } from "../store/useMapStore";
import { Search, X, MapPin, Loader2, ArrowRight, Mountain, Tent, Navigation } from "lucide-react";
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
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

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

  if (!showSearch) return null;

  return (
    <div className="fixed inset-0 z-[70] bg-ink/40 backdrop-blur-sm flex items-start justify-center p-4 sm:pt-24 animate-in fade-in duration-200">
      <div 
        ref={containerRef}
        className="w-full max-w-2xl bg-white border border-sand-200 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh] animate-in slide-in-from-top-4 duration-300 ring-1 ring-sand-200"
      >
        {/* Header / Input Area */}
        <div className="relative border-b border-sand-200 bg-white p-4 flex items-center gap-3">
          <Search className="text-sand-600 shrink-0" size={20} />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search mountains, basecamp, or cities..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 bg-transparent border-none outline-none text-ink text-lg placeholder-sand-500 font-medium"
          />
          {loading ? (
            <Loader2 className="animate-spin text-forest-700 shrink-0" size={20} />
          ) : query && (
            <button 
              onClick={() => { setQuery(""); setResults([]); inputRef.current?.focus(); }}
              className="text-sand-600 hover:text-ink transition-colors cursor-pointer"
            >
              <X size={20} />
            </button>
          )}
          <div className="hidden sm:flex items-center gap-1 text-[10px] font-mono text-sand-500 border border-sand-200 rounded px-1.5 py-0.5">
            <span>ESC</span>
          </div>
        </div>

        {/* Results Area */}
        <div className="flex-1 overflow-y-auto custom-scrollbar bg-white">
          {results.length > 0 ? (
            <div className="py-2">
              <div className="px-4 py-2 text-[10px] font-bold text-sand-500 uppercase tracking-widest">
                Search Results
              </div>
              <ul>
                {results.map((res) => (
                  <li key={res.id}>
                    <button
                      onClick={() => handleSelect(res)}
                      className="cursor-pointer w-full text-left px-4 py-3 hover:bg-forest-50 transition-colors flex items-center gap-4 group border-l-2 border-transparent hover:border-forest-600"
                    >
                      <div className={`
                        w-10 h-10 rounded-full flex items-center justify-center shrink-0
                        ${res.place_type.includes("mountain") ? "bg-ember-50 text-ember-700" : 
                          res.place_type.includes("poi") ? "bg-forest-50 text-forest-700" :
                          res.place_type.includes("basecamp") ? "bg-forest-50 text-forest-700" :
                          "bg-sand-100 text-sand-600"}
                      `}>
                        {res.place_type.includes("mountain") ? <Mountain size={18} /> :
                         res.place_type.includes("basecamp") ? <Tent size={18} /> :
                         res.place_type.includes("poi") ? <MapPin size={18} /> :
                         <Navigation size={18} />}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="font-semibold text-sand-800 text-sm group-hover:text-forest-700 transition-colors truncate">
                            {res.place_name.split(",")[0]}
                          </span>
                          {res.place_type.includes("custom") && (
                            <span className="text-[9px] bg-gold-50 text-gold-700 px-1.5 py-0.5 rounded font-bold border border-gold-200">
                              VERIFIED - OFFICIAL360
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-sand-500 truncate group-hover:text-sand-600">
                          {res.place_name.split(",").slice(1).join(",").trim() || res.text}
                        </div>
                      </div>

                      <ArrowRight size={16} className="text-sand-400 opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all duration-200" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : query.length > 2 && !loading ? (
            <div className="p-12 text-center">
              <div className="w-16 h-16 bg-sand-100 rounded-full flex items-center justify-center mx-auto mb-4 text-sand-500">
                <Search size={32} />
              </div>
              <h3 className="text-sand-700 font-medium mb-1">No locations found</h3>
              <p className="text-sand-500 text-sm">Try searching for a different keyword or coordinate.</p>
            </div>
          ) : (
            <div className="p-8">
              <div className="text-[10px] font-bold text-sand-500 uppercase tracking-widest mb-3">
                Quick Suggestions
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {[
                  { name: "Gunung Gede", type: "mountain" },
                  // { name: "Gunung Semeru", type: "mountain" },
                  { name: "Sekretariat Makopala", type: "basecamp" },
                  // { name: "Ranu Kumbolo", type: "poi" },
                ].map((item, idx) => (
                  <button
                    key={idx}
                    onClick={() => { setQuery(item.name); performSearch(item.name); }}
                    className="cursor-pointer flex items-center gap-3 p-3 rounded-xl bg-sand-100 hover:bg-sand-100 border border-sand-200 hover:border-sand-300 transition-all text-left group"
                  >
                    <div className={`
                      w-8 h-8 rounded-lg flex items-center justify-center shrink-0
                      ${item.type === "mountain" ? "bg-ember-50 text-ember-700" : 
                        item.type === "basecamp" ? "bg-forest-50 text-forest-700" :
                        "bg-forest-50 text-forest-700"}
                    `}>
                      {item.type === "mountain" ? <Mountain size={14} /> :
                       item.type === "basecamp" ? <Tent size={14} /> :
                       <MapPin size={14} />}
                    </div>
                    <span className="text-sm text-sand-700 font-medium group-hover:text-ink">{item.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div className="p-3 bg-sand-50 border-t border-sand-200 flex justify-between items-center text-[10px] text-sand-500">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-forest-700"></span>
              Landscape 360
            </span>
            {/* <span className="hidden sm:inline">Coordinates supported (Lat, Lon)</span> */}
          </div>
          <div className="font-mono">
            {results.length} results
          </div>
        </div>
      </div>
    </div>
  );
};
