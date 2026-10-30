// Every desa / kelurahan with its Kemendagri code (BMKG's ADM4) and the centre of its boundary
// (public/data/villages.tsv.gz, the same file as the mobile app's, built by its
// tool/wilayah/build_villages.py from Badan Informasi Geospasial data). The nearest village is
// found in the browser, so only its code, never the user's position, goes to BMKG.
// Port of lib/domain/weather/villages.dart (Landscape 360 Mobile App).

export interface Village {
  code: string; // e.g. 31.74.07.1010
  name: string; // Cipete Utara
  kecamatan: string; // Kebayoran Baru
  kabKota: string; // Kota Adm. Jakarta Selatan
  lat: number;
  lng: number;
}

/** Reads the TSV (header: code, desa, kecamatan, kabkota, lat, lon); bad lines are skipped */
export const parseVillagesTsv = (tsv: string): Village[] => {
  const villages: Village[] = [];
  const lines = tsv.split('\n');
  for (let i = 1; i < lines.length; i++) {
    const f = lines[i].split('\t');
    if (f.length < 6) continue;
    const lat = Number(f[4]);
    const lng = Number(f[5]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || f[0].split('.').length !== 4) continue;
    villages.push({ code: f[0], name: f[1], kecamatan: f[2], kabKota: f[3], lat, lng });
  }
  return villages;
};

const CELL_DEG = 0.1;
const key = (row: number, col: number) => row * 10000 + col;

/** Approximate distance in km (equirectangular; fine at village scale) */
export const distanceKm = (lat1: number, lng1: number, lat2: number, lng2: number) => {
  const x = (((lng2 - lng1) * Math.PI) / 180) * Math.cos((((lat1 + lat2) / 2) * Math.PI) / 180);
  const y = ((lat2 - lat1) * Math.PI) / 180;
  return Math.sqrt(x * x + y * y) * 6371;
};

/** Nearest-village lookup over a grid of 0.1° cells */
export class VillageIndex {
  private cells = new Map<number, number[]>();
  private all: Village[];
  constructor(all: Village[]) {
    this.all = all;
    all.forEach((v, i) => {
      const k = key(Math.floor((v.lat + 90) / CELL_DEG), Math.floor((v.lng + 180) / CELL_DEG));
      const list = this.cells.get(k);
      if (list) list.push(i);
      else this.cells.set(k, [i]);
    });
  }

  get length() {
    return this.all.length;
  }

  /** Up to `count` villages nearest to the point, within `maxKm`; nearest first */
  nearest(lat: number, lng: number, count = 3, maxKm = 30): Village[] {
    const row = Math.floor((lat + 90) / CELL_DEG);
    const col = Math.floor((lng + 180) / CELL_DEG);
    const found: [number, Village][] = [];
    // Grow the search ring by ring until enough villages are found (or the limit is passed)
    const maxRing = Math.ceil(maxKm / 11) + 1;
    for (let ring = 0; ring <= maxRing; ring++) {
      for (let dr = -ring; dr <= ring; dr++) {
        for (let dc = -ring; dc <= ring; dc++) {
          if (Math.abs(dr) !== ring && Math.abs(dc) !== ring) continue; // only the new outer ring
          for (const i of this.cells.get(key(row + dr, col + dc)) ?? []) {
            const v = this.all[i];
            const d = distanceKm(lat, lng, v.lat, v.lng);
            if (d <= maxKm) found.push([d, v]);
          }
        }
      }
      // Anything outside this ring is at least ring * ~11 km away
      if (found.length >= count && ring >= 1) {
        found.sort((a, b) => a[0] - b[0]);
        if (found[count - 1][0] <= ring * CELL_DEG * 111 * Math.cos((lat * Math.PI) / 180)) break;
      }
    }
    found.sort((a, b) => a[0] - b[0]);
    return found.slice(0, count).map(([, v]) => v);
  }
}

const VILLAGES_URL = '/data/villages.tsv.gz';
let loading: Promise<VillageIndex> | null = null;

/**
 * The villages, downloaded once (about 1.4 MB) when the weather first needs them. The file is
 * gzip; a server that already unpacked it (Content-Encoding) is handled too.
 */
export const loadVillageIndex = () => {
  loading ??= (async () => {
    const res = await fetch(VILLAGES_URL);
    if (!res.ok) throw new Error(`Villages: ${res.status}`);
    const bytes = new Uint8Array(await res.arrayBuffer());
    const gzipped = bytes[0] === 0x1f && bytes[1] === 0x8b;
    let text: string;
    if (gzipped) {
      const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
      text = await new Response(stream).text();
    } else {
      text = new TextDecoder().decode(bytes);
    }
    return new VillageIndex(parseVillagesTsv(text));
  })();
  // Try again next time after a failure
  loading.catch(() => {
    loading = null;
  });
  return loading;
};
