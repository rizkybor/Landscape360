import { useEffect, useState } from "react";
import {
  Cloud,
  CloudRain,
  Sun,
  CloudLightning,
  CloudFog,
  Droplets,
  Wind,
  MapPin,
  Loader2,
  Calendar,
  ChevronDown,
  ChevronUp,
  RefreshCw,
} from "lucide-react";
import { useMapStore } from "../store/useMapStore";
import { useShallow } from "zustand/react/shallow";
import { loadVillageIndex, type Village } from "../utils/villages";

interface WeatherData {
  datetime: string;
  t: number; // Temperature
  hu: number; // Humidity
  weather_desc: string;
  ws: number; // Wind Speed
  wd: string; // Wind Direction
  image: string;
}

interface DailyForecast {
  date: string;
  dayName: string;
  dayShort: string;
  temps: number[];
  weather: string; // Most frequent weather or midday weather
}

const WEATHER_ICONS: Record<string, any> = {
  Cerah: Sun,
  "Cerah Berawan": Sun,
  Berawan: Cloud,
  "Berawan Tebal": Cloud,
  "Udara Kabur": CloudFog,
  Kabut: CloudFog,
  "Hujan Ringan": CloudRain,
  "Hujan Sedang": CloudRain,
  "Hujan Lebat": CloudLightning,
  "Hujan Petir": CloudLightning,
};

// BMKG forecasts by village (ADM4 code). The forecast is for the village nearest to the user,
// or to the map centre without location, as in the mobile app; Kemayoran (Jakarta Pusat) is
// only the fallback. The nearest village is found in the browser (utils/villages.ts), so only
// its code goes to BMKG, never the position.
const DEFAULT_ADM4 = "31.71.03.1001";
const DEFAULT_LOCATION = "Jakarta Pusat";

type Source = "gps" | "map" | "outside" | "fallback";
const SOURCE_TEXT: Record<Source, string> = {
  gps: "Near your location",
  map: "Map centre",
  outside: "Outside BMKG coverage · Jakarta Pusat",
  fallback: "Default location",
};

/** The user's position, if the browser allows it within a few seconds; otherwise null */
const devicePosition = () =>
  new Promise<[number, number] | null>((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (p) => resolve([p.coords.longitude, p.coords.latitude]),
      () => resolve(null),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 10 * 60 * 1000 },
    );
  });

const fetchBmkg = async (adm4: string) => {
  const response = await fetch(`https://api.bmkg.go.id/publik/prakiraan-cuaca?adm4=${adm4}`);
  if (!response.ok) throw new Error("Failed to fetch weather data");
  const data: BmkgResponse = await response.json();
  // A code BMKG does not know (a newer village split) comes back without a forecast
  if (!data?.data?.length || !data.data[0].cuaca) throw new Error("No forecast for this village");
  return data;
};

// What the code below reads from a BMKG answer
interface BmkgResponse {
  data?: { lokasi?: Record<string, unknown>; cuaca?: unknown[] }[];
  lokasi?: Record<string, unknown>;
}

const text = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

export const WeatherWidget = () => {
  const { showWeather } = useMapStore(
    useShallow((s) => ({ showWeather: s.showWeather })),
  );
  const [loading, setLoading] = useState(true);
  const [forecast, setForecast] = useState<DailyForecast[]>([]);
  const [current, setCurrent] = useState<WeatherData | null>(null);
  const [locationName, setLocationName] = useState(DEFAULT_LOCATION);
  const [region, setRegion] = useState<string | null>(null);
  const [source, setSource] = useState<Source | null>(null);
  // Bumped by the refresh button, to look up the place again
  const [reloads, setReloads] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isMinimized, setIsMinimized] = useState(false);

  useEffect(() => {
    if (!showWeather) return;

    const fetchWeather = async () => {
      setLoading(true);
      setError(null);
      try {
        // Where: the user's position, else the centre of the map
        const gps = await devicePosition();
        const at = gps ?? useMapStore.getState().center;
        let candidates: Village[] = [];
        try {
          candidates = (await loadVillageIndex()).nearest(at[1], at[0]);
        } catch (err) {
          console.warn("Village lookup failed:", err);
        }
        // The nearest village first; if BMKG does not know its code, the next
        let data: BmkgResponse | null = null;
        for (const v of candidates) {
          try {
            data = await fetchBmkg(v.code);
            break;
          } catch {
            // try the next village
          }
        }
        const fallback = !data;
        if (!data) data = await fetchBmkg(DEFAULT_ADM4);
        setSource(fallback ? (candidates.length ? "fallback" : "outside") : gps ? "gps" : "map");

        if (data.data && data.data.length > 0) {
          const weatherData = data.data[0].cuaca ?? [];
          // "Desa, Kecamatan" and the city below; BMKG names the city field "kotkab"
          const lokasi = data.data[0].lokasi ?? data.lokasi ?? {};
          const desa = text(lokasi.desa);
          const city = text(lokasi.kotkab) ?? text(lokasi.kotakab);
          setLocationName(desa ? [desa, text(lokasi.kecamatan)].filter(Boolean).join(", ") : (city ?? DEFAULT_LOCATION));
          setRegion(desa ? city : null);

          // Flatten and Parse Data
          const allForecasts: WeatherData[] = weatherData
            .flat()
            .map((item: any) => ({
              datetime: item.local_datetime,
              t: item.t,
              hu: item.hu,
              weather_desc: item.weather_desc,
              ws: item.ws,
              wd: item.wd,
              image: item.image,
            }));

          // 1. Set Current Weather (Nearest to now)
          const now = new Date();
          const current = allForecasts.reduce((prev, curr) => {
            const prevDiff = Math.abs(
              new Date(prev.datetime).getTime() - now.getTime(),
            );
            const currDiff = Math.abs(
              new Date(curr.datetime).getTime() - now.getTime(),
            );
            return currDiff < prevDiff ? curr : prev;
          });
          setCurrent(current);

          // 2. Group by Day for next 3 days
          const grouped: Record<string, WeatherData[]> = {};
          allForecasts.forEach((f) => {
            const date = f.datetime.split(" ")[0];
            if (!grouped[date]) grouped[date] = [];
            grouped[date].push(f);
          });

          // Convert to DailyForecast array
          const daily: DailyForecast[] = Object.keys(grouped)
            .slice(0, 3)
            .map((date) => {
              const dayData = grouped[date];
              const temps = dayData.map((d) => d.t);
              const dateObj = new Date(date);

              // Find most common weather or take the noon one
              const midIndex = Math.floor(dayData.length / 2);
              const weather = dayData[midIndex]?.weather_desc || "Berawan";

              return {
                date: date,
                dayName: dateObj.toLocaleDateString("id-ID", {
                  weekday: "long",
                }),
                dayShort: dateObj.toLocaleDateString("id-ID", {
                  weekday: "short",
                }),
                temps: temps,
                weather: weather,
              };
            });

          setForecast(daily);
        }
      } catch (err) {
        console.error("Weather Fetch Error:", err);
        setError("Gagal memuat data cuaca.");
      } finally {
        setLoading(false);
      }
    };

    fetchWeather();

    // Refresh every 30 mins
    const interval = setInterval(fetchWeather, 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, [showWeather, reloads]);

  if (!showWeather) return null;

  // Render minimized state (Small Pill)
  if (isMinimized) {
    return (
      <button
        onClick={() => setIsMinimized(false)}
        className="fixed z-20 top-4 right-18 md:top-4 bg-white/95 backdrop-blur-md border border-sand-200 rounded-full px-3 py-2 shadow-2xl animate-in fade-in zoom-in flex items-center gap-2 text-ink hover:bg-white/95 transition-all cursor-pointer group"
      >
        <div className="flex items-center gap-1.5">
          {current ? (
            <>
              <span className="text-lg font-bold">{current.t.toFixed(0)}°</span>
              <span className="text-[10px] opacity-70 uppercase tracking-wider hidden md:block">
                {current.weather_desc}
              </span>
            </>
          ) : (
            <Cloud size={18} className="text-forest-700" />
          )}
        </div>
        <div className="w-px h-4 bg-sand-200 mx-1"></div>
        <ChevronDown
          size={14}
          className="text-sand-600 group-hover:text-ink transition-colors"
        />
      </button>
    );
  }

  return (
    <div
      className={`
        fixed z-20 
        bg-white/95 backdrop-blur-md border border-sand-200 rounded-xl overflow-hidden shadow-2xl 
        text-ink font-sans
        transition-all duration-300
        
        /* Mobile: compact card between the Controls button (left) and the map controls (right) */
        top-4 left-24 right-18 w-auto max-h-[calc(100dvh-8rem)] overflow-y-auto custom-scrollbar
        
        /* Desktop: Fixed Right Sidebar (Adjusted to avoid overlapping with top-right icons) */
        md:top-4 md:right-18 md:left-auto md:w-64 md:max-h-none md:overflow-visible
        
        animate-in fade-in slide-in-from-top-4 md:slide-in-from-right-8
    `}
    >
      {/* Header */}
      <div
        className="px-3 py-2 md:p-3 bg-sand-50 border-b border-sand-200 flex justify-between items-center gap-2 cursor-pointer hover:bg-sand-100 transition-colors"
        onClick={() => setIsMinimized(true)}
      >
        <div className="flex items-start gap-2 min-w-0">
          <MapPin size={14} className="text-brick-600 shrink-0 mt-0.5" />
          <div className="min-w-0">
            <div className="text-[11px] md:text-xs font-bold uppercase tracking-wider truncate" title={locationName}>
              {locationName}
            </div>
            {(region || source) && (
              <div className="text-[9px] md:text-[10px] text-sand-600 truncate">
                {[region, source && SOURCE_TEXT[source]].filter(Boolean).join(" · ")}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setReloads((n) => n + 1);
            }}
            disabled={loading}
            className="cursor-pointer p-1 rounded-md text-sand-600 hover:text-ink hover:bg-sand-200 disabled:opacity-40"
            title="Update for my location (or the map centre)"
            aria-label="Update the weather for my location"
          >
            <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
          </button>
          <div className="text-[10px] text-sand-600">BMKG</div>
          <ChevronUp size={14} className="text-sand-600" />
        </div>
      </div>

      {/* Content */}
      <div className="p-3 md:p-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-3 md:py-6 gap-2 text-sand-600">
            <Loader2 size={24} className="animate-spin text-forest-700" />
            <span className="text-xs">Memuat Data...</span>
          </div>
        ) : error ? (
          <div className="text-center py-4 text-brick-600 text-xs">{error}</div>
        ) : current ? (
          <>
            {/* Current Weather */}
            <div className="flex items-center justify-between gap-2 mb-3 md:mb-6">
              <div className="min-w-0">
                <div className="text-3xl md:text-4xl font-bold text-ink flex items-start">
                  {current.t.toFixed(0)}
                  <span className="text-base md:text-lg text-forest-700 font-normal mt-1">
                    °C
                  </span>
                </div>
                <div className="text-[11px] md:text-xs text-sand-700 mt-0.5 md:mt-1 truncate">
                  {current.weather_desc}
                </div>
              </div>
              <div className="text-right space-y-1">
                <div className="flex items-center justify-end gap-1.5 text-xs text-forest-700">
                  <Droplets size={12} />
                  <span>{current.hu}%</span>
                </div>
                <div className="flex items-center justify-end gap-1.5 text-xs text-forest-700">
                  <Wind size={12} />
                  <span>{current.ws} km/h</span>
                </div>
              </div>
            </div>

            {/* Forecast List */}
            <div className="flex items-center gap-2 text-[10px] text-sand-500 font-bold uppercase tracking-widest mb-2">
              <Calendar size={10} />3 Hari Kedepan
            </div>
            <div className="grid grid-cols-3 gap-1.5 md:grid-cols-1 md:gap-3">

              {forecast.map((day, idx) => {
                const Icon = WEATHER_ICONS[day.weather] || Cloud;
                const minTemp = Math.min(...day.temps);
                const maxTemp = Math.max(...day.temps);

                return (
                  <div
                    key={idx}
                    className="flex flex-col md:flex-row items-center md:justify-between gap-1 md:gap-0 p-1.5 md:p-2 rounded-lg bg-sand-50 hover:bg-sand-100 transition-colors text-center md:text-left"
                    title={`${day.dayName}: ${day.weather}`}
                  >
                    <div className="flex flex-col-reverse md:flex-row items-center gap-1 md:gap-3">
                      <div className="md:w-8 flex justify-center">
                        <Icon size={18} className="text-forest-700" />
                      </div>
                      <div>
                        <div className="text-[11px] md:text-xs font-bold text-ink">
                          <span className="md:hidden">{day.dayShort}</span>
                          <span className="hidden md:inline">{day.dayName}</span>
                        </div>
                        <div className="hidden md:block text-[10px] text-sand-600">
                          {day.weather}
                        </div>
                      </div>
                    </div>
                    <div className="text-[11px] md:text-xs font-mono md:text-right">
                      <span className="text-ink">{maxTemp}°</span>
                      <span className="text-sand-500 mx-1">/</span>
                      <span className="text-forest-700">{minTemp}°</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        ) : null}
      </div>

      {/* Footer */}
      <div className="p-1.5 md:p-2 bg-white/90 text-[8px] md:text-[9px] text-center text-sand-400 truncate">
        <a
          href="https://www.bmkg.go.id/"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-forest-700 transition-colors"
        >
          Badan Meteorologi, Klimatologi, dan Geofisika (BMKG)
        </a>
      </div>
    </div>
  );
};
