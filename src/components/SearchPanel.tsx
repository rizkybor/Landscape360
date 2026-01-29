import React, { useState, useEffect, useRef } from 'react';
import { useMapStore } from '../store/useMapStore';
import { Search, X, MapPin, Loader2 } from 'lucide-react';

// Using the same token as in MapBoxContainer
const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || 'pk.eyJ1Ijoicml6a3lhamllIiwiYSI6ImNsZ2J4bDQ4bjA0Z2wzZHF5c3J2aGZ3eWcifQ.8-lIqB1r8P9S3p3Q2j4xQw';

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
  const inputRef = useRef<HTMLInputElement>(null);

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
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(searchText)}.json?access_token=${MAPBOX_TOKEN}&limit=5`
      );
      const data = await response.json();
      if (data.features) {
        setResults(data.features.map((f: any) => ({
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
    <div className="fixed top-20 left-4 z-40 w-80 bg-black/80 backdrop-blur-md border border-white/20 rounded-xl text-white shadow-2xl overflow-hidden font-mono flex flex-col max-h-[60vh]">
      {/* Header */}
      <div className="p-3 border-b border-white/10 flex justify-between items-center bg-blue-600/20">
        <h3 className="font-bold flex items-center gap-2 text-blue-300">
          <Search size={16} /> Location Search
        </h3>
        <button 
          onClick={() => setShowSearch(false)}
          className="text-gray-400 hover:text-white transition-colors"
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
                placeholder="Search places..."
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
                  <MapPin size={16} className="mt-0.5 text-gray-500 group-hover:text-blue-400 shrink-0" />
                  <div>
                    <p className="text-xs font-bold text-gray-200 group-hover:text-white">
                        {res.place_name.split(',')[0]}
                    </p>
                    <p className="text-[10px] text-gray-500 line-clamp-1">
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
