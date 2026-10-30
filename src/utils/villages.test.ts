import { describe, it, expect } from 'vitest';
import { VillageIndex, distanceKm, parseVillagesTsv } from './villages';

const TSV = [
  'code\tdesa\tkecamatan\tkabkota\tlat\tlon',
  '31.71.03.1001\tKemayoran\tKemayoran\tKota Adm. Jakarta Pusat\t-6.16217\t106.84442',
  '32.03.21.2001\tCibodas\tPacet\tCianjur\t-6.73890\t107.00250',
  '32.03.21.2002\tCiputri\tPacet\tCianjur\t-6.75120\t107.01980',
  'bad line',
  '32.01.01.2001\tNoCoords\tX\tY\tabc\t107',
].join('\n');

describe('villages', () => {
  it('reads the TSV and skips bad lines', () => {
    const v = parseVillagesTsv(TSV);
    expect(v.map((x) => x.code)).toEqual(['31.71.03.1001', '32.03.21.2001', '32.03.21.2002']);
    expect(v[1]).toMatchObject({ name: 'Cibodas', kecamatan: 'Pacet', kabKota: 'Cianjur' });
  });

  it('finds the nearest villages, nearest first, within the limit', () => {
    const index = new VillageIndex(parseVillagesTsv(TSV));
    // Near Gunung Gede's Cibodas gate
    // Kemayoran is ~70 km away, past the 30 km limit
    expect(index.nearest(-6.742, 107.005).map((v) => v.name)).toEqual(['Cibodas', 'Ciputri']);
    expect(index.nearest(-6.742, 107.005, 1)[0].name).toBe('Cibodas');
    // Out at sea, far from all of them
    expect(index.nearest(-10, 100)).toEqual([]);
  });

  it('measures distance in km', () => {
    expect(distanceKm(-6.2, 106.8, -6.2, 106.9)).toBeCloseTo(11.05, 1);
  });
});
