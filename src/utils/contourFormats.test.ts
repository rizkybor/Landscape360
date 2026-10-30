import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import { fromArrayBuffer } from 'geotiff';
import {
  DEM_NODATA,
  buildShapefile,
  fileBase,
  parseContourUpload,
  parseGeoJSON,
  parseKML,
  toGeoJSON,
  toGeoTiff,
  toKML,
} from './contourFormats';
import type { ContourLine } from './contourGeo';
import type { LngLat } from '../types/markedArea';

// jsdom's Blob has no arrayBuffer() / text(); browsers do
for (const method of ['arrayBuffer', 'text'] as const) {
  if (!Blob.prototype[method]) {
    Object.defineProperty(Blob.prototype, method, {
      value(this: Blob) {
        return new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          if (method === 'text') reader.readAsText(this);
          else reader.readAsArrayBuffer(this);
        });
      },
    });
  }
}

const lines: ContourLine[] = [
  { elevation: 1000, coords: [[106.98, -6.78], [106.99, -6.77]] },
  { elevation: 1025, coords: [[106.981, -6.781], [106.982, -6.78], [106.983, -6.779]] },
];
const info = { name: 'Gede & "Pangrango"', interval: 25, source: 'SRTM' };
const ring: LngLat[] = [
  [106.9, -6.9],
  [107.1, -6.9],
  [107.1, -6.7],
  [106.9, -6.7],
];

const file = (name: string, data: BlobPart | Uint8Array) => new File([data as BlobPart], name);

describe('contour downloads', () => {
  it('names files after the area', () => {
    expect(fileBase('Camp ground: Surya Kencana!')).toBe('Camp_ground_Surya_Kencana_contours');
    expect(fileBase('  ')).toBe('area_contours');
  });

  it('writes GeoJSON with elevation and line type', () => {
    const fc = toGeoJSON(lines, info);
    expect(fc.features).toHaveLength(2);
    expect(fc.features[0].properties).toEqual({ elevation: 1000, type: 'index' });
    expect(fc.features[1].properties).toEqual({ elevation: 1025, type: 'intermediate' });
    expect(parseGeoJSON(JSON.stringify(fc))).toEqual(lines);
  });

  it('writes KML that reads back, with the name escaped', () => {
    const kml = toKML(lines, info);
    expect(kml).toContain('<name>Gede &amp; &quot;Pangrango&quot;</name>');
    expect(parseKML(kml)).toEqual(lines);
  });

  it('writes a Shapefile that reads back (shp + dbf + prj)', async () => {
    const shp = buildShapefile(lines, 25);
    const zip = new JSZip();
    zip.file('c.shp', shp.shp);
    zip.file('c.shx', shp.shx);
    zip.file('c.dbf', shp.dbf);
    zip.file('c.prj', shp.prj);
    const blob = await zip.generateAsync({ type: uint8() });
    const parsed = await parseContourUpload([file('c.zip', blob)], ring);
    expect(parsed.format).toBe('shp');
    expect(parsed.lines).toEqual(lines);
  });

  it('writes a georeferenced Float32 GeoTIFF with NoData outside the area', async () => {
    const values = Float32Array.from([1, 2, 3, 4, 5, 6]);
    const blob = await toGeoTiff(
      { width: 3, height: 2, values, west: 106.9, north: -6.7, resX: 0.1, resY: 0.1 },
      ([lng]) => lng < 107.1,
    );
    const tiff = await fromArrayBuffer(await blob.arrayBuffer());
    const image = await tiff.getImage();
    expect(image.getOrigin().slice(0, 2)).toEqual([106.9, -6.7]);
    expect(image.getResolution().slice(0, 2)).toEqual([0.1, -0.1]);
    expect(image.getGDALNoData()).toBe(DEM_NODATA);
    expect(image.getGeoKeys()?.GeographicTypeGeoKey).toBe(4326);
    const [band] = (await image.readRasters()) as unknown as Float32Array[];
    expect(Array.from(band)).toEqual([1, 2, DEM_NODATA, 4, 5, DEM_NODATA]);
  });
});

describe('contour uploads', () => {
  it('reads loose Shapefile parts in a projected system (UTM 48S) into WGS84', async () => {
    // One line in UTM zone 48S, no .dbf: the elevation comes from nowhere, so it is null
    const utm: ContourLine[] = [{ elevation: null, coords: [[718000, 9250000], [718100, 9250100]] }];
    const shp = buildShapefile(utm, null);
    const prj =
      'PROJCS["WGS_1984_UTM_Zone_48S",GEOGCS["GCS_WGS_1984",DATUM["D_WGS_1984",SPHEROID["WGS_1984",6378137.0,298.257223563]],PRIMEM["Greenwich",0.0],UNIT["Degree",0.0174532925199433]],PROJECTION["Transverse_Mercator"],PARAMETER["False_Easting",500000.0],PARAMETER["False_Northing",10000000.0],PARAMETER["Central_Meridian",105.0],PARAMETER["Scale_Factor",0.9996],PARAMETER["Latitude_Of_Origin",0.0],UNIT["Meter",1.0]]';
    const parsed = await parseContourUpload([file('a.shp', shp.shp), file('a.prj', prj)], ring);
    const [[lng, lat]] = parsed.lines![0].coords;
    expect(lng).toBeCloseTo(106.98, 1);
    expect(lat).toBeCloseTo(-6.78, 1);
  });

  it('asks for the .prj when projected coordinates come without one', async () => {
    const shp = buildShapefile([{ elevation: 5, coords: [[718000, 9250000], [718100, 9250100]] }], null);
    await expect(parseContourUpload([file('a.shp', shp.shp)], ring)).rejects.toThrow(/\.prj/);
  });

  it('reads KMZ and rejects other files', async () => {
    const zip = new JSZip();
    zip.file('doc.kml', toKML(lines, info));
    const kmz = await zip.generateAsync({ type: uint8() });
    expect((await parseContourUpload([file('c.kmz', kmz)], ring)).lines).toEqual(lines);
    await expect(parseContourUpload([file('c.dxf', 'x')], ring)).rejects.toThrow(/Unsupported/);
  });

  it('reads a GeoTIFF DEM as a grid around the area', async () => {
    const width = 40;
    const values = new Float32Array(width * width).map((_, i) => 1000 + (i % width));
    const blob = await toGeoTiff(
      { width, height: width, values, west: 106.8, north: -6.6, resX: 0.01, resY: 0.01 },
      () => true,
    );
    const parsed = await parseContourUpload([file('dem.tif', await blob.arrayBuffer())], ring);
    expect(parsed.format).toBe('geotiff');
    const grid = parsed.grid!;
    // The area spans 20 x 20 cells; plus 3 cells of padding on each side
    expect(grid.width).toBe(26);
    expect(grid.height).toBe(26);
    const [lng, lat] = grid.toLngLat(3, 3);
    expect(lng).toBeCloseTo(106.9, 6);
    expect(lat).toBeCloseTo(-6.7, 6);
  });
});

// jsdom's Blob is not read by JSZip; a Uint8Array is
function uint8() {
  return 'uint8array' as const;
}
