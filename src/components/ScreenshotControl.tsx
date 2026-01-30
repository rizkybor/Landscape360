import { useState } from 'react';
import { Camera, FileText, Image as ImageIcon, X } from 'lucide-react';
import jsPDF from 'jspdf';
import { useMap } from 'react-map-gl/mapbox';

export const ScreenshotControl = () => {
  const { current: mapRef } = useMap();
  const [isOpen, setIsOpen] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);

  const handleCapture = async (format: 'png' | 'jpg' | 'pdf') => {
    if (!mapRef) return;
    setIsCapturing(true);
    
    // Allow UI to update (show loading state if needed)
    await new Promise(resolve => setTimeout(resolve, 100));

    try {
      const map = mapRef.getMap();
      
      // Force repaint to ensure fresh buffer
      map.triggerRepaint();
      
      // Get the canvas directly - this contains all map layers (satellite, terrain, vectors)
      const mapCanvas = map.getCanvas();
      const imgData = mapCanvas.toDataURL(format === 'jpg' ? 'image/jpeg' : 'image/png');
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `geoportal-capture-${timestamp}`;

      if (format === 'pdf') {
        const pdf = new jsPDF({
          orientation: mapCanvas.width > mapCanvas.height ? 'landscape' : 'portrait',
          unit: 'px',
          format: [mapCanvas.width, mapCanvas.height]
        });
        pdf.addImage(imgData, 'PNG', 0, 0, mapCanvas.width, mapCanvas.height);
        pdf.save(`${filename}.pdf`);
      } else {
        const link = document.createElement('a');
        link.href = imgData;
        link.download = `${filename}.${format}`;
        link.click();
      }
    } catch (err) {
      console.error("Screenshot failed:", err);
      alert("Failed to capture screenshot. Please try again.");
    } finally {
      setIsCapturing(false);
      setIsOpen(false);
    }
  };

  return (
    <div className="fixed top-4 right-20 z-30 no-screenshot">
      {!isOpen ? (
        <button
          onClick={() => setIsOpen(true)}
          className="cursor-pointer p-3 bg-white/10 backdrop-blur-md border border-white/20 rounded-full text-white hover:bg-white/20 transition-all shadow-lg hover:scale-105"
          title="Take Screenshot"
          disabled={isCapturing}
        >
           <Camera size={20} className={isCapturing ? "animate-pulse" : ""} />
        </button>
      ) : (
        <div className="bg-black/80 backdrop-blur-xl border border-white/20 rounded-xl p-4 text-white shadow-2xl animate-fade-in-up origin-top-right">
           <div className="flex justify-between items-center mb-4 border-b border-white/10 pb-2">
              <h3 className="font-bold text-sm flex items-center gap-2">
                 <Camera size={16} className="text-blue-400" /> Capture View
              </h3>
              <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-white cursor-pointer">
                 <X size={16} />
              </button>
           </div>
           
           <div className="grid grid-cols-1 gap-2">
              <button 
                onClick={() => handleCapture('png')}
                disabled={isCapturing}
                className="cursor-pointer flex items-center gap-3 px-4 py-2 bg-white/5 hover:bg-blue-600/20 border border-white/10 rounded-lg text-xs transition-colors text-left group"
              >
                 <div className="p-1.5 bg-blue-500/20 rounded group-hover:bg-blue-500 text-blue-300 group-hover:text-white transition-colors">
                    <ImageIcon size={14} />
                 </div>
                 <div>
                    <span className="block font-bold">Save as PNG</span>
                    <span className="text-[10px] text-gray-400">Best for digital use</span>
                 </div>
              </button>

              <button 
                onClick={() => handleCapture('jpg')}
                disabled={isCapturing}
                className="cursor-pointer flex items-center gap-3 px-4 py-2 bg-white/5 hover:bg-blue-600/20 border border-white/10 rounded-lg text-xs transition-colors text-left group"
              >
                 <div className="p-1.5 bg-blue-500/20 rounded group-hover:bg-blue-500 text-blue-300 group-hover:text-white transition-colors">
                    <ImageIcon size={14} />
                 </div>
                 <div>
                    <span className="block font-bold">Save as JPG</span>
                    <span className="text-[10px] text-gray-400">Smaller file size</span>
                 </div>
              </button>

              <button 
                onClick={() => handleCapture('pdf')}
                disabled={isCapturing}
                className="cursor-pointer flex items-center gap-3 px-4 py-2 bg-white/5 hover:bg-red-600/20 border border-white/10 rounded-lg text-xs transition-colors text-left group"
              >
                 <div className="p-1.5 bg-red-500/20 rounded group-hover:bg-red-500 text-red-300 group-hover:text-white transition-colors">
                    <FileText size={14} />
                 </div>
                 <div>
                    <span className="block font-bold">Export to PDF</span>
                    <span className="text-[10px] text-gray-400">For documentation</span>
                 </div>
              </button>
           </div>

           {isCapturing && (
             <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center rounded-xl z-10">
                <div className="flex flex-col items-center gap-2">
                   <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                   <span className="text-[10px] font-mono">Capturing...</span>
                </div>
             </div>
           )}
        </div>
      )}
    </div>
  );
};
