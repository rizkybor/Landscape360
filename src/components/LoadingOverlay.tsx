import { useEffect, useState } from 'react';

export const LoadingOverlay = () => {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black text-white animate-fade-out pointer-events-none">
      <div className="text-center relative overflow-hidden p-8">
        <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-4 relative z-10 animate-fade-in-up">
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-white to-blue-400 bg-[length:200%_auto] animate-shine">
            GeoPortal 360
          </span>
        </h1>
        <p className="text-sm md:text-lg text-blue-200/80 uppercase tracking-[0.3em] font-light animate-fade-in-up-delay">
          Precision in Every Dimension.
        </p>
        
        {/* Glow effect */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 bg-blue-500/20 rounded-full blur-3xl -z-10 animate-pulse-slow"></div>
      </div>
    </div>
  );
};
