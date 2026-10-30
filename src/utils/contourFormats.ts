import type { Feature, FeatureCollection, Geometry, LineString, Position } from 'geojson';
import type { LngLat } from '../types/markedArea';
import { elevationFromProperties, isIndexLine, type ContourLine, type ElevationGrid } from './contourGeo';

// File formats for Marked Area contours.
// Download: Shapefile (.zip), GeoTIFF (the DEM), GeoJSON, KML, KMZ.
// Upload: the same, where a GeoTIFF is a DEM that is turned into contours.
// The zip, GeoTIFF and projection libraries are large, so they load on first use.

export type ContourFormat = 'shp' | 'geotiff' | 'geojson' | 'kml' | 'kmz';

export const CONTOUR_FORMATS: { id: ContourFormat; label: string; ext: string }[] = [
  { id: 'shp', label: 'SHP', ext: '.zip' },
  { id: 'geotiff', label: 'GeoTIFF', ext: '.tif' },
  { id: 'geojson', label: 'GeoJSON', ext: '.geojson' },
  { id: 'kml', label: 'KML', ext: '.kml' },
  { id: 'kmz', label: 'KMZ', ext: '.kmz' },
];

export const UPLOAD_ACCEPT = '.zip,.shp,.dbf,.prj,.shx,.cpg,.tif,.tiff,.geojson,.json,.kml,.kmz';

const WGS84_PRJ =
  'GEOGCS["GCS_WGS_1984",DATUM["D_WGS_1984",SPHEROID["WGS_1984",6378137.0,298.257223563]],PRIMEM["Greenwich",0.0],UNIT["Degree",0.0174532925199433]]';

export interface ContourExportInfo {
  name: string;
  interval: number | null;
  source: string;
}

const lineType = (elevation: number | null, interval: number | null) =>
  isIndexLine(elevation, interval) ? 'index' : 'intermediate';

/** Safe file name from an area name */
export const fileBase = (name: string) =>
  (name.trim().replace(/[^\w\- ]+/g, '').replace(/\s+/g, '_').slice(0, 60) || 'area') + '_contours';

// --- GeoJSON -------------------------------------------------------------------------------

export const toGeoJSON = (lines: ContourLine[], info: ContourExportInfo): FeatureCollection<LineString> => ({
  type: 'FeatureCollection',
  // Not part of RFC 7946, but kept by QGIS / ArcGIS and harmless elsewhere
  ...({ name: info.name, source: info.source } as object),
  features: lines.map((l) => ({
    type: 'Feature',
    properties: { elevation: l.elevation, type: lineType(l.elevation, info.interval) },
    geometry: { type: 'LineString', coordinates: l.coords },
  })),
});

// --- KML / KMZ -----------------------------------------------------------------------------

const xml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const toKML = (lines: ContourLine[], info: ContourExportInfo) => {
  const placemarks = lines
    .map((l) => {
      const type = lineType(l.elevation, info.interval);
      const z = l.elevation ?? 0;
      const coords = l.coords.map(([lng, lat]) => `${lng},${lat},${z}`).join(' ');
      return (
        `<Placemark><name>${l.elevation === null ? '' : `${l.elevation} m`}</name><styleUrl>#${type}</styleUrl>` +
        (l.elevation === null ? '' : `<ExtendedData><Data name="elevation"><value>${l.elevation}</value></Data></ExtendedData>`) +
        `<LineString><tessellate>1</tessellate><altitudeMode>clampToGround</altitudeMode><coordinates>${coords}</coordinates></LineString></Placemark>`
      );
    })
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
<Document>
<name>${xml(info.name)}</name>
<description>${xml(`Contours${info.interval ? ` every ${info.interval} m` : ''}. Elevation: ${info.source}. Made with Landscape 360.`)}</description>
<Style id="index"><LineStyle><color>ff229bd4</color><width>2.2</width></LineStyle></Style>
<Style id="intermediate"><LineStyle><color>b3229bd4</color><width>1</width></LineStyle></Style>
<Folder><name>Contours</name>
${placemarks}
</Folder>
</Document>
</kml>
`;
};

const loadZip = async () => (await import('jszip')).default;

export const toKMZ = async (lines: ContourLine[], info: ContourExportInfo): Promise<Blob> => {
  const JSZip = await loadZip();
  const zip = new JSZip();
  zip.file('doc.kml', toKML(lines, info));
  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE', mimeType: 'application/vnd.google-earth.kmz' });
};

// --- Shapefile -------------------------------------------------------------------------------
// PolyLine (type 3) in WGS84, attributes ELEV (metres) and TYPE (index / intermediate).

const bboxOf = (points: LngLat[]) => {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of points) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return points.length ? [minX, minY, maxX, maxY] : [0, 0, 0, 0];
};

const writeShpHeader = (view: DataView, lengthBytes: number, box: number[]) => {
  view.setInt32(0, 9994, false);
  view.setInt32(24, lengthBytes / 2, false);
  view.setInt32(28, 1000, true);
  view.setInt32(32, 3, true); // PolyLine
  box.forEach((v, i) => view.setFloat64(36 + i * 8, v, true));
};

export const buildShapefile = (lines: ContourLine[], interval: number | null) => {
  const contentSizes = lines.map((l) => 4 + 32 + 4 + 4 + 4 + l.coords.length * 16);
  const shpSize = 100 + contentSizes.reduce((n, c) => n + 8 + c, 0);
  const shp = new DataView(new ArrayBuffer(shpSize));
  const shx = new DataView(new ArrayBuffer(100 + lines.length * 8));
  const box = bboxOf(lines.flatMap((l) => l.coords));
  writeShpHeader(shp, shpSize, box);
  writeShpHeader(shx, 100 + lines.length * 8, box);

  let offset = 100;
  lines.forEach((l, i) => {
    shx.setInt32(100 + i * 8, offset / 2, false);
    shx.setInt32(104 + i * 8, contentSizes[i] / 2, false);
    shp.setInt32(offset, i + 1, false);
    shp.setInt32(offset + 4, contentSizes[i] / 2, false);
    let p = offset + 8;
    shp.setInt32(p, 3, true);
    bboxOf(l.coords).forEach((v, k) => shp.setFloat64(p + 4 + k * 8, v, true));
    shp.setInt32(p + 36, 1, true); // one part
    shp.setInt32(p + 40, l.coords.length, true);
    shp.setInt32(p + 44, 0, true);
    p += 48;
    for (const [x, y] of l.coords) {
      shp.setFloat64(p, x, true);
      shp.setFloat64(p + 8, y, true);
      p += 16;
    }
    offset += 8 + contentSizes[i];
  });

  // dBASE III table
  const fields: { name: string; type: 'N' | 'C'; length: number; decimals: number }[] = [
    { name: 'ELEV', type: 'N', length: 12, decimals: 2 },
    { name: 'TYPE', type: 'C', length: 12, decimals: 0 },
  ];
  const headerLength = 32 + fields.length * 32 + 1;
  const recordLength = 1 + fields.reduce((n, f) => n + f.length, 0);
  const dbf = new Uint8Array(headerLength + lines.length * recordLength + 1);
  const dv = new DataView(dbf.buffer);
  const now = new Date();
  dbf[0] = 0x03;
  dbf[1] = now.getFullYear() - 1900;
  dbf[2] = now.getMonth() + 1;
  dbf[3] = now.getDate();
  dv.setUint32(4, lines.length, true);
  dv.setUint16(8, headerLength, true);
  dv.setUint16(10, recordLength, true);
  fields.forEach((f, i) => {
    const at = 32 + i * 32;
    for (let k = 0; k < f.name.length; k++) dbf[at + k] = f.name.charCodeAt(k);
    dbf[at + 11] = f.type.charCodeAt(0);
    dbf[at + 16] = f.length;
    dbf[at + 17] = f.decimals;
  });
  dbf[headerLength - 1] = 0x0d;
  const put = (at: number, text: string) => {
    for (let k = 0; k < text.length; k++) dbf[at + k] = text.charCodeAt(k);
  };
  lines.forEach((l, i) => {
    const at = headerLength + i * recordLength;
    dbf[at] = 0x20;
    const elev = l.elevation === null ? '' : l.elevation.toFixed(2);
    put(at + 1, elev.padStart(12, ' ').slice(-12));
    put(at + 13, lineType(l.elevation, interval).padEnd(12, ' '));
  });
  dbf[dbf.length - 1] = 0x1a;

  return { shp: shp.buffer as ArrayBuffer, shx: shx.buffer as ArrayBuffer, dbf: dbf.buffer as ArrayBuffer, prj: WGS84_PRJ };
};

export const toShapefileZip = async (lines: ContourLine[], info: ContourExportInfo, base: string): Promise<Blob> => {
  const JSZip = await loadZip();
  const zip = new JSZip();
  const files = buildShapefile(lines, info.interval);
  zip.file(`${base}.shp`, files.shp);
  zip.file(`${base}.shx`, files.shx);
  zip.file(`${base}.dbf`, files.dbf);
  zip.file(`${base}.prj`, files.prj);
  zip.file(`${base}.cpg`, 'UTF-8');
  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
};

// --- GeoTIFF (the DEM) -------------------------------------------------------------------------

export const DEM_NODATA = -32768;

/** Float32 GeoTIFF in WGS84, cells outside the area set to NoData */
export const toGeoTiff = async (
  dem: { width: number; height: number; values: Float32Array; west: number; north: number; resX: number; resY: number },
  inside: (p: LngLat) => boolean,
): Promise<Blob> => {
  const { writeArrayBuffer } = await import('geotiff');
  const values = new Float32Array(dem.width * dem.height);
  for (let row = 0; row < dem.height; row++) {
    const lat = dem.north - (row + 0.5) * dem.resY;
    for (let col = 0; col < dem.width; col++) {
      const i = row * dem.width + col;
      const v = dem.values[i];
      values[i] = Number.isNaN(v) || !inside([dem.west + (col + 0.5) * dem.resX, lat]) ? DEM_NODATA : Math.round(v * 10) / 10;
    }
  }
  // Typed arrays are written as is (Float32, SampleFormat 3); the typings only list plain arrays
  const buffer = writeArrayBuffer(values as unknown as number[], {
    width: dem.width,
    height: dem.height,
    ModelPixelScale: [dem.resX, dem.resY, 0],
    ModelTiepoint: [0, 0, 0, dem.west, dem.north, 0],
    GTModelTypeGeoKey: 2, // geographic
    GTRasterTypeGeoKey: 1, // pixel is area
    GeographicTypeGeoKey: 4326,
    GeogCitationGeoKey: 'WGS 84',
    GDAL_NODATA: `${DEM_NODATA}`,
  } as Record<string, unknown>);
  return new Blob([buffer as ArrayBuffer], { type: 'image/tiff' });
};

// --- Reading uploads ---------------------------------------------------------------------------

export interface ParsedUpload {
  format: ContourFormat;
  name: string;
  /** Contour lines in WGS84 */
  lines?: ContourLine[];
  /** A DEM to turn into contours (GeoTIFF uploads) */
  grid?: ElevationGrid;
}

const extOf = (name: string) => name.toLowerCase().split('.').pop() ?? '';

// Lines (and polygon outlines) in any GeoJSON geometry, as coordinate lists
const geometryLines = (g: Geometry | null): Position[][] => {
  if (!g) return [];
  switch (g.type) {
    case 'LineString':
      return [g.coordinates];
    case 'MultiLineString':
    case 'Polygon':
      return g.coordinates;
    case 'MultiPolygon':
      return g.coordinates.flat();
    case 'GeometryCollection':
      return g.geometries.flatMap(geometryLines);
    default:
      return [];
  }
};

const toLines = (paths: Position[][], elevation: number | null): ContourLine[] =>
  paths
    .filter((p) => p.length >= 2)
    .map((p) => ({
      // Fall back to the height in the coordinates (x, y, z)
      elevation: elevation ?? (typeof p[0][2] === 'number' && p[0][2] !== 0 ? p[0][2] : null),
      coords: p.map((c) => [c[0], c[1]] as LngLat),
    }));

export const parseGeoJSON = (text: string): ContourLine[] => {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('This is not a valid GeoJSON file.');
  }
  const d = data as { type?: string; features?: Feature[]; geometry?: Geometry; properties?: Record<string, unknown> };
  const features: Feature[] =
    d.type === 'FeatureCollection' ? (d.features ?? []) : d.type === 'Feature' ? [d as Feature] : [{ type: 'Feature', properties: {}, geometry: d as Geometry }];
  return features.flatMap((f) => toLines(geometryLines(f.geometry), elevationFromProperties(f.properties)));
};

export const parseKML = (text: string): ContourLine[] => {
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length) throw new Error('This is not a valid KML file.');
  const lines: ContourLine[] = [];
  for (const pm of Array.from(doc.getElementsByTagName('Placemark'))) {
    const props: Record<string, unknown> = { name: pm.getElementsByTagName('name')[0]?.textContent ?? '' };
    for (const d of Array.from(pm.getElementsByTagName('Data'))) {
      props[d.getAttribute('name') ?? ''] = d.getElementsByTagName('value')[0]?.textContent ?? '';
    }
    for (const d of Array.from(pm.getElementsByTagName('SimpleData'))) {
      props[d.getAttribute('name') ?? ''] = d.textContent ?? '';
    }
    const paths: Position[][] = [];
    for (const tag of ['LineString', 'LinearRing']) {
      for (const el of Array.from(pm.getElementsByTagName(tag))) {
        const raw = el.getElementsByTagName('coordinates')[0]?.textContent ?? '';
        paths.push(
          raw
            .trim()
            .split(/\s+/)
            .map((t) => t.split(',').map(Number))
            .filter((c) => c.length >= 2 && Number.isFinite(c[0]) && Number.isFinite(c[1])),
        );
      }
    }
    lines.push(...toLines(paths, elevationFromProperties(props)));
  }
  return lines;
};

const parseKMZ = async (file: Blob): Promise<ContourLine[]> => {
  const JSZip = await loadZip();
  const zip = await JSZip.loadAsync(file);
  const kml = zip.file('doc.kml') ?? zip.file(/\.kml$/i)[0];
  if (!kml) throw new Error('The KMZ file has no KML inside.');
  return parseKML(await kml.async('string'));
};

// Shapefile parts: .shp (shapes), .dbf (attributes), .prj (coordinate system)
const readDbf = (buffer: ArrayBuffer): Record<string, unknown>[] => {
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  const count = view.getUint32(4, true);
  const headerLength = view.getUint16(8, true);
  const recordLength = view.getUint16(10, true);
  const fields: { name: string; length: number }[] = [];
  for (let at = 32; at + 32 <= headerLength && bytes[at] !== 0x0d; at += 32) {
    let name = '';
    for (let k = 0; k < 11 && bytes[at + k]; k++) name += String.fromCharCode(bytes[at + k]);
    fields.push({ name, length: bytes[at + 16] });
  }
  const decoder = new TextDecoder('latin1');
  const rows: Record<string, unknown>[] = [];
  for (let r = 0; r < count; r++) {
    let at = headerLength + r * recordLength + 1;
    const row: Record<string, unknown> = {};
    for (const f of fields) {
      row[f.name] = decoder.decode(bytes.subarray(at, at + f.length)).trim();
      at += f.length;
    }
    rows.push(row);
  }
  return rows;
};

const readShp = (buffer: ArrayBuffer): { paths: Position[][]; z: number | null }[] => {
  const view = new DataView(buffer);
  const shapes: { paths: Position[][]; z: number | null }[] = [];
  let at = 100;
  while (at + 12 <= buffer.byteLength) {
    const length = view.getInt32(at + 4, false) * 2;
    const p = at + 8;
    const type = view.getInt32(p, true);
    // PolyLine / Polygon, plain, Z and M
    if ([3, 5, 13, 15, 23, 25].includes(type)) {
      const numParts = view.getInt32(p + 36, true);
      const numPoints = view.getInt32(p + 40, true);
      const parts = Array.from({ length: numParts }, (_, i) => view.getInt32(p + 44 + i * 4, true));
      const pointsAt = p + 44 + numParts * 4;
      const points: Position[] = Array.from({ length: numPoints }, (_, i) => [
        view.getFloat64(pointsAt + i * 16, true),
        view.getFloat64(pointsAt + i * 16 + 8, true),
      ]);
      let z: number | null = null;
      if ((type === 13 || type === 15) && numPoints > 0) {
        z = view.getFloat64(pointsAt + numPoints * 16 + 16, true); // first Z after the Z range
      }
      const paths = parts.map((start, i) => points.slice(start, i + 1 < parts.length ? parts[i + 1] : numPoints));
      shapes.push({ paths, z });
    } else {
      shapes.push({ paths: [], z: null });
    }
    at = p + length;
  }
  return shapes;
};

const loadProj4 = async () => {
  const { default: proj4 } = await import('proj4');
  proj4.defs('EPSG:4326', '+proj=longlat +datum=WGS84 +no_defs');
  return proj4;
};

const looksLikeLngLat = (lines: ContourLine[]) =>
  lines.every((l) => l.coords.every(([x, y]) => Math.abs(x) <= 180 && Math.abs(y) <= 90));

const reprojectLines = async (lines: ContourLine[], from: string): Promise<ContourLine[]> => {
  const proj4 = await loadProj4();
  let convert: (c: LngLat) => LngLat;
  try {
    const projection = proj4(from, 'EPSG:4326');
    convert = (c) => projection.forward(c) as LngLat;
  } catch {
    throw new Error('Could not read the coordinate system (.prj) of the Shapefile.');
  }
  return lines.map((l) => ({ ...l, coords: l.coords.map(convert) }));
};

const parseShapefile = async (files: { name: string; data: ArrayBuffer | string }[]): Promise<ContourLine[]> => {
  const find = (ext: string) => files.find((f) => extOf(f.name) === ext);
  const shp = find('shp');
  if (!shp || typeof shp.data === 'string') throw new Error('The .shp file is missing. Upload a .zip with the Shapefile, or the .shp, .dbf and .prj files together.');
  const dbf = find('dbf');
  const prj = find('prj');
  const rows = dbf && typeof dbf.data !== 'string' ? readDbf(dbf.data) : [];
  const lines = readShp(shp.data).flatMap((s, i) => toLines(s.paths, elevationFromProperties(rows[i]) ?? s.z));
  if (prj) {
    const wkt = typeof prj.data === 'string' ? prj.data : new TextDecoder().decode(prj.data);
    // Plain WGS84 needs no conversion
    if (/PROJCS|PROJCRS/i.test(wkt) || !/WGS[_ ]?(19)?84/i.test(wkt)) return reprojectLines(lines, wkt);
    return lines;
  }
  if (!looksLikeLngLat(lines)) {
    throw new Error('The Shapefile has no .prj file, so its coordinate system is unknown. Include the .prj file.');
  }
  return lines;
};

// GeoTIFF DEM: read only the window around the area, in the file's own coordinate system
const parseDemGeoTiff = async (file: Blob, ring: LngLat[]): Promise<ElevationGrid> => {
  const [GeoTIFF, proj4, { default: toProj4 }] = await Promise.all([
    import('geotiff'),
    loadProj4(),
    import('geotiff-geokeys-to-proj4'),
  ]);
  const tiff = await GeoTIFF.fromArrayBuffer(await file.arrayBuffer());
  const image = await tiff.getImage();
  const [originX, originY] = image.getOrigin();
  const [resX, resY] = image.getResolution(); // resY is negative for north-up files
  let crs = 'EPSG:4326';
  try {
    // @ts-expect-error the converter's key type does not match geotiff's
    const p = toProj4.toProj4(image.getGeoKeys());
    if (p?.proj4 && !p.proj4.includes('longlat')) crs = p.proj4;
  } catch {
    // No geo keys: treat as WGS84 and let the bounds check below catch a mismatch
  }
  const projection = proj4('EPSG:4326', crs);
  const toPixel = ([lng, lat]: LngLat) => {
    const [x, y] = projection.forward([lng, lat]);
    return [(x - originX) / resX, (y - originY) / resY];
  };
  const pixels = ring.map(toPixel);
  const pad = 3;
  // Tolerate float noise, so 30.000000000000004 is pixel 30, not 31
  const floor = (v: number) => Math.floor(v + 1e-6);
  const ceil = (v: number) => Math.ceil(v - 1e-6);
  const left = Math.max(0, floor(Math.min(...pixels.map((p) => p[0]))) - pad);
  const top = Math.max(0, floor(Math.min(...pixels.map((p) => p[1]))) - pad);
  const right = Math.min(image.getWidth(), ceil(Math.max(...pixels.map((p) => p[0]))) + pad);
  const bottom = Math.min(image.getHeight(), ceil(Math.max(...pixels.map((p) => p[1]))) + pad);
  if (right - left < 2 || bottom - top < 2) throw new Error('This GeoTIFF does not cover the area.');

  // Large windows are read at a lower resolution
  const scale = Math.min(1, Math.sqrt((1600 * 1600) / ((right - left) * (bottom - top))));
  const width = Math.max(2, Math.round((right - left) * scale));
  const height = Math.max(2, Math.round((bottom - top) * scale));
  const [band] = (await image.readRasters({ window: [left, top, right, bottom], width, height, samples: [0] })) as unknown as ArrayLike<number>[];
  const noData = image.getGDALNoData();
  const values = new Float32Array(width * height);
  for (let i = 0; i < values.length; i++) {
    const v = band[i];
    // NoData, plus the usual void values (SRTM -32768, float min) seen in files without the tag
    values[i] = v === noData || v <= -10000 || !Number.isFinite(v) ? NaN : v;
  }

  const back = proj4(crs, 'EPSG:4326');
  const stepX = (right - left) / width;
  const stepY = (bottom - top) / height;
  return {
    width,
    height,
    values,
    toLngLat: (x, y) => back.forward([originX + (left + x * stepX) * resX, originY + (top + y * stepY) * resY]) as LngLat,
  };
};

/** Reads the chosen files: one GeoJSON / KML / KMZ / GeoTIFF / zipped Shapefile, or loose Shapefile parts */
export const parseContourUpload = async (files: File[], ring: LngLat[]): Promise<ParsedUpload> => {
  if (!files.length) throw new Error('Choose a file.');
  const main = files.find((f) => extOf(f.name) === 'shp') ?? files[0];
  const ext = extOf(main.name);
  const name = main.name;
  switch (ext) {
    case 'geojson':
    case 'json':
      return { format: 'geojson', name, lines: parseGeoJSON(await main.text()) };
    case 'kml':
      return { format: 'kml', name, lines: parseKML(await main.text()) };
    case 'kmz':
      return { format: 'kmz', name, lines: await parseKMZ(main) };
    case 'tif':
    case 'tiff':
      return { format: 'geotiff', name, grid: await parseDemGeoTiff(main, ring) };
    case 'zip': {
      const JSZip = await loadZip();
      const zip = await JSZip.loadAsync(main);
      const entries = Object.values(zip.files).filter((e) => !e.dir && !e.name.startsWith('__MACOSX'));
      const kml = entries.find((e) => extOf(e.name) === 'kml');
      if (!entries.some((e) => extOf(e.name) === 'shp') && kml) {
        return { format: 'kmz', name, lines: parseKML(await kml.async('string')) };
      }
      const parts = await Promise.all(
        entries
          .filter((e) => ['shp', 'dbf', 'prj'].includes(extOf(e.name)))
          .map(async (e) => ({ name: e.name, data: await e.async('arraybuffer') })),
      );
      return { format: 'shp', name, lines: await parseShapefile(parts) };
    }
    case 'shp':
    case 'dbf':
    case 'prj':
    case 'shx':
    case 'cpg':
      return {
        format: 'shp',
        name,
        lines: await parseShapefile(await Promise.all(files.map(async (f) => ({ name: f.name, data: await f.arrayBuffer() })))),
      };
    default:
      throw new Error('Unsupported file. Use SHP (.zip or .shp + .dbf + .prj), GeoTIFF, GeoJSON, KML or KMZ.');
  }
};

/** Starts a download of the blob in the browser */
export const saveBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
