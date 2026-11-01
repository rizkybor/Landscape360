import { describe, expect, it, vi } from 'vitest';

vi.mock('./supabaseClient', () => ({ supabase: {} }));

import {
  attachmentCoords,
  canEdit,
  contactHref,
  exportItem,
  itemFileName,
  joinUrl,
  parseJoinParam,
  placeAttachment,
  classicAttachment,
  isEmail,
  isOldReport,
  parsePostParam,
  postInputError,
  postUrl,
  thinLine,
  trackAttachment,
} from './community';
import type { LngLat } from '../types/markedArea';

const today = () => new Date().toISOString().slice(0, 10);
const daysAgo = (n: number) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
const input = { kind: 'report' as const, body: 'Becek setelah pos 2', title: '', conditions: ['muddy'], happenedOn: today(), lat: -6.7 };

describe('community rules', () => {
  it('marks trail reports over 30 days old, never stories', () => {
    expect(isOldReport({ kind: 'report', happenedOn: daysAgo(31) })).toBe(true);
    expect(isOldReport({ kind: 'report', happenedOn: daysAgo(2) })).toBe(false);
    expect(isOldReport({ kind: 'story', happenedOn: daysAgo(200) })).toBe(false);
  });

  it('lets only the author edit, for 24 hours', () => {
    const now = Date.now();
    expect(canEdit({ isMine: true, createdAt: now - 3600000 }, now)).toBe(true);
    expect(canEdit({ isMine: true, createdAt: now - 25 * 3600000 }, now)).toBe(false);
    expect(canEdit({ isMine: false, createdAt: now }, now)).toBe(false);
  });

  it('checks a post before it is sent', () => {
    expect(postInputError(input)).toBeNull();
    expect(postInputError({ ...input, body: '  ' })).toMatch(/Write something/);
    expect(postInputError({ ...input, body: 'x'.repeat(501) })).toMatch(/at most 500/);
    expect(postInputError({ ...input, kind: 'story', body: 'x'.repeat(501), conditions: [] })).toBeNull();
    expect(postInputError({ ...input, conditions: [] })).toMatch(/trail condition/);
    expect(postInputError({ ...input, conditions: ['a', 'b', 'c', 'd', 'e'] })).toMatch(/at most 4/);
    expect(postInputError({ ...input, lat: null })).toMatch(/on the map/);
    expect(postInputError({ ...input, happenedOn: daysAgo(-3) })).toMatch(/future/);
    expect(postInputError({ ...input, happenedOn: daysAgo(400) })).toMatch(/last year/);
  });
});

describe('community attachments', () => {
  it('thins a long line, keeping both ends', () => {
    const line = Array.from({ length: 5000 }, (_, i) => [i, i] as LngLat);
    const thin = thinLine(line, 100);
    expect(thin).toHaveLength(100);
    expect(thin[0]).toEqual([0, 0]);
    expect(thin[99]).toEqual([4999, 4999]);
    expect(thinLine(line.slice(0, 10), 100)).toHaveLength(10);
  });

  it('snapshots a track and gives its coordinates; Classic has none', () => {
    const a = trackAttachment('Cibodas', 1234.6, [
      { lat: -6.1234567, lng: 106.1234567 },
      { lat: -6.2, lng: 106.3 },
    ]);
    expect(a).toMatchObject({ kind: 'track', distance_m: 1235 });
    expect(attachmentCoords(a)[0]).toEqual([106.123457, -6.123457]);
    expect(attachmentCoords(classicAttachment('Latihan', 'tok'))).toEqual([]);
    expect(attachmentCoords(null)).toEqual([]);
  });
});

describe('community links and clubs', () => {
  it('reads ?post= ids and builds public links', () => {
    const id = '0f8fad5b-d9cb-469f-a165-70867728950e';
    expect(parsePostParam(`?post=${id}`)).toBe(id);
    expect(parsePostParam('?post=../../x')).toBeNull();
    expect(postUrl(id, 'https://x.id')).toBe(`https://x.id/community/${id}`);
  });

  it('accepts only email-shaped member addresses', () => {
    expect(isEmail(' budi@mapala.id ')).toBe(true);
    expect(isEmail('budi')).toBe(false);
    expect(isEmail('budi@mapala')).toBe(false);
  });
});

describe('club contact', () => {
  it('turns what the leader typed into a link when it looks like one', () => {
    expect(contactHref('@makopala.ubl')).toBe('https://instagram.com/makopala.ubl');
    expect(contactHref('makopala.or.id')).toBe('https://makopala.or.id');
    expect(contactHref('https://x.id/a')).toBe('https://x.id/a');
    expect(contactHref('0812-3456-7890')).toBe('https://wa.me/6281234567890');
    expect(contactHref('+62 812 3456 7890')).toBe('https://wa.me/6281234567890');
    expect(contactHref('Sekretariat lantai 2')).toBeNull();
  });
});

describe('club invites and workspace export', () => {
  it('makes and reads invite links', () => {
    const t = '0123456789abcdef0123456789abcdef';
    expect(joinUrl(t, 'https://x.id')).toBe(`https://x.id/?join=${t}`);
    expect(parseJoinParam(`?join=${t}`)).toBe(t);
    expect(parseJoinParam('?join=abc')).toBeNull();
  });

  it('exports a track as GPX, KML and GeoJSON', () => {
    const track = trackAttachment('Gede <Cibodas>', 5000, [
      { lat: -6.7, lng: 106.9 },
      { lat: -6.75, lng: 106.95 },
    ]);
    const gpx = exportItem(track, 'gpx')!;
    expect(gpx).toContain('<trkpt lat="-6.7" lon="106.9"/>');
    expect(gpx).toContain('Gede &lt;Cibodas&gt;');
    expect(exportItem(track, 'kml')).toContain('<LineString><tessellate>1</tessellate><coordinates>106.9,-6.7,0 106.95,-6.75,0</coordinates>');
    const geo = JSON.parse(exportItem(track, 'geojson')!);
    expect(geo.features[0].geometry.type).toBe('LineString');
    expect(geo.features[0].properties.distance_m).toBe(5000);
  });

  it('exports a place as a waypoint; Classic has no file', () => {
    const place = placeAttachment({ id: 'p', name: 'Pos 2', category: 'camp', lat: -6.7, lng: 106.9 } as Parameters<typeof placeAttachment>[0]);
    expect(exportItem(place, 'gpx')).toContain('<wpt lat="-6.7" lon="106.9"><name>Pos 2</name></wpt>');
    expect(exportItem(place, 'kml')).toContain('<Point>');
    expect(exportItem(classicAttachment('Latihan', 'tok'), 'gpx')).toBeNull();
    expect(itemFileName('Jalur: Gede / Pangrango', 'gpx')).toBe('Jalur_Gede_Pangrango.gpx');
  });

  it('keeps more track points in a workspace than on a post', () => {
    const pts = Array.from({ length: 4000 }, (_, i) => ({ lat: -6 - i / 1e4, lng: 106 + i / 1e4 }));
    expect(attachmentCoords(trackAttachment('t', 1, pts))).toHaveLength(1500);
    expect(attachmentCoords(trackAttachment('t', 1, pts, 5000))).toHaveLength(4000);
  });
});
