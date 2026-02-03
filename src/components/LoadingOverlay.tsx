import { useEffect, useState } from 'react';

export const LoadingOverlay = ({ onComplete }: { onComplete?: () => void }) => {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    // Remove auto-close timer to make it a true Get Started screen
    // const timer = setTimeout(() => {
    //   setIsVisible(false);
    //   onComplete?.();
    // }, 2000);
    // return () => clearTimeout(timer);
  }, [onComplete]);

  const [isClosing, setIsClosing] = useState(false);

  if (!isVisible) return null;

  return (
    <div className={`fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black text-white pointer-events-auto transition-opacity duration-500 ${isClosing ? 'opacity-0' : 'opacity-100'}`}>
      <div className="text-center relative overflow-hidden p-8">
        <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-4 relative z-10 animate-fade-in-up">
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-white to-blue-400 bg-[length:200%_auto] animate-shine">
            Landscape 360
          </span>
        </h1>
        <p className="text-sm md:text-lg text-blue-200/80 uppercase tracking-[0.3em] font-light animate-fade-in-up-delay">
          Precision in Every Dimension.
        </p>
        
        {/* Glow effect - Optimized for mobile: removed heavy blur */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 bg-blue-500/20 rounded-full md:blur-3xl blur-xl -z-10 animate-pulse-slow"></div>

        {/* Start Button */}
        <button 
          onClick={() => {
            setIsClosing(true);
            setTimeout(() => {
                setIsVisible(false);
                onComplete?.();
            }, 500);
          }}
          className="cursor-pointer mt-12 px-8 py-3 bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/30 rounded-full text-sm font-medium tracking-wider uppercase transition-all duration-300 animate-fade-in-up-delay-2 group"
        >
          <span className="group-hover:text-blue-300 transition-colors">Start Your Journey</span>
        </button>
      </div>
    </div>
  );
};
