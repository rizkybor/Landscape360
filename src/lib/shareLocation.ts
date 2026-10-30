import { toDMS } from '../utils/surveyUtils';

// Share Location: send where you are right now (one point, not live) as a message, with a
// link that opens Landscape 360 at that point: https://…/?at=-6.78991,106.98320

export const SITE_URL = 'https://landscape360.jcdigital.co.id';

export interface SharedPoint {
  lat: number;
  lng: number;
}

export interface LocationFix extends SharedPoint {
  elevation: number | null; // meters
  accuracy: number | null; // meters
  time: number; // ms since epoch
}

/** Link that opens the map at a point */
export const sharedLocationUrl = (lat: number, lng: number, base = SITE_URL) =>
  `${base}/?at=${lat.toFixed(5)},${lng.toFixed(5)}`;

/** The point in a "?at=lat,lng" link, or null when there is none or it is not valid */
export const parseSharedPoint = (search: string): SharedPoint | null => {
  const at = new URLSearchParams(search).get('at');
  if (!at) return null;
  const [lat, lng] = at.split(',').map((v) => Number(v.trim()));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
};

const pad = (n: number) => String(n).padStart(2, '0');

/** Message text: readable in a chat, with both a Google Maps and a Landscape 360 link */
export const buildShareLocationText = (fix: LocationFix, name = '') => {
  const who = name.trim();
  const d = new Date(fix.time);
  const details = [
    fix.elevation !== null ? `${Math.round(fix.elevation)} mdpl` : null,
    fix.accuracy !== null ? `±${Math.round(fix.accuracy)} m` : null,
    `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`,
  ].filter(Boolean);
  return [
    who ? `📍 Lokasi ${who} / ${who}'s location` : '📍 Lokasi saya / My location',
    `${toDMS(fix.lat, true)} ${toDMS(fix.lng, false)}`,
    `${fix.lat.toFixed(5)}, ${fix.lng.toFixed(5)}`,
    details.join(' · '),
    `Google Maps: https://maps.google.com/?q=${fix.lat.toFixed(5)},${fix.lng.toFixed(5)}`,
    `Landscape 360: ${sharedLocationUrl(fix.lat, fix.lng)}`,
  ].join('\n');
};

/** Link to a shared marked location: /?place=<32-character token> */
export const placeLinkUrl = (token: string, base = SITE_URL) => `${base}/?place=${token}`;

/** The token in a "?place=" link, or null */
export const parsePlaceToken = (search: string): string | null => {
  const token = new URLSearchParams(search).get('place');
  return token && /^[0-9a-f]{32}$/.test(token) ? token : null;
};

/** Message for a shared marked location */
export const buildPlaceShareText = (
  place: { name: string; categoryLabel: string; lat: number; lng: number; elevationM: number | null },
  url: string,
) =>
  [
    `📍 ${place.name} (${place.categoryLabel})`,
    `${toDMS(place.lat, true)} ${toDMS(place.lng, false)}`,
    place.elevationM !== null ? `${Math.round(place.elevationM)} mdpl` : null,
    `Open on Landscape 360 (no sign-in needed): ${url}`,
  ]
    .filter(Boolean)
    .join('\n');

/** Link to a shared marked area: /?area=<32-character token> */
export const areaLinkUrl = (token: string, base = SITE_URL) => `${base}/?area=${token}`;

/** The token in a "?area=" link, or null */
export const parseAreaToken = (search: string): string | null => {
  const token = new URLSearchParams(search).get('area');
  return token && /^[0-9a-f]{32}$/.test(token) ? token : null;
};

/** Message for a shared marked area */
export const buildAreaShareText = (area: { name: string; size: string; perimeter: string }, url: string) =>
  [`🗺️ ${area.name}`, `Area ${area.size} · perimeter ${area.perimeter}`, `Open on Landscape 360 (no sign-in needed): ${url}`].join('\n');

/** WhatsApp with the message filled in (the user picks the chat) */
export const whatsappShareUrl = (text: string) => `https://wa.me/?text=${encodeURIComponent(text)}`;

/** Link to a shared Classic Field Work: /?classic=<32-character token> */
export const classicLinkUrl = (token: string, base = SITE_URL) => `${base}/?classic=${token}`;

/** The token in a "?classic=" link, or null */
export const parseClassicToken = (search: string): string | null => {
  const token = new URLSearchParams(search).get('classic');
  return token && /^[0-9a-f]{32}$/.test(token) ? token : null;
};

/** Removes ?classic= from the address bar (closing a shared Field Work) */
export const clearClassicLink = () => {
  const url = new URL(window.location.href);
  url.searchParams.delete('classic');
  window.history.replaceState(null, '', url.pathname + url.search + url.hash);
};
