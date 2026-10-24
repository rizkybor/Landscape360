import { describe, it, expect, vi } from 'vitest';
import { BUNDLED_POIS, guessCategory, poiInputError, toMapLocation, type PoiInput } from './pointsOfInterest';

vi.mock('./supabaseClient', () => ({ supabase: {} }));

const valid: PoiInput = { name: 'Gunung Gede', subtitle: '2.958 mdpl', description: null, category: 'mountain', lat: -6.78991, lng: 106.9832, isPublished: true };

describe('points of interest', () => {
  it('converts a point to the shape the map popup and search use', () => {
    const loc = toMapLocation({ ...valid, id: 'a', updatedAt: null, description: 'Via Cibodas' });
    expect(loc).toEqual({
      id: 'a',
      text: '2.958 mdpl',
      place_name: 'Gunung Gede',
      center: [106.9832, -6.78991],
      place_type: ['poi', 'mountain', 'custom'],
      type: 'Feature',
      properties: { wikidata: 'Via Cibodas' },
    });
    // Water sources stay out of search, as before
    expect(toMapLocation({ ...valid, id: 'w', updatedAt: null, category: 'water' }).type).toBe('Water');
  });

  it('guesses the category of the bundled points like the migration seed', () => {
    expect(guessCategory('Gunung Pangrango (TNGGP)')).toBe('mountain');
    expect(guessCategory('BC Gunung Lembu via Sukatani')).toBe('basecamp');
    expect(guessCategory('Mata Air Surya Kencana')).toBe('water');
    expect(guessCategory('Gua Ciasem')).toBe('cave');
    expect(guessCategory('Tebing Jeger')).toBe('cliff');
    expect(guessCategory('Sungai')).toBe('river');
    expect(guessCategory('Sekretariat Makopala')).toBe('poi');
  });

  it('keeps all 24 bundled points as the offline fallback', () => {
    expect(BUNDLED_POIS).toHaveLength(24);
    const counts = BUNDLED_POIS.reduce<Record<string, number>>((acc, p) => ({ ...acc, [p.category]: (acc[p.category] ?? 0) + 1 }), {});
    expect(counts).toEqual({ poi: 1, basecamp: 6, mountain: 8, water: 3, river: 2, cliff: 2, cave: 2 });
  });

  it.each([
    [{ name: '  ' }, /Name is required/],
    [{ lat: -91 }, /Latitude/],
    [{ lng: Number.NaN }, /Longitude/],
    [{ subtitle: 'x'.repeat(121) }, /Subtitle/],
  ])('rejects %o', (change, message) => {
    expect(poiInputError({ ...valid, ...change })).toMatch(message);
  });

  it('accepts a valid point', () => {
    expect(poiInputError(valid)).toBeNull();
  });
});
