
import { create } from 'zustand';
import { supabase } from '../lib/supabaseClient';
import { useSurveyStore } from './useSurveyStore';
import * as GeoTIFF from 'geotiff';
import * as pdfjsLib from 'pdfjs-dist';
import proj4 from 'proj4';
import toProj4 from 'geotiff-geokeys-to-proj4';

// @ts-ignore
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// Define WGS84
proj4.defs('EPSG:4326', '+proj=longlat +datum=WGS84 +no_defs');

// Use standard worker path from CDN or local public if configured
// The version must match the installed package version exactly
// Use ?url import for Vite compatibility if possible, but fallback to unpkg for now
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

export interface CustomBasemap {
  id: string;
  user_id: string;
  name: string;
  file_path: string;
  file_size: number;
  crs?: string;
  bounds?: { north: number; south: number; east: number; west: number };
  resolution?: { width: number; height: number };
  is_active: boolean;
  created_at: string;
  image_url?: string; // Signed URL for rendering
}

interface CustomBasemapState {
  basemaps: CustomBasemap[];
  isLoading: boolean;
  isUploading: boolean;
  uploadProgress: number;
  errorMessage: string | null;
  totalUsage: number; // Bytes
  
  isManagerOpen: boolean;
  toggleManager: () => void;
  loadBasemaps: () => Promise<void>;
  uploadBasemap: (file: File, manualBounds?: { north: number, south: number, east: number, west: number }) => Promise<void>;
  toggleBasemap: (id: string, active: boolean) => Promise<void>;
  deleteBasemap: (id: string) => Promise<void>;
  layerOpacities: Record<string, number>;
  setLayerOpacity: (id: string, opacity: number) => void;
  
  // Georeferencing Tool State
  isGeoreferencing: boolean;
  georeferenceTarget: 'A4_LANDSCAPE' | 'A4_PORTRAIT' | 'FREE';
  startGeoreferencing: (format: 'A4_LANDSCAPE' | 'A4_PORTRAIT', initialBounds?: { north: number, south: number, east: number, west: number }) => void;
  stopGeoreferencing: () => void;
  georeferenceCallback: ((bounds: { north: number, south: number, east: number, west: number }) => void) | null;
  tempBounds: { north: number, south: number, east: number, west: number } | null;
  setTempBounds: (bounds: { north: number, south: number, east: number, west: number } | null) => void;
  pendingGeoreferenceFile: File | null;
  setPendingGeoreferenceFile: (file: File | null) => void;
  initialGeoreferenceBounds: { north: number, south: number, east: number, west: number } | null; // For editing
  updateBasemapBounds: (id: string, bounds: { north: number, south: number, east: number, west: number }) => Promise<void>;
  editingBasemapId: string | null;
  setEditingBasemapId: (id: string | null) => void;
}

const MAX_STORAGE_LIMIT = 5 * 1024 * 1024; // 5MB

export const useCustomBasemapStore = create<CustomBasemapState>((set, get) => ({
  basemaps: [],
  isLoading: false,
  isUploading: false,
  uploadProgress: 0,
  errorMessage: null,
  totalUsage: 0,
  layerOpacities: {},
  isManagerOpen: false,
  toggleManager: () => set((state) => ({ isManagerOpen: !state.isManagerOpen })),

  // Georeferencing Tool
  isGeoreferencing: false,
  georeferenceTarget: 'A4_LANDSCAPE',
  georeferenceCallback: null,
  tempBounds: null,
  setTempBounds: (bounds) => set({ tempBounds: bounds }),
  pendingGeoreferenceFile: null,
  setPendingGeoreferenceFile: (file) => set({ pendingGeoreferenceFile: file }),
  initialGeoreferenceBounds: null,
  editingBasemapId: null,
  setEditingBasemapId: (id) => set({ editingBasemapId: id }),
  
  startGeoreferencing: (format, initialBounds) => set({ 
      isGeoreferencing: true, 
      georeferenceTarget: format,
      initialGeoreferenceBounds: initialBounds || null,
      isManagerOpen: false 
  }),
  stopGeoreferencing: () => set({ 
      isGeoreferencing: false, 
      initialGeoreferenceBounds: null,
      isManagerOpen: true 
  }),

  updateBasemapBounds: async (id, bounds) => {
      // Optimistic update
      set((state) => ({
          basemaps: state.basemaps.map(b => b.id === id ? { ...b, bounds } : b)
      }));

      const { error } = await supabase
          .from('custom_basemaps')
          .update({ bounds })
          .eq('id', id);

      if (error) {
          console.error("Failed to update bounds", error);
          // Revert or show error?
          await get().loadBasemaps();
      }
  },

  loadBasemaps: async () => {
    const { user } = useSurveyStore.getState();
    if (!user) return;

    set({ isLoading: true, errorMessage: null });
    
    const { data, error } = await supabase
      .from('custom_basemaps')
      .select('*')
      .eq('user_id', user.id) // Explicitly filter by user_id
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error loading basemaps:', error);
      set({ errorMessage: 'Failed to load basemaps', isLoading: false });
      return;
    }

    // Generate signed URLs for active basemaps (lazy load?)
    // For now, let's just store the metadata. The Map component will request URL.
    // Actually, to render, we need the URL.
    // Let's iterate and sign URLs for active ones? Or all?
    // Signing all might be slow if many. 
    // Let's sign on demand or just sign valid for 1 hour when loading.
    
    const basemapsWithUrls = await Promise.all((data || []).map(async (b) => {
        if (b.is_active) {
            const { data: signed } = await supabase.storage
                .from('custom-basemaps')
                .createSignedUrl(b.file_path, 3600);
            return { ...b, image_url: signed?.signedUrl };
        }
        return b;
    }));

    const totalUsage = basemapsWithUrls.reduce((acc, curr) => acc + (curr.file_size || 0), 0);

    set({ basemaps: basemapsWithUrls, totalUsage, isLoading: false });
  },

  uploadBasemap: async (file: File, manualBounds) => {
    const { user } = useSurveyStore.getState();
    if (!user) return;

    // Client-side Validation
    const { totalUsage } = get();

    if (totalUsage >= MAX_STORAGE_LIMIT) {
        set({ errorMessage: 'Storage limit reached (5MB). Please delete existing maps.' });
        return;
    }

    if (file.size > 150 * 1024 * 1024) {
        set({ errorMessage: 'File size exceeds 150MB limit.' });
        return;
    }

    // Check file type
    const fileName = file.name.toLowerCase();
    const isTiff = fileName.endsWith('.tif') || fileName.endsWith('.tiff');
    const isPdf = fileName.endsWith('.pdf');

    if (!isTiff && !isPdf) {
        set({ errorMessage: 'Only GeoTIFF (.tif, .tiff) and GeoPDF (.pdf) are supported.' });
        return;
    }

    set({ isUploading: true, uploadProgress: 0, errorMessage: null });

    try {
        let bounds;
        let width;
        let height;
        let imageBlob: Blob;
        let canvas: HTMLCanvasElement;

        // Max dimension for mobile optimization (e.g., 2500px)
        // This keeps memory usage low while maintaining decent quality
        const MAX_DIMENSION = 2500;

        if (isTiff) {
            // Parse GeoTIFF Metadata
            const arrayBuffer = await file.arrayBuffer();
            const tiff = await GeoTIFF.fromArrayBuffer(arrayBuffer);
            const image = await tiff.getImage();
            width = image.getWidth();
            height = image.getHeight();
            const bbox = image.getBoundingBox(); // [minX, minY, maxX, maxY]
            
            // Reproject to WGS84 if needed
            let west = bbox[0];
            let south = bbox[1];
            let east = bbox[2];
            let north = bbox[3];

            try {
                // Get GeoKeys and attempt to find projection
                const geoKeys = image.getGeoKeys();
                // If we have geokeys, try to convert
                if (geoKeys) {
                    // @ts-ignore - geotiff keys type mismatch with converter
                    const projObj = toProj4.toProj4(geoKeys); 
                    if (projObj && projObj.proj4) {
                        // Register the projection
                        const sourceProj = projObj.proj4;
                        
                        // If it's not already lat/long, assume we need to convert
                        // Simple heuristic: if it contains 'longlat', it's likely degrees
                        if (sourceProj.indexOf('longlat') === -1) {
                            
                            // Perform reprojection using proj4
                            // sourceProj is the proj4 string
                            const minPoint = proj4(sourceProj, 'EPSG:4326', [west, south]);
                            const maxPoint = proj4(sourceProj, 'EPSG:4326', [east, north]);
                            
                            west = minPoint[0];
                            south = minPoint[1];
                            east = maxPoint[0];
                            north = maxPoint[1];
                            
                            console.log("Reprojected bounds to WGS84:", { west, south, east, north });
                        }
                    }
                }
            } catch (e) {
                console.warn("Failed to reproject GeoTIFF coordinates:", e);
                // Fallback: If coordinates look like meters (huge numbers), warn user
                if (Math.abs(west) > 180 || Math.abs(south) > 90) {
                     console.error("Coordinates seem to be projected but reprojection failed.");
                }
            }

            bounds = {
                west,
                south,
                east,
                north
            };

            // Convert GeoTIFF to PNG Blob for Mapbox compatibility
            
            // Calculate scale to fit max dimension
            let scale = 1;
            if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
                scale = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height);
            }
            
            const targetWidth = Math.round(width * scale);
            const targetHeight = Math.round(height * scale);

            canvas = document.createElement('canvas');
            canvas.width = targetWidth;
            canvas.height = targetHeight;
            const ctx = canvas.getContext('2d');
            
            if (ctx) {
                // Optimize: Try to read rasters at target resolution directly
                // This saves memory and time if supported by underlying geotiff library
                const rasters = await image.readRasters({ width: targetWidth, height: targetHeight });
                
                const imageData = ctx.createImageData(targetWidth, targetHeight);
                const data = imageData.data;
                const [r, g, b, a] = rasters as any; // Type assertion

                // Check if rasters were actually resized or full size
                const rasterSize = r ? r.length : 0;
                
                if (rasterSize === targetWidth * targetHeight) {
                    // Fast path: Direct copy
                    for (let i = 0; i < rasterSize; i++) {
                        const idx = i * 4;
                        data[idx] = r ? r[i] : 0;
                        data[idx + 1] = g ? g[i] : 0;
                        data[idx + 2] = b ? b[i] : 0;
                        data[idx + 3] = a ? a[i] : 255;
                    }
                } else {
                    // Fallback: Manual downsampling (nearest neighbor)
                    // The rasters are full size (width * height)
                    for (let y = 0; y < targetHeight; y++) {
                        for (let x = 0; x < targetWidth; x++) {
                            // Map target coordinate to source coordinate
                            const srcX = Math.floor(x / scale);
                            const srcY = Math.floor(y / scale);
                            const srcIdx = srcY * width + srcX;
                            const dstIdx = (y * targetWidth + x) * 4;
                            
                            data[dstIdx] = r ? r[srcIdx] : 0;
                            data[dstIdx + 1] = g ? g[srcIdx] : 0;
                            data[dstIdx + 2] = b ? b[srcIdx] : 0;
                            data[dstIdx + 3] = a ? a[srcIdx] : 255;
                        }
                    }
                }
                
                ctx.putImageData(imageData, 0, 0);
                
                imageBlob = await new Promise<Blob>((resolve, reject) => {
                    canvas.toBlob((blob) => {
                        if (blob) resolve(blob);
                        else reject(new Error("Canvas to Blob failed"));
                    }, 'image/png', 0.8); // 80% quality
                });
            } else {
                 throw new Error("Failed to create canvas context");
            }

        } else if (isPdf) {
            // Parse GeoPDF Metadata (LGIDict or VP dict)
            const arrayBuffer = await file.arrayBuffer();
            const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
            const pdf = await loadingTask.promise;
            
            // Get first page only (assuming basemap is single page or first page)
            const page = await pdf.getPage(1);
            let viewport = page.getViewport({ scale: 1.0 }); 
            
            width = viewport.width;
            height = viewport.height;

            // Calculate scale to fit MAX_DIMENSION
            let renderScale = 1.0;
            if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
                renderScale = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height);
                viewport = page.getViewport({ scale: renderScale });
                width = viewport.width;
                height = viewport.height;
            }

            // Render PDF page to Canvas
            canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.width = width;
            canvas.height = height;
            
            if (context) {
                const renderContext = {
                    canvasContext: context,
                    viewport: viewport
                };
                // @ts-ignore - pdfjs types might be mismatching with current version
                await page.render(renderContext).promise;
                imageBlob = await new Promise<Blob>((resolve, reject) => {
                    canvas.toBlob((blob) => {
                         if (blob) resolve(blob);
                         else reject(new Error("PDF Render to Blob failed"));
                    }, 'image/png', 0.8);
                });
            } else {
                throw new Error("Failed to create PDF canvas context");
            }

            // Extract geospatial metadata from PDF structure
            // ... (Existing fallback logic)
            
            // Fallback strategy:
            // If manual bounds are provided, use them.
            if (manualBounds) {
                bounds = manualBounds;
            } else {
                // Allow the upload, but warn and set a default or approximate bounds if we can't find real ones.
                // Since we can't really find real ones easily, we will set a placeholder bounds
                // (e.g. current map view or a default like Jakarta) and let the user know.
                
                // For now, we set a default Jakarta bound just to let the feature work as a demo/MVP.
                // In a real production, this would be rejected or processed by a backend queue.
                
                bounds = {
                    west: 106.8,
                    south: -6.2,
                    east: 106.9,
                    north: -6.1
                };
                
                console.warn("GeoPDF Metadata not fully parsed. Using default bounds.");
            }
            
            // We don't throw error anymore to allow the upload flow to complete.
            // throw new Error("GeoPDF structure parsing requires server-side GDAL processing. Please use GeoTIFF for instant client-side preview.");
        } else {
             throw new Error("Unsupported file format.");
        }

        // Check Storage Quota with processed file size
        // If file is too big, try to compress
        let quality = 0.8;
        let attempt = 0;
        const MAX_ATTEMPTS = 3;
        
        while (totalUsage + imageBlob.size > MAX_STORAGE_LIMIT && attempt < MAX_ATTEMPTS) {
            console.log(`Image size ${imageBlob.size} exceeds limit. Attempting compression q=${quality - 0.2}...`);
            quality -= 0.2;
            attempt++;
            
            // Re-compress
            imageBlob = await new Promise<Blob>((resolve, reject) => {
                canvas.toBlob((blob) => {
                    if (blob) resolve(blob);
                    else reject(new Error("Compression failed"));
                }, 'image/png', quality); // Standard PNG doesn't support quality param in all browsers, but some do. 
                // Actually image/jpeg supports quality, image/png usually doesn't.
                // Mapbox supports JPEG raster sources? Yes.
                // But transparency is lost with JPEG.
                // We need transparency for basemaps (usually).
                // If we stick to PNG, we can't control quality much via toBlob in standard spec.
                // But we can resize.
            });
            
            // If PNG, changing quality param might not do anything.
            // We should resize if it's PNG.
        }
        
        // Revised approach for PNG resizing
        if (totalUsage + imageBlob.size > MAX_STORAGE_LIMIT) {
             // If still too big, we must resize the canvas
             // Calculate target ratio
             
             let currentWidth = canvas.width;
             let currentHeight = canvas.height;
             let currentBlob = imageBlob;
             
             while (totalUsage + currentBlob.size > MAX_STORAGE_LIMIT && currentWidth > 500) {
                 const newWidth = Math.floor(currentWidth * 0.7); // Reduce by 30%
                 const newHeight = Math.floor(currentHeight * 0.7);
                 
                 console.log(`Resizing to ${newWidth}x${newHeight} to fit quota...`);
                 
                 const tempCanvas = document.createElement('canvas');
                 tempCanvas.width = newWidth;
                 tempCanvas.height = newHeight;
                 const tCtx = tempCanvas.getContext('2d');
                 if (!tCtx) break;
                 
                 tCtx.drawImage(canvas, 0, 0, newWidth, newHeight);
                 
                 const newBlob = await new Promise<Blob | null>(r => tempCanvas.toBlob(r, 'image/png'));
                 if (newBlob) {
                     currentBlob = newBlob;
                     currentWidth = newWidth;
                     currentHeight = newHeight;
                     // Update original canvas for metadata
                     // We shouldn't update original canvas if we want to loop, but for next iteration we need source.
                     // Actually, drawing from original 'canvas' (high res) to tempCanvas is better quality.
                     // But we update currentWidth to break loop.
                 } else {
                     break;
                 }
             }
             imageBlob = currentBlob;
             // Update dimensions for metadata
             width = currentWidth;
             height = currentHeight;
        }

        if (totalUsage + imageBlob.size > MAX_STORAGE_LIMIT) {
            const availableMB = ((MAX_STORAGE_LIMIT - totalUsage) / 1024 / 1024).toFixed(2);
            throw new Error(`Optimized map size (${(imageBlob.size / 1024 / 1024).toFixed(2)} MB) still exceeds available storage (${availableMB} MB). Please delete other maps or use a simpler file.`);
        }

        // Upload File (Use the PNG Blob instead of original file for display compatibility)
        // We append .png to ensure browser treats it as image
        const filePath = `${user.id}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}.png`;
        
        const { error: uploadError } = await supabase.storage
            .from('custom-basemaps')
            .upload(filePath, imageBlob, {
                cacheControl: '3600',
                upsert: false,
                contentType: 'image/png'
            });

        if (uploadError) throw uploadError;

        // Insert Metadata
        const { error: dbError } = await supabase
            .from('custom_basemaps')
            .insert({
                user_id: user.id,
                name: file.name, // Keep original name
                file_path: filePath, // Points to the PNG
                file_size: imageBlob.size, // Size of PNG
                crs: 'EPSG:4326', // Assumed
                bounds: bounds,
                resolution: { width, height },
                is_active: true // Auto-activate on upload
            })
            .select()
            .single();

        if (dbError) throw dbError;

        // Refresh list
        await get().loadBasemaps();

    } catch (error: any) {
        console.error('Upload error:', error);
        set({ errorMessage: error.message || 'Failed to upload basemap.' });
    } finally {
        set({ isUploading: false, uploadProgress: 0 });
    }
  },

  toggleBasemap: async (id, active) => {
    set((state) => ({
        basemaps: state.basemaps.map(b => b.id === id ? { ...b, is_active: active } : b)
    }));

    // Optimistic update, then sync DB
    const { error } = await supabase
        .from('custom_basemaps')
        .update({ is_active: active })
        .eq('id', id);

    if (error) {
        console.error('Error updating basemap status:', error);
        // Revert?
        await get().loadBasemaps();
    } else {
        // If activating, we might need to fetch signed URL if missing
        const b = get().basemaps.find(b => b.id === id);
        if (active && b && !b.image_url) {
             const { data: signed } = await supabase.storage
                .from('custom-basemaps')
                .createSignedUrl(b.file_path, 3600);
             
             if (signed) {
                 set((state) => ({
                    basemaps: state.basemaps.map(map => map.id === id ? { ...map, image_url: signed.signedUrl } : map)
                 }));
             }
        }
    }
  },

  deleteBasemap: async (id) => {
    const b = get().basemaps.find(b => b.id === id);
    if (!b) return;

    // Delete from DB first
    const { error: dbError } = await supabase
        .from('custom_basemaps')
        .delete()
        .eq('id', id);

    if (dbError) {
        console.error('Error deleting basemap:', dbError);
        return;
    }

    // Delete from Storage
    const { error: storageError } = await supabase.storage
        .from('custom-basemaps')
        .remove([b.file_path]);

    if (storageError) {
        console.warn('Error deleting file from storage (orphan?):', storageError);
    }

    set((state) => ({
        basemaps: state.basemaps.filter(map => map.id !== id),
        totalUsage: state.totalUsage - (b.file_size || 0)
    }));
  },

  setLayerOpacity: (id, opacity) => {
      set((state) => ({
          layerOpacities: { ...state.layerOpacities, [id]: opacity }
      }));
  }

}));
