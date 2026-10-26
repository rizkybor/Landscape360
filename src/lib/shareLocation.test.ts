import { describe, it, expect, vi } from 'vitest';
import { buildPlaceShareText, buildShareLocationText, parsePlaceToken, parseSharedPoint, placeLinkUrl, sharedLocationUrl, whatsappShareUrl } from './shareLocation';

describe('shareLocation', () => {
  it('makes a link that opens the map at the point, and reads it back', () => {
    const url = sharedLocationUrl(-6.789912, 106.983201);
    expect(url).toBe('https://landscape360.jcdigital.co.id/?at=-6.78991,106.98320');
    expect(parseSharedPoint(new URL(url).search)).toEqual({ lat: -6.78991, lng: 106.9832 });
  });

  it('ignores missing or invalid points', () => {
    expect(parseSharedPoint('')).toBeNull();
    expect(parseSharedPoint('?at=abc')).toBeNull();
    expect(parseSharedPoint('?at=95,10')).toBeNull();
    expect(parseSharedPoint('?at=10,200')).toBeNull();
  });

  it('writes a chat message with DMS, decimal, elevation and both links', () => {
    vi.useFakeTimers().setSystemTime(new Date(2026, 9, 26, 8, 5));
    const text = buildShareLocationText(
      { lat: -6.78991, lng: 106.9832, elevation: 2958.4, accuracy: 6.2, time: Date.now() },
      'Budi',
    );
    vi.useRealTimers();
    expect(text).toContain("📍 Lokasi Budi / Budi's location");
    expect(text).toContain(`6°47'23.68" S 106°58'59.52" E`);
    expect(text).toContain('-6.78991, 106.98320');
    expect(text).toContain('2958 mdpl · ±6 m · 26/10 08:05');
    expect(text).toContain('https://maps.google.com/?q=-6.78991,106.98320');
    expect(text).toContain('Landscape 360: https://landscape360.jcdigital.co.id/?at=-6.78991,106.98320');
    expect(whatsappShareUrl(text)).toMatch(/^https:\/\/wa\.me\/\?text=%F0%9F%93%8D/);
  });

  it('marked location links: only a 32-character token is accepted', () => {
    const token = '0123456789abcdef0123456789abcdef';
    expect(parsePlaceToken(new URL(placeLinkUrl(token)).search)).toBe(token);
    expect(parsePlaceToken('?place=short')).toBeNull();
    expect(parsePlaceToken('?place=0123456789ABCDEF0123456789abcdef')).toBeNull();
    expect(parsePlaceToken('')).toBeNull();
  });

  it('writes the message for a shared marked location', () => {
    const text = buildPlaceShareText(
      { name: 'Pos 3 Gunung Gede', categoryLabel: 'Shelter / Pos', lat: -6.78991, lng: 106.9832, elevationM: 2412.6 },
      'https://landscape360.jcdigital.co.id/?place=abc',
    );
    expect(text).toBe(
      `📍 Pos 3 Gunung Gede (Shelter / Pos)\n6°47'23.68" S 106°58'59.52" E\n2413 mdpl\nOpen on Landscape 360 (no sign-in needed): https://landscape360.jcdigital.co.id/?place=abc`,
    );
  });
});
