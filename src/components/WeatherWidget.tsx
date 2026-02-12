import { useEffect, useState } from 'react';
import { Cloud, CloudRain, Sun, CloudLightning, CloudFog, Droplets, Wind, MapPin, Loader2, Calendar, ChevronDown, ChevronUp } from 'lucide-react';
import { useMapStore } from '../store/useMapStore';

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
  temps: number[];
  weather: string; // Most frequent weather or midday weather
}

const WEATHER_ICONS: Record<string, any> = {
  'Cerah': Sun,
  'Cerah Berawan': Sun,
  'Berawan': Cloud,
  'Berawan Tebal': Cloud,
  'Udara Kabur': CloudFog,
  'Kabut': CloudFog,
  'Hujan Ringan': CloudRain,
  'Hujan Sedang': CloudRain,
  'Hujan Lebat': CloudLightning,
  'Hujan Petir': CloudLightning,
};

// Default location: Jakarta (Kemayoran)
// In a real app, we would reverse-geocode the map center to an ADM4 code.
const DEFAULT_ADM4 = '31.71.03.1001'; 

export const WeatherWidget = () => {
  const { showWeather } = useMapStore();
  const [loading, setLoading] = useState(true);
  const [forecast, setForecast] = useState<DailyForecast[]>([]);
  const [current, setCurrent] = useState<WeatherData | null>(null);
  const [locationName, setLocationName] = useState("Jakarta Pusat");
  const [error, setError] = useState<string | null>(null);
  const [isMinimized, setIsMinimized] = useState(false);

  useEffect(() => {
    if (!showWeather) return;

    const fetchWeather = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`https://api.bmkg.go.id/publik/prakiraan-cuaca?adm4=${DEFAULT_ADM4}`);
        if (!response.ok) throw new Error('Failed to fetch weather data');
        
        const data = await response.json();
        // console.log("Weather Data:", data);

        if (data && data.data && data.data.length > 0) {
           const weatherData = data.data[0].cuaca;
           setLocationName(data.data[0].lokasi?.kotakab || "Jakarta Pusat");
           
           // Flatten and Parse Data
           const allForecasts: WeatherData[] = weatherData.flat().map((item: any) => ({
             datetime: item.local_datetime,
             t: item.t,
             hu: item.hu,
             weather_desc: item.weather_desc,
             ws: item.ws,
             wd: item.wd,
             image: item.image
           }));

           // 1. Set Current Weather (Nearest to now)
           const now = new Date();
           const current = allForecasts.reduce((prev, curr) => {
              const prevDiff = Math.abs(new Date(prev.datetime).getTime() - now.getTime());
              const currDiff = Math.abs(new Date(curr.datetime).getTime() - now.getTime());
              return currDiff < prevDiff ? curr : prev;
           });
           setCurrent(current);

           // 2. Group by Day for next 3 days
           const grouped: Record<string, WeatherData[]> = {};
           allForecasts.forEach(f => {
              const date = f.datetime.split(' ')[0];
              if (!grouped[date]) grouped[date] = [];
              grouped[date].push(f);
           });

           // Convert to DailyForecast array
           const daily: DailyForecast[] = Object.keys(grouped).slice(0, 3).map(date => {
              const dayData = grouped[date];
              const temps = dayData.map(d => d.t);
              const dateObj = new Date(date);
              
              // Find most common weather or take the noon one
              const midIndex = Math.floor(dayData.length / 2);
              const weather = dayData[midIndex]?.weather_desc || "Berawan";

              return {
                 date: date,
                 dayName: dateObj.toLocaleDateString('id-ID', { weekday: 'long' }),
                 temps: temps,
                 weather: weather
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

  }, [showWeather]);

  if (!showWeather) return null;

  // Render minimized state (Small Pill)
  if (isMinimized) {
    return (
      <button 
        onClick={() => setIsMinimized(false)}
        className="fixed z-20 top-4 right-18 md:top-4 bg-black/60 backdrop-blur-md border border-white/10 rounded-full px-3 py-2 shadow-2xl animate-in fade-in zoom-in flex items-center gap-2 text-white hover:bg-black/80 transition-all cursor-pointer group"
      >
        <div className="flex items-center gap-1.5">
           {current ? (
             <>
               <span className="text-lg font-bold">{current.t.toFixed(0)}°</span>
               <span className="text-[10px] opacity-70 uppercase tracking-wider hidden md:block">{current.weather_desc}</span>
             </>
           ) : (
             <Cloud size={18} className="text-blue-400" />
           )}
        </div>
        <div className="w-px h-4 bg-white/20 mx-1"></div>
        <ChevronDown size={14} className="text-gray-400 group-hover:text-white transition-colors" />
      </button>
    );
  }

  return (
    <div className={`
        fixed z-20 
        bg-black/60 backdrop-blur-md border border-white/10 rounded-xl overflow-hidden shadow-2xl 
        text-white font-sans
        transition-all duration-300
        
        /* Mobile: Top Full Width */
        top-20 left-4 right-4 w-auto
        
        /* Desktop: Fixed Right Sidebar (Adjusted to avoid overlapping with top-right icons) */
        md:top-4 md:right-18 md:left-auto md:w-64
        
        animate-in fade-in slide-in-from-top-4 md:slide-in-from-right-8
    `}>
        {/* Header */}
        <div className="p-3 bg-white/5 border-b border-white/10 flex justify-between items-center cursor-pointer hover:bg-white/10 transition-colors" onClick={() => setIsMinimized(true)}>
            <div className="flex items-center gap-2">
                <MapPin size={14} className="text-red-400" />
                <span className="text-xs font-bold uppercase tracking-wider">{locationName}</span>
            </div>
            <div className="flex items-center gap-2">
                <div className="text-[10px] text-gray-400">BMKG</div>
                <ChevronUp size={14} className="text-gray-400" />
            </div>
        </div>

        {/* Content */}
        <div className="p-4">
            {loading ? (
                <div className="flex flex-col items-center justify-center py-6 gap-2 text-gray-400">
                    <Loader2 size={24} className="animate-spin text-blue-400" />
                    <span className="text-xs">Memuat Data...</span>
                </div>
            ) : error ? (
                <div className="text-center py-4 text-red-300 text-xs">
                    {error}
                </div>
            ) : current ? (
                <>
                    {/* Current Weather */}
                    <div className="flex items-center justify-between mb-6">
                        <div>
                             <div className="text-4xl font-bold text-white flex items-start">
                                {current.t.toFixed(0)}
                                <span className="text-lg text-blue-300 font-normal mt-1">°C</span>
                             </div>
                             <div className="text-xs text-gray-300 mt-1">{current.weather_desc}</div>
                        </div>
                        <div className="text-right space-y-1">
                             <div className="flex items-center justify-end gap-1.5 text-xs text-blue-200">
                                <Droplets size={12} />
                                <span>{current.hu}%</span>
                             </div>
                             <div className="flex items-center justify-end gap-1.5 text-xs text-emerald-200">
                                <Wind size={12} />
                                <span>{current.ws} km/h</span>
                             </div>
                        </div>
                    </div>

                    {/* Forecast List */}
                    <div className="space-y-3">
                        <div className="flex items-center gap-2 text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-2">
                            <Calendar size={10} />
                            3 Hari Kedepan
                        </div>
                        
                        {forecast.map((day, idx) => {
                            const Icon = WEATHER_ICONS[day.weather] || Cloud;
                            const minTemp = Math.min(...day.temps);
                            const maxTemp = Math.max(...day.temps);

                            return (
                                <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 flex justify-center">
                                            <Icon size={18} className="text-blue-300" />
                                        </div>
                                        <div>
                                            <div className="text-xs font-bold text-white">{day.dayName}</div>
                                            <div className="text-[10px] text-gray-400">{day.weather}</div>
                                        </div>
                                    </div>
                                    <div className="text-xs font-mono text-right">
                                        <span className="text-white">{maxTemp}°</span>
                                        <span className="text-gray-500 mx-1">/</span>
                                        <span className="text-blue-300">{minTemp}°</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </>
            ) : null}
        </div>
        
        {/* Footer */}
        <div className="p-2 bg-black/20 text-[9px] text-center text-gray-600">
            Sumber: Badan Meteorologi, Klimatologi, dan Geofisika
        </div>
    </div>
  );
};
