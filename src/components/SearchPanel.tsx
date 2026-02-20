import { useState, useEffect, useRef } from 'react';
import { useMapStore } from '../store/useMapStore';
import { Search, X, MapPin, Loader2 } from 'lucide-react';

// Using the same token as in MapBoxContainer
const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

interface SearchResult {
  id: string;
  place_name: string;
  center: [number, number];
  place_type: string[];
}

export const SearchPanel = () => {
  const { showSearch, setShowSearch, setCenter, setZoom } = useMapStore();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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

  // Auto-focus when opened
  useEffect(() => {
    if (showSearch && inputRef.current) {
      inputRef.current.focus();
    }
  }, [showSearch]);

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
      // Simple regex for "number, number"
      const coordMatch = searchText.match(/^(-?\d+(\.\d+)?),\s*(-?\d+(\.\d+)?)$/);
      
      if (coordMatch) {
          const v1 = parseFloat(coordMatch[1]);
          const v2 = parseFloat(coordMatch[3]);
          
          // Basic check: Lat is usually -90 to 90, Lon -180 to 180.
          // Mapbox expects "lon,lat"
          // If user types "-6.2, 106.8" (Jakarta), v1 is -6 (lat), v2 is 106 (lon)
          // We need to swap to "106.8,-6.2"
          
          if (Math.abs(v1) <= 90 && Math.abs(v2) <= 180) {
             // Assume input is Lat, Lon (Standard format) -> Convert to Lon, Lat for Mapbox
             query = `${v2},${v1}`;
             isCoordinate = true;
          }
      }

      // 1. COUNTRY: Force ID (Indonesia) prioritization unless coordinate
      // User explicitly asked to recognize locations IN INDONESIA (universitas, gunung, daerah di indo).
      // So adding country=id is the most reliable way to filter out foreign noise.
      // If we want global later, we can make this toggleable.
      const countryParam = isCoordinate ? '' : '&country=id'; 

      // 2. PROXIMITY: Use user location if available, otherwise 'ip'
      // This helps rank "Gunung Gede" in Java higher than others if user is in Java.
      const proximityParam = userLocation 
        ? `&proximity=${userLocation[0]},${userLocation[1]}` 
        : '&proximity=ip';

      // 3. TYPES: Comprehensive list for Indonesia context
      // - poi: Universities, Mountains, Landmarks
      // - district/region: Kabupaten, Provinsi
      // - place/locality: Kota, Desa
      const typesParam = isCoordinate ? '' : '&types=country,region,district,place,locality,neighborhood,address,poi';

      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${MAPBOX_TOKEN}&limit=10&language=id${countryParam}${typesParam}${proximityParam}`
      );
      const data = await response.json();
      if (data.features) {
        // Removed strict client-side filtering because it causes issues with aliases
        // e.g. "Universitas Indonesia" might be returned as "UI" or "Kampus UI", which fails "every" word check.
        // With country=id enforced, foreign results are already gone.
        // We trust Mapbox relevance now.

        setResults(data.features.map((f: { id: string; place_name: string; center: [number, number]; place_type: string[]; properties?: { category?: string } }) => ({
          id: f.id,
          place_name: f.place_name,
          center: f.center,
          place_type: f.place_type
        })));
      }
    } catch (error) {
      console.error("Search error:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (result: SearchResult) => {
    setCenter(result.center);
    setZoom(14); // Zoom in to the location
    setShowSearch(false); // Close panel on selection (optional)
    setQuery(''); // Clear query? Or keep it? Let's clear for now or maybe keep it.
    // Actually, let's keep the panel open or closed? User said "show and hide", usually implies manual toggle.
    // But flying to a location usually implies "I'm done searching".
    // Let's close it for better UX on mobile.
  };

  if (!showSearch) return null;

  return (
    <div className="fixed top-20 left-4 z-[60] w-[calc(100%-32px)] md:w-64 bg-black/80 backdrop-blur-md border border-white/20 rounded-xl text-white shadow-2xl overflow-hidden font-mono flex flex-col max-h-[50vh] md:max-h-[60vh]">
      {/* Header */}
      <div className="p-3 border-b border-white/10 flex justify-between items-center bg-blue-600/20">
        <p className="font-bold text-[14px] flex items-center gap-2 text-blue-300">
          <Search size={12} /> Location Search
        </p>
        <button 
          onClick={() => setShowSearch(false)}
          className="text-gray-400 hover:text-white transition-colors cursor-pointer"
        >
          <X size={16} />
        </button>
      </div>

      {/* Input */}
      <div className="p-3">
        <div className="relative">
            <input
                    ref={inputRef}
                    type="text"
                    placeholder="Search places, mountains, or coordinates (Lat, Lon)..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="w-full bg-white/10 border border-white/20 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 placeholder-gray-500"
                />
            {loading && (
                <div className="absolute right-3 top-2.5">
                    <Loader2 size={16} className="animate-spin text-blue-400" />
                </div>
            )}
        </div>
      </div>

      {/* Results */}
      <div className="overflow-y-auto custom-scrollbar flex-1">
        {results.length > 0 ? (
          <ul className="divide-y divide-white/10">
            {results.map((res) => (
              <li key={res.id}>
                <button
                  onClick={() => handleSelect(res)}
                  className="w-full text-left p-3 hover:bg-white/10 transition-colors flex items-start gap-3 group"
                >
                  <MapPin size={16} className={`mt-0.5 shrink-0 ${res.place_type.includes('poi') ? 'text-green-400' : 'text-gray-500 group-hover:text-blue-400'}`} />
                  <div>
                    <p className="text-xs font-bold text-gray-200 group-hover:text-white flex items-center gap-2">
                        {res.place_name.split(',')[0]}
                        {res.place_type.includes('poi') && <span className="text-[9px] bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded uppercase">POI</span>}
                        {res.place_type.includes('mountain') && <span className="text-[9px] bg-yellow-500/20 text-yellow-400 px-1.5 py-0.5 rounded uppercase">Mountain</span>}
                    </p>
                    <p className="text-[10px] text-gray-500 line-clamp-1 break-all">
                        {res.place_name.split(',').slice(1).join(',').trim()}
                    </p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        ) : query.length > 2 && !loading ? (
            <div className="p-4 text-center text-xs text-gray-500">
                No results found
            </div>
        ) : query.length === 0 ? (
            <div className="p-4 text-center text-xs text-gray-500 italic">
                Type to search...
            </div>
        ) : null}
      </div>
    </div>
  );
};
