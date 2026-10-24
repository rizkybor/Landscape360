import { describe, it, expect } from 'vitest';
import * as turf from '@turf/turf';
import { snapToAngle, geodesicInverse, getAzimuthData, buildSurveyLine, segmentMidpoints, handleFromDrag, handleEnds } from './surveyUtils';

const bearing = (a: [number, number], b: [number, number]) => turf.bearing(turf.point(a), turf.point(b));
const turnBetween = (prev: [number, number], last: [number, number], next: [number, number]) => {
  const t = bearing(last, next) - bearing(prev, last);
  return ((((t % 360) + 540) % 360) - 180);
};

describe('snapToAngle', () => {
  const prev: [number, number] = [106.75, -6.235];
  const last: [number, number] = [106.75, -6.234]; // heading north

  it('turns a near-right turn into exactly 90°', () => {
    const snapped = snapToAngle(prev, last, [106.751, -6.2338], 90); // east, slightly north
    expect(turnBetween(prev, last, snapped)).toBeCloseTo(90, 3);
  });

  it('turns a near-left turn into exactly -90° on a diagonal line', () => {
    const diagPrev: [number, number] = [106.75, -6.235];
    const diagLast: [number, number] = [106.751, -6.234]; // heading north-east
    const snapped = snapToAngle(diagPrev, diagLast, [106.7505, -6.2334], 90);
    expect(turnBetween(diagPrev, diagLast, snapped)).toBeCloseTo(-90, 3);
  });

  it('keeps going straight when the cursor is almost in line', () => {
    const snapped = snapToAngle(prev, last, [106.7501, -6.233], 90);
    expect(turnBetween(prev, last, snapped)).toBeCloseTo(0, 3);
  });

  it('snaps to 45° steps', () => {
    const snapped = snapToAngle(prev, last, [106.7508, -6.2333], 45); // ~north-east
    expect(turnBetween(prev, last, snapped)).toBeCloseTo(45, 3);
  });

  it('snaps the azimuth from north for the first segment', () => {
    const snapped = snapToAngle(null, last, [106.7512, -6.2338], 90); // mostly east
    expect((bearing(last, snapped) + 360) % 360).toBeCloseTo(90, 3);
  });

  it('uses the distance along the snapped direction', () => {
    const target: [number, number] = [106.751, -6.234]; // due east of last
    const snapped = snapToAngle(prev, last, target, 90);
    const d = (a: [number, number], b: [number, number]) => turf.distance(turf.point(a), turf.point(b), { units: 'meters' });
    expect(d(last, snapped)).toBeCloseTo(d(last, target), 0);
  });
});

describe('geodesicInverse (WGS84)', () => {
  const dms = (d: number, m: number, s: number) => Math.sign(d) * (Math.abs(d) + m / 60 + s / 3600);

  it('matches the classic Flinders Peak -> Buninyong reference line', () => {
    // Vincenty (1975) test line, geodetic values on the ellipsoid
    const r = geodesicInverse(dms(-37, 57, 3.7203), dms(144, 25, 29.5244), dms(-37, 39, 10.1561), dms(143, 55, 35.3839));
    expect(r.distance).toBeCloseTo(54972.271, 2);
    expect(r.initialBearing).toBeCloseTo(dms(306, 52, 5.37), 4);
    expect(r.finalBearing).toBeCloseTo(dms(127, 10, 25.07) + 180, 4); // reverse azimuth 127°10'25.07" + 180°
  });

  it('measures 1" of latitude near Jakarta as ~30.7 m, unlike the sphere', () => {
    const r = geodesicInverse(-6.2, 106.8, -6.2 + 1 / 3600, 106.8);
    expect(r.distance).toBeCloseTo(30.72, 1);
  });

  it('returns zero for the same point', () => {
    expect(geodesicInverse(-6.2, 106.8, -6.2, 106.8).distance).toBe(0);
  });
});

describe('getAzimuthData', () => {
  const pt = (lat: number, lng: number, elevation = 0) => ({ id: 'x', lat, lng, elevation });

  it('gives due east as 090° with the reverse direction as back azimuth', () => {
    const d = getAzimuthData(pt(-6.2, 106.8), pt(-6.2, 106.801));
    expect(d.forwardAzimuth).toBeCloseTo(90, 1);
    expect(d.backAzimuth).toBeCloseTo(270, 1);
    expect(d.horizontalDistance).toBeCloseTo(110.6, 0);
  });

  it('computes slope from the elevation difference', () => {
    const d = getAzimuthData(pt(-6.2, 106.8, 10), pt(-6.2, 106.801, 21.06));
    expect(d.slope).toBeCloseTo((11.06 / d.horizontalDistance) * 100, 6);
  });
});

describe('buildSurveyLine', () => {
  const square = [
    { lng: 106.75, lat: -6.235 },
    { lng: 106.75, lat: -6.234 },
    { lng: 106.751, lat: -6.234 },
    { lng: 106.751, lat: -6.235 },
  ];
  const has = (line: [number, number][], p: { lng: number; lat: number }) =>
    line.some(([x, y]) => x === p.lng && y === p.lat);

  it('curves through smooth points (default)', () => {
    const line = buildSurveyLine(square);
    expect(line.length).toBeGreaterThan(square.length);
    expect(line[0]).toEqual([square[0].lng, square[0].lat]);
    expect(line[line.length - 1]).toEqual([square[3].lng, square[3].lat]);
  });

  it('draws straight segments when every point is sharp', () => {
    const line = buildSurveyLine(square.map((p) => ({ ...p, corner: 'sharp' as const })));
    expect(line).toEqual(square.map((p) => [p.lng, p.lat]));
  });

  it('keeps a sharp corner exactly on its point while curving elsewhere', () => {
    const pts = [...square, { lng: 106.752, lat: -6.2355 }];
    const line = buildSurveyLine(pts.map((p, i) => ({ ...p, corner: i === 2 ? ('sharp' as const) : undefined })));
    expect(has(line, pts[2])).toBe(true);
    expect(line.length).toBeGreaterThan(pts.length);
  });

  it('bends a segment with a dragged Bezier handle and keeps the points on the line', () => {
    const a = { lng: 106.75, lat: -6.235 };
    const b = { lng: 106.751, lat: -6.235 };
    const handle = handleFromDrag(a, [106.7503, -6.2347]); // pulled north-east
    const line = buildSurveyLine([{ ...a, handle }, b]);
    expect(line.length).toBeGreaterThan(2);
    expect(line[0]).toEqual([a.lng, a.lat]);
    expect(line[line.length - 1]).toEqual([b.lng, b.lat]);
    // The curve bulges north of the straight east-west chord
    expect(segmentMidpoints([{ ...a, handle }, b])[0][1]).toBeGreaterThan(a.lat);
  });

  it('turns a drag into a handle whose ends are opposite each other', () => {
    const p = { lng: 106.75, lat: -6.235 };
    const handle = handleFromDrag(p, [106.7501, -6.2349]);
    expect(handle.east).toBeGreaterThan(0);
    expect(handle.north).toBeGreaterThan(0);
    const ends = handleEnds(p, handle);
    expect(ends.out[0]).toBeCloseTo(106.7501, 9);
    expect(ends.out[1]).toBeCloseTo(-6.2349, 9);
    expect(ends.in[0] + ends.out[0]).toBeCloseTo(2 * p.lng, 9);
  });

  it('leaves two points as a straight line', () => {
    expect(buildSurveyLine(square.slice(0, 2))).toHaveLength(2);
  });
});
