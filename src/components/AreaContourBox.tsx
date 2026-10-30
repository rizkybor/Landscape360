import { useRef, useState } from "react";
import { Download, Eye, EyeOff, Loader2, Lock, Trash2, Upload } from "lucide-react";
import { useMapStore } from "../store/useMapStore";
import { useMarkedAreaStore } from "../store/useMarkedAreaStore";
import { DEM_SOURCE, fetchAreaDem, type AreaDem } from "../services/terrainDem";
import {
  CONTOUR_INTERVALS,
  clipLinesToRing,
  elevationRange,
  gridToContours,
  guessInterval,
  ringTester,
  tidyLines,
  vertexCount,
  type ContourLine,
} from "../utils/contourGeo";
import {
  CONTOUR_FORMATS,
  UPLOAD_ACCEPT,
  fileBase,
  parseContourUpload,
  saveBlob,
  toGeoJSON,
  toGeoTiff,
  toKML,
  toKMZ,
  toShapefileZip,
  type ContourFormat,
} from "../utils/contourFormats";
import type { AreaContourData, MarkedArea } from "../types/markedArea";

// Saved contours stay well under the 5 MB the database accepts
const MAX_SAVED_BYTES = 4_500_000;
const MAX_SAVED_VERTICES = 250_000;

type Status = { kind: "busy" | "ok" | "error"; text: string } | null;

const chip = (active: boolean) =>
  `cursor-pointer px-2 py-1 rounded-lg text-[10px] font-bold ${
    active ? "bg-forest-800 text-white" : "bg-sand-100 hover:bg-sand-200 text-ink"
  }`;

const toSaved = (lines: ContourLine[]): AreaContourData => ({
  type: "FeatureCollection",
  features: lines.map((l) => ({
    type: "Feature",
    properties: { elevation: l.elevation },
    geometry: { type: "LineString", coordinates: l.coords },
  })),
});

const savedToLines = (data: AreaContourData): ContourLine[] =>
  data.features.map((f) => ({
    elevation: f.properties?.elevation ?? null,
    coords: f.geometry.coordinates as [number, number][],
  }));

const metres = (v: number) => `${Math.round(v).toLocaleString("en-US")} m`;

// Contours of one Marked Area (website only): download them from SRTM elevation data in
// SHP / GeoTIFF / GeoJSON / KML / KMZ, or upload your own contours to show on the map.
export const AreaContourBox = ({ area, allowed }: { area: MarkedArea; allowed: boolean }) => {
  const mapInterval = useMapStore((s) => s.contourInterval);
  const meta = useMarkedAreaStore((s) => s.contourMeta[area.id]);
  const shown = useMarkedAreaStore((s) => !!s.shownContours[area.id]);
  const { showContours, hideContours, saveContours, removeContours } = useMarkedAreaStore();

  const [interval, pickInterval] = useState(() => (CONTOUR_INTERVALS.includes(mapInterval) ? mapInterval : 25));
  const [source, setSource] = useState<"srtm" | "upload">("srtm");
  const [status, setStatus] = useState<Status>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  // The elevation grid is kept while the panel is open, so a second format needs no new download
  const demCache = useRef<{ key: string; dem: AreaDem } | null>(null);

  if (!allowed) {
    return (
      <div className="rounded-lg bg-sand-50 border border-sand-200 px-2.5 py-2 text-[11px] text-sand-700 flex gap-2">
        <Lock size={13} className="shrink-0 mt-0.5 text-sand-500" />
        <span>
          Download contours (SHP, GeoTIFF, GeoJSON, KML, KMZ) and upload your own: available on the{" "}
          <strong>Pro</strong> and <strong>Enterprise</strong> plans.
        </span>
      </div>
    );
  }

  const busy = status?.kind === "busy";
  const useUpload = source === "upload" && !!meta;

  const getDem = async () => {
    const key = `${area.id}:${area.updatedAt}`;
    if (demCache.current?.key === key) return demCache.current.dem;
    const dem = await fetchAreaDem(area.ring, (done, total) =>
      setStatus({ kind: "busy", text: `Downloading elevation data… ${done}/${total}` }),
    );
    demCache.current = { key, dem };
    return dem;
  };

  const download = async (format: ContourFormat) => {
    const base = fileBase(area.name);
    try {
      setStatus({ kind: "busy", text: "Preparing…" });
      let lines: ContourLine[];
      let lineInterval: number | null = interval;
      let sourceText = DEM_SOURCE;
      if (useUpload) {
        await showContours(area.id);
        const data = useMarkedAreaStore.getState().shownContours[area.id];
        if (!data) throw new Error("Could not load the uploaded contours.");
        lines = savedToLines(data);
        lineInterval = meta.intervalM;
        sourceText = `uploaded file ${meta.sourceName}`;
      } else {
        const dem = await getDem();
        if (format === "geotiff") {
          setStatus({ kind: "busy", text: "Writing GeoTIFF…" });
          saveBlob(await toGeoTiff(dem, ringTester(area.ring)), `${base.replace(/_contours$/, "")}_dem.tif`);
          setStatus({ kind: "ok", text: `DEM downloaded (${dem.width} × ${dem.height} cells, WGS84).` });
          return;
        }
        const all = await gridToContours(dem, interval, (done, total) =>
          setStatus({ kind: "busy", text: `Drawing contours… ${done}/${total}` }),
        );
        // A third of a cell keeps the shape and drops most of the points
        lines = tidyLines(clipLinesToRing(all, area.ring), dem.resX / 3);
      }
      if (!lines.length) throw new Error("No contour lines inside this area. Try a smaller interval.");

      const info = { name: area.name, interval: lineInterval, source: sourceText };
      if (format === "geojson") {
        saveBlob(new Blob([JSON.stringify(toGeoJSON(lines, info))], { type: "application/geo+json" }), `${base}.geojson`);
      } else if (format === "kml") {
        saveBlob(new Blob([toKML(lines, info)], { type: "application/vnd.google-earth.kml+xml" }), `${base}.kml`);
      } else if (format === "kmz") {
        saveBlob(await toKMZ(lines, info), `${base}.kmz`);
      } else {
        saveBlob(await toShapefileZip(lines, info, base), `${base}_shp.zip`);
      }
      setStatus({ kind: "ok", text: `${lines.length.toLocaleString("en-US")} contour lines downloaded.` });
    } catch (err) {
      setStatus({ kind: "error", text: (err as Error).message });
    }
  };

  const upload = async (files: File[]) => {
    if (!files.length) return;
    try {
      setStatus({ kind: "busy", text: "Reading the file…" });
      const parsed = await parseContourUpload(files, area.ring);
      let lines = parsed.lines ?? [];
      if (parsed.grid) {
        lines = await gridToContours(parsed.grid, interval, (done, total) =>
          setStatus({ kind: "busy", text: `Drawing contours… ${done}/${total}` }),
        );
      }
      const inside = clipLinesToRing(lines, area.ring);
      if (!inside.length) throw new Error("None of the lines in this file are inside the area. Check that the file covers it.");

      // ~0.5 m first; very detailed files are thinned further to fit
      let tidy = tidyLines(inside, 0.000005);
      let data = toSaved(tidy);
      for (const tolerance of [0.00002, 0.00006]) {
        if (vertexCount(tidy) <= MAX_SAVED_VERTICES && JSON.stringify(data).length <= MAX_SAVED_BYTES) break;
        tidy = tidyLines(inside, tolerance);
        data = toSaved(tidy);
      }
      if (JSON.stringify(data).length > MAX_SAVED_BYTES) {
        throw new Error("These contours are too detailed to save for this area. Use a larger interval or a smaller area.");
      }

      setStatus({ kind: "busy", text: "Saving…" });
      const { min, max } = elevationRange(tidy);
      await saveContours({
        areaId: area.id,
        sourceName: parsed.name,
        sourceFormat: parsed.format,
        intervalM: parsed.grid ? interval : guessInterval(tidy),
        minElevation: min,
        maxElevation: max,
        data,
      });
      const noHeights = min === null ? " The file has no elevations, so the lines have no labels." : "";
      setStatus({ kind: "ok", text: `${tidy.length.toLocaleString("en-US")} contour lines saved and shown on the map.${noHeights}` });
    } catch (err) {
      setStatus({ kind: "error", text: (err as Error).message });
    } finally {
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  const remove = async () => {
    try {
      setStatus({ kind: "busy", text: "Removing…" });
      await removeContours(area.id);
      setSource("srtm");
      setConfirmRemove(false);
      setStatus(null);
    } catch (err) {
      setStatus({ kind: "error", text: (err as Error).message });
    }
  };

  const toggleShown = async () => {
    if (shown) return hideContours(area.id);
    try {
      await showContours(area.id);
    } catch (err) {
      setStatus({ kind: "error", text: (err as Error).message });
    }
  };

  return (
    <div className="rounded-lg bg-sand-50 border border-sand-200 p-2.5 space-y-2.5 text-[11px] text-sand-700">
      {/* Download */}
      <div className="space-y-1.5">
        <div className="text-[10px] font-bold uppercase tracking-wider text-sand-600">Download contours</div>
        {meta && (
          <div className="flex gap-1" role="group" aria-label="Contour source">
            <button onClick={() => setSource("srtm")} aria-pressed={!useUpload} className={chip(!useUpload)}>
              SRTM elevation
            </button>
            <button onClick={() => setSource("upload")} aria-pressed={useUpload} className={chip(useUpload)}>
              Uploaded file
            </button>
          </div>
        )}
        {!useUpload && (
          <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Contour interval">
            <span className="mr-0.5">Every</span>
            {CONTOUR_INTERVALS.map((v) => (
              <button key={v} onClick={() => pickInterval(v)} aria-pressed={interval === v} className={chip(interval === v)}>
                {v} m
              </button>
            ))}
          </div>
        )}
        <div className="flex flex-wrap gap-1">
          {CONTOUR_FORMATS.map((f) => {
            const off = busy || (useUpload && f.id === "geotiff");
            return (
              <button
                key={f.id}
                onClick={() => download(f.id)}
                disabled={off}
                title={useUpload && f.id === "geotiff" ? "GeoTIFF is the elevation grid, made from SRTM only" : `Download ${f.label}`}
                className="cursor-pointer flex items-center gap-1 px-2 py-1 rounded-lg bg-white border border-sand-200 hover:border-gold-300 text-ink text-[10px] font-bold disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Download size={11} /> {f.label}
              </button>
            );
          })}
        </div>
        <p className="text-[10px] text-sand-500 leading-snug">
          {useUpload
            ? "The contours you uploaded, as saved for this area."
            : "From SRTM elevation data (about 30 m), cut to this area. GeoTIFF is the elevation grid itself (DEM). Accuracy follows the data, not a field survey."}
        </p>
      </div>

      {/* Upload */}
      <div className="space-y-1.5 pt-2 border-t border-sand-200">
        <div className="text-[10px] font-bold uppercase tracking-wider text-sand-600">Your contours</div>
        {meta ? (
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <div className="font-bold text-ink truncate" title={meta.sourceName}>{meta.sourceName}</div>
              <div className="text-[10px] text-sand-500">
                {meta.lineCount.toLocaleString("en-US")} lines
                {meta.minElevation !== null && meta.maxElevation !== null && ` · ${metres(meta.minElevation)}–${metres(meta.maxElevation)}`}
                {meta.intervalM !== null && ` · every ${meta.intervalM} m`}
              </div>
            </div>
            <button
              onClick={toggleShown}
              aria-pressed={shown}
              className="cursor-pointer shrink-0 p-1.5 rounded-lg bg-white border border-sand-200 hover:border-gold-300 text-ink"
              title={shown ? "Hide on map" : "Show on map"}
              aria-label={shown ? "Hide contours on map" : "Show contours on map"}
            >
              {shown ? <Eye size={12} /> : <EyeOff size={12} />}
            </button>
            {confirmRemove ? (
              <span className="shrink-0 flex items-center gap-1 text-[10px] text-brick-600">
                Remove?
                <button onClick={remove} disabled={busy} className="cursor-pointer px-2 py-1 rounded-lg bg-brick-600 text-white font-bold">
                  Yes
                </button>
                <button onClick={() => setConfirmRemove(false)} className="cursor-pointer px-2 py-1 rounded-lg bg-sand-100 text-sand-700 font-bold">
                  No
                </button>
              </span>
            ) : (
              <button
                onClick={() => setConfirmRemove(true)}
                className="cursor-pointer shrink-0 p-1.5 rounded-lg hover:bg-brick-50 text-brick-600"
                title="Remove uploaded contours"
                aria-label="Remove uploaded contours"
              >
                <Trash2 size={12} />
              </button>
            )}
          </div>
        ) : null}
        <input
          ref={fileInput}
          type="file"
          multiple
          accept={UPLOAD_ACCEPT}
          className="hidden"
          aria-label="Contour file"
          onChange={(e) => upload(Array.from(e.target.files ?? []))}
        />
        <button
          onClick={() => fileInput.current?.click()}
          disabled={busy}
          className="cursor-pointer w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-forest-800 hover:bg-forest-700 text-white text-[11px] font-bold disabled:opacity-50"
        >
          <Upload size={12} /> {meta ? "Replace with another file" : "Upload contours"}
        </button>
        <p className="text-[10px] text-sand-500 leading-snug">
          SHP (.zip, or .shp + .dbf + .prj together), GeoTIFF DEM (made into contours every {interval} m), GeoJSON, KML or
          KMZ. Lines outside the area are cut off.
        </p>
      </div>

      {status && (
        <div
          role={status.kind === "error" ? "alert" : "status"}
          className={`flex items-start gap-1.5 text-[10px] font-bold ${
            status.kind === "error" ? "text-brick-600" : status.kind === "ok" ? "text-forest-700" : "text-sand-600"
          }`}
        >
          {busy && <Loader2 size={11} className="animate-spin shrink-0 mt-px" />}
          <span>{status.text}</span>
        </div>
      )}
    </div>
  );
};
