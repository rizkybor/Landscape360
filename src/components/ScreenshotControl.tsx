import { useState } from "react";
import { Camera, FileText, Image as ImageIcon, X } from "lucide-react";
import jsPDF from "jspdf";
import type { MapRef } from "react-map-gl/mapbox";

interface ScreenshotControlProps {
  mapRefs: React.RefObject<MapRef | null>[];
}

export const ScreenshotControl: React.FC<ScreenshotControlProps> = ({
  mapRefs,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);

  const handleCapture = async (format: "png" | "jpg" | "pdf") => {
    if (!mapRefs || mapRefs.length === 0) return alert("No map is ready.");

    setIsCapturing(true);
    await new Promise((resolve) => setTimeout(resolve, 100));

    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const filename = `geoportal-capture-${timestamp}`;

      // Ambil semua canvas dari mapRefs
      const canvases: HTMLCanvasElement[] = mapRefs
        .map((ref) => ref.current?.getMap().getCanvas())
        .filter(Boolean) as HTMLCanvasElement[];

      if (canvases.length === 0) return alert("No map canvas available.");

      if (format === "pdf") {
        // Buat PDF gabungan (1 map per halaman)
        const pdf = new jsPDF({ unit: "px", format: "a4" });
        canvases.forEach((canvas, idx) => {
          const imgData = canvas.toDataURL("image/png");
          const pageWidth = pdf.internal.pageSize.getWidth();
          const pageHeight = pdf.internal.pageSize.getHeight();

          // scale canvas to fit page
          const scale = Math.min(
            pageWidth / canvas.width,
            pageHeight / canvas.height,
          );
          const w = canvas.width * scale;
          const h = canvas.height * scale;
          const x = (pageWidth - w) / 2;
          const y = (pageHeight - h) / 2;

          pdf.addImage(imgData, "PNG", x, y, w, h);
          if (idx < canvases.length - 1) pdf.addPage();
        });

        pdf.save(`${filename}.pdf`);
      } else {
        canvases.forEach((canvas, idx) => {
          const imgData = canvas.toDataURL(
            format === "jpg" ? "image/jpeg" : "image/png",
          );
          const link = document.createElement("a");
          link.href = imgData;
          link.download = `${filename}-${idx + 1}.${format}`;
          link.click();
        });
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
    <div className="fixed bottom-24 left-8 z-30">
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
        <div className="bg-black/80 backdrop-blur-xl border border-white/20 rounded-xl p-4 text-white shadow-2xl animate-fade-in-up origin-top-right relative">
          {/* Header */}
          <div className="flex justify-between items-center mb-4 border-b border-white/10 pb-2">
            <h3 className="font-bold text-sm flex items-center gap-2">
              <Camera size={16} className="text-blue-400" /> Capture View
            </h3>
            <button
              onClick={() => setIsOpen(false)}
              className="cursor-pointer text-gray-400 hover:text-white"
            >
              <X size={16} />
            </button>
          </div>

          {/* Buttons PNG / JPG / PDF */}
          <div className="grid grid-cols-1 gap-2">
            {["png", "jpg", "pdf"].map((format) => (
              <button
                key={format}
                onClick={() => handleCapture(format as "png" | "jpg" | "pdf")}
                disabled={isCapturing}
                className={`cursor-pointer flex items-center gap-3 px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-xs transition-colors text-left group ${
                  format === "pdf"
                    ? "hover:bg-red-600/20"
                    : "hover:bg-blue-600/20"
                }`}
              >
                <div
                  className={`p-1.5 rounded transition-colors ${
                    format === "pdf"
                      ? "bg-red-500/20 text-red-300 group-hover:bg-red-500 group-hover:text-white"
                      : "bg-blue-500/20 text-blue-300 group-hover:bg-blue-500 group-hover:text-white"
                  }`}
                >
                  {format === "pdf" ? (
                    <FileText size={14} />
                  ) : (
                    <ImageIcon size={14} />
                  )}
                </div>
                <div>
                  <span className="block font-bold">
                    {format === "png"
                      ? "Save as PNG"
                      : format === "jpg"
                        ? "Save as JPG"
                        : "Export to PDF"}
                  </span>
                  <span className="text-[10px] text-gray-400">
                    {format === "png"
                      ? "Best for digital use"
                      : format === "jpg"
                        ? "Smaller file size"
                        : "For documentation"}
                  </span>
                </div>
              </button>
            ))}
          </div>

          {/* Loading overlay */}
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
