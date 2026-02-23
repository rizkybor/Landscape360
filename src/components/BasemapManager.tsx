
import { useState, useRef } from "react";
import { useSurveyStore } from "../store/useSurveyStore";
import { useCustomBasemapStore } from "../store/useCustomBasemapStore";
import { Upload, X, Map as MapIcon, Eye, EyeOff, Trash2, AlertCircle, Loader2, Layers, ScanEye, Settings } from "lucide-react";

export const BasemapManager = ({ onClose, onZoomToLayer }: { onClose: () => void; onZoomToLayer?: (bounds: any) => void }) => {
  const { subscriptionStatus, userRole } = useSurveyStore();
  const { 
    basemaps, 
    uploadBasemap, 
    toggleBasemap, 
    deleteBasemap, 
    isUploading, 
    errorMessage,
    setLayerOpacity,
    layerOpacities,
    startGeoreferencing,
    tempBounds,
    setTempBounds,
    pendingGeoreferenceFile,
    setPendingGeoreferenceFile,
    setEditingBasemapId,
    totalUsage
  } = useCustomBasemapStore();
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [showManualInput, setShowManualInput] = useState(false);
  const [deleteConfirmationId, setDeleteConfirmationId] = useState<string | null>(null);
  const [manualBounds, setManualBounds] = useState({ north: -6.1, south: -6.2, east: 106.9, west: 106.8 });

  const MAX_STORAGE = 5 * 1024 * 1024;
  const usagePercentage = (totalUsage / MAX_STORAGE) * 100;
  const isQuotaFull = totalUsage >= MAX_STORAGE;

  // Restore state if returning from georeferencing
  useState(() => {
      if (tempBounds && pendingGeoreferenceFile) {
          setManualBounds(tempBounds);
          setShowManualInput(true);
          // Consume temp bounds
          setTempBounds(null);
      }
  });

  // Access Control
  const canAccess = userRole === 'monitor360' && subscriptionStatus === 'Enterprise';

  if (!canAccess) {
      return (
          <div className="fixed z-50 inset-y-0 right-0 w-full md:w-80 bg-[#0f172a] text-white shadow-2xl border-l border-white/10 flex flex-col items-center justify-center p-6">
              <AlertCircle className="w-16 h-16 text-yellow-500 mb-4" />
              <h3 className="text-xl font-bold text-white mb-2">Feature Locked</h3>
              <p className="text-sm text-gray-400 mb-6 text-center leading-relaxed">
                  Custom Basemaps are exclusively available for <br/>
                  <span className="text-white font-bold">Enterprise</span> users with <br/>
                  <span className="text-blue-400 font-bold">Monitoring360</span> access.
              </p>
              <button 
                onClick={onClose}
                className="cursor-pointer px-6 py-2.5 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-bold transition-colors border border-white/10"
              >
                  Close Panel
              </button>
          </div>
      );
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
        processFile(e.target.files[0]);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
          processFile(e.dataTransfer.files[0]);
      }
  };

  const processFile = (file: File) => {
      const fileName = file.name.toLowerCase();
      
      if (fileName.endsWith('.pdf')) {
          setPendingGeoreferenceFile(file);
          setShowManualInput(true);
      } else {
          uploadBasemap(file);
      }
  };

  const handleManualUpload = () => {
      if (pendingGeoreferenceFile) {
          uploadBasemap(pendingGeoreferenceFile, manualBounds);
          setShowManualInput(false);
          setPendingGeoreferenceFile(null);
      }
  };

  return (
    <div className="fixed z-40 inset-y-0 right-0 w-full md:w-80 bg-[#0f172a] text-white shadow-2xl transform transition-transform duration-300 ease-in-out md:border-l border-white/10 flex flex-col h-[80vh] md:h-full bottom-0 md:top-0 rounded-t-2xl md:rounded-none">
      {/* Header */}
      <div className="p-4 border-b border-white/10 flex items-center justify-between bg-[#1e293b]">
        <div className="flex items-center gap-2">
            <Layers className="text-blue-400" size={20} />
            <h2 className="font-bold text-sm uppercase tracking-wider">Custom Basemaps</h2>
        </div>
        <button onClick={onClose} className="cursor-pointer text-gray-400 hover:text-white transition-colors">
            <X size={20} />
        </button>
      </div>

      {/* Storage Quota Indicator */}
      <div className="px-4 pt-4 pb-2">
          <div className="flex justify-between text-[10px] text-gray-400 mb-1">
              <span>Storage Usage</span>
              <span className={isQuotaFull ? "text-red-400 font-bold" : "text-blue-300"}>
                  {(totalUsage / 1024 / 1024).toFixed(2)} MB / 5 MB
              </span>
          </div>
          <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden border border-white/5">
              <div 
                className={`h-full rounded-full transition-all duration-500 ${isQuotaFull ? "bg-red-500" : "bg-blue-500"}`}
                style={{ width: `${Math.min(usagePercentage, 100)}%` }}
              ></div>
          </div>
      </div>

      {/* Upload Area */}
      <div className="p-4">
          {!showManualInput ? (
          <div 
            className={`
                border-2 border-dashed rounded-xl p-6 text-center transition-all duration-200 cursor-pointer
                ${isDragOver ? "border-blue-500 bg-blue-500/10" : "border-white/10 hover:border-white/30 bg-white/5"}
                ${isUploading || isQuotaFull ? "opacity-50 pointer-events-none" : ""}
            `}
            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
            onClick={() => !isQuotaFull && fileInputRef.current?.click()}
          >
              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept=".tif,.tiff,.pdf"
                onChange={handleFileSelect}
                disabled={isUploading || isQuotaFull}
              />
              
              {isUploading ? (
                  <div className="flex flex-col items-center gap-2">
                      <Loader2 className="animate-spin text-blue-400" size={32} />
                      <span className="text-sm font-medium text-blue-300">Uploading & Processing...</span>
                  </div>
              ) : isQuotaFull ? (
                  <div className="flex flex-col items-center gap-2">
                      <AlertCircle className="text-red-400" size={32} />
                      <span className="text-sm font-bold text-red-300">
                          Storage Limit Reached
                      </span>
                      <span className="text-[10px] text-gray-500 text-center max-w-[200px]">
                          Delete existing maps to free up space.
                      </span>
                  </div>
              ) : (
                  <div className="flex flex-col items-center gap-2">
                      <Upload className="text-gray-400" size={32} />
                      <span className="text-sm font-medium text-gray-300">
                          Click or Drag File here
                      </span>
                      <span className="text-[10px] text-gray-500 text-center max-w-[200px]">
                          Supported: GeoTIFF (.tif) or GeoPDF. Max 150MB (Original Size). WGS84 Required.
                      </span>
                  </div>
              )}
          </div>
          ) : (
            <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                    <Settings size={16} className="text-blue-400" />
                    <h3 className="text-sm font-bold">Manual Georeference</h3>
                </div>
                <p className="text-[10px] text-gray-400 mb-3">
                    For GeoPDF, auto-detection is limited. Please confirm or adjust bounds (WGS84).
                </p>
                <div className="grid grid-cols-2 gap-2 mb-3">
                    <div>
                        <label className="text-[10px] text-gray-500 block mb-1">North</label>
                        <input 
                            type="number" step="0.0001"
                            value={manualBounds.north}
                            onChange={(e) => setManualBounds({...manualBounds, north: parseFloat(e.target.value)})}
                            className="w-full bg-black/20 border border-white/10 rounded px-2 py-1 text-xs"
                        />
                    </div>
                    <div>
                        <label className="text-[10px] text-gray-500 block mb-1">South</label>
                        <input 
                            type="number" step="0.0001"
                            value={manualBounds.south}
                            onChange={(e) => setManualBounds({...manualBounds, south: parseFloat(e.target.value)})}
                            className="w-full bg-black/20 border border-white/10 rounded px-2 py-1 text-xs"
                        />
                    </div>
                    <div>
                        <label className="text-[10px] text-gray-500 block mb-1">West</label>
                        <input 
                            type="number" step="0.0001"
                            value={manualBounds.west}
                            onChange={(e) => setManualBounds({...manualBounds, west: parseFloat(e.target.value)})}
                            className="w-full bg-black/20 border border-white/10 rounded px-2 py-1 text-xs"
                        />
                    </div>
                    <div>
                        <label className="text-[10px] text-gray-500 block mb-1">East</label>
                        <input 
                            type="number" step="0.0001"
                            value={manualBounds.east}
                            onChange={(e) => setManualBounds({...manualBounds, east: parseFloat(e.target.value)})}
                            className="w-full bg-black/20 border border-white/10 rounded px-2 py-1 text-xs"
                        />
                    </div>
                </div>
                <div className="flex gap-2">
                    <button 
                        onClick={() => { setShowManualInput(false); setPendingGeoreferenceFile(null); }}
                        className="cursor-pointer flex-1 py-1.5 bg-white/5 hover:bg-white/10 rounded text-xs transition-colors"
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={() => startGeoreferencing('A4_LANDSCAPE')}
                        className="cursor-pointer flex-1 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 rounded text-xs font-bold transition-colors flex items-center justify-center gap-1"
                    >
                        Pick on Map
                    </button>
                    <button 
                        onClick={handleManualUpload}
                        className="cursor-pointer flex-1 py-1.5 bg-blue-600 hover:bg-blue-500 rounded text-xs font-bold transition-colors"
                    >
                        Upload
                    </button>
                </div>
            </div>
          )}
          
          {errorMessage && (
              <div className="mt-3 p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-2">
                  <AlertCircle size={16} className="text-red-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-red-300">{errorMessage}</p>
              </div>
          )}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-3 custom-scrollbar">
          {basemaps.length === 0 && !isUploading && (
              <div className="text-center py-8 text-gray-500 text-xs italic">
                  No custom basemaps uploaded yet.
              </div>
          )}

          {basemaps.map((map) => (
              <div key={map.id} className="bg-white/5 border border-white/10 rounded-lg p-3 transition-all hover:bg-white/10">
                  <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 overflow-hidden">
                          <MapIcon size={16} className="text-blue-400 shrink-0" />
                          <span className="font-medium text-sm truncate" title={map.name}>
                              {map.name}
                          </span>
                      </div>
                      <div className="flex items-center gap-1">
                          {onZoomToLayer && map.bounds && (
                            <button 
                              onClick={() => onZoomToLayer(map.bounds)}
                              className="cursor-pointer p-1.5 rounded-md bg-white/5 text-gray-500 hover:text-blue-400 transition-colors"
                              title="Zoom to Layer"
                            >
                                <ScanEye size={14} />
                            </button>
                          )}
                          <button 
                            onClick={() => toggleBasemap(map.id, !map.is_active)}
                            className={`cursor-pointer p-1.5 rounded-md transition-colors ${map.is_active ? "bg-blue-500/20 text-blue-400" : "bg-white/5 text-gray-500 hover:text-white"}`}
                            title={map.is_active ? "Hide Layer" : "Show Layer"}
                          >
                              {map.is_active ? <Eye size={14} /> : <EyeOff size={14} />}
                          </button>
                          <button 
                            onClick={() => {
                                setDeleteConfirmationId(map.id);
                            }}
                            className="cursor-pointer p-1.5 rounded-md bg-white/5 text-gray-500 hover:text-red-400 transition-colors"
                            title="Delete"
                          >
                              <Trash2 size={14} />
                          </button>
                          
                          {/* Edit Georeference Button */}
                          <button 
                            onClick={() => {
                                setEditingBasemapId(map.id);
                                startGeoreferencing('A4_LANDSCAPE', map.bounds);
                            }}
                            className="cursor-pointer p-1.5 rounded-md bg-white/5 text-gray-500 hover:text-indigo-400 transition-colors"
                            title="Adjust Georeference"
                          >
                              <Settings size={14} />
                          </button>
                      </div>
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-gray-500 mb-2">
                      <span>{(map.file_size / 1024 / 1024).toFixed(2)} MB (convert size by 360)</span>
                      <span>{new Date(map.created_at).toLocaleDateString()}</span>
                  </div>

                  {/* Opacity Slider */}
                  {map.is_active && (
                      <div className="mt-2 pt-2 border-t border-white/5">
                          <div className="flex items-center justify-between text-[10px] text-gray-400 mb-1">
                              <span>Opacity</span>
                              <span>{Math.round((layerOpacities[map.id] ?? 1) * 100)}%</span>
                          </div>
                          <input 
                            type="range" 
                            min="0" 
                            max="100" 
                            step="1"
                            value={(layerOpacities[map.id] ?? 1) * 100}
                            onChange={(e) => setLayerOpacity(map.id, Number(e.target.value) / 100)}
                            className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                          />
                      </div>
                  )}
              </div>
          ))}
      </div>
      {/* Delete Confirmation Modal */}
      {deleteConfirmationId && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-[#1e293b] border border-white/10 rounded-2xl shadow-2xl max-w-sm w-full p-6 transform transition-all scale-100 opacity-100 animate-in fade-in zoom-in-95 duration-200">
                <div className="flex flex-col items-center text-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center">
                        <Trash2 size={24} className="text-red-500" />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-white mb-1">Delete Basemap?</h3>
                        <p className="text-sm text-gray-400">
                            Are you sure you want to delete <span className="text-white font-medium">"{basemaps.find(b => b.id === deleteConfirmationId)?.name}"</span>? This action cannot be undone.
                        </p>
                    </div>
                    <div className="flex gap-3 w-full mt-2">
                        <button 
                            onClick={() => setDeleteConfirmationId(null)}
                            className="cursor-pointer flex-1 py-2.5 bg-white/5 hover:bg-white/10 text-white text-sm font-medium rounded-xl transition-colors cursor-pointer"
                        >
                            Cancel
                        </button>
                        <button 
                            onClick={() => {
                                if (deleteConfirmationId) deleteBasemap(deleteConfirmationId);
                                setDeleteConfirmationId(null);
                            }}
                            className="cursor-pointer flex-1 py-2.5 bg-red-600 hover:bg-red-500 text-white text-sm font-bold rounded-xl shadow-lg shadow-red-500/20 transition-all active:scale-[0.98] cursor-pointer"
                        >
                            Delete
                        </button>
                    </div>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};
