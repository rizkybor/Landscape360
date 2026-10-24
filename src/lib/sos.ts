import { isValidPhone } from './profileContact';
import { toDMS } from '../utils/surveyUtils';

// S.O.S (phase 1): everything works on the phone alone, without internet. Calls and SMS are
// opened in the phone's own apps; the user still presses Call / Send there.

// Indonesia: 112 national emergency line, 115 Basarnas (search and rescue)
export const EMERGENCY_NUMBERS = [
  { label: 'Emergency 112', number: '112' },
  { label: 'Basarnas 115', number: '115' },
] as const;

export const MAX_EMERGENCY_CONTACTS = 5;

export interface EmergencyContact {
  name: string;
  phone: string;
}

export interface SosFix {
  lat: number;
  lng: number;
  accuracy: number | null; // meters
  elevation: number | null; // meters
  time: number; // ms since epoch
}

const contactsKey = (userId: string) => `l360-sos-contacts-${userId}`;

// Kept on the device per account, so they are there without signal
export const loadEmergencyContacts = (userId: string): EmergencyContact[] => {
  try {
    const list = JSON.parse(localStorage.getItem(contactsKey(userId)) ?? '[]');
    return Array.isArray(list)
      ? list.filter((c) => c && typeof c.name === 'string' && typeof c.phone === 'string').slice(0, MAX_EMERGENCY_CONTACTS)
      : [];
  } catch {
    return [];
  }
};

export const saveEmergencyContacts = (userId: string, contacts: EmergencyContact[]) => {
  try {
    localStorage.setItem(contactsKey(userId), JSON.stringify(contacts.slice(0, MAX_EMERGENCY_CONTACTS)));
    return true;
  } catch {
    return false;
  }
};

/** First problem with a new contact, or null */
export const emergencyContactError = (c: EmergencyContact, existing: EmergencyContact[]): string | null => {
  if (!c.name.trim()) return 'Enter a name';
  if (!c.phone.trim() || !isValidPhone(c.phone)) return 'Phone number must have 8 to 15 digits';
  if (existing.length >= MAX_EMERGENCY_CONTACTS) return `At most ${MAX_EMERGENCY_CONTACTS} contacts`;
  const digits = c.phone.replace(/\D/g, '');
  if (existing.some((e) => e.phone.replace(/\D/g, '') === digits)) return 'This number is already in the list';
  return null;
};

const pad = (n: number) => String(n).padStart(2, '0');
const formatTime = (ms: number) => {
  const d = new Date(ms);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/** SMS text: short enough for one or two SMS, readable by a person and a rescuer */
export const buildSosMessage = (name: string, fix: SosFix | null) => {
  const who = name.trim() || 'A Landscape 360 user';
  if (!fix) return `SOS Landscape 360: ${who} butuh bantuan / needs help. Lokasi belum didapat (no GPS fix yet).`;
  const parts = [
    `SOS Landscape 360: ${who} butuh bantuan / needs help.`,
    `Lokasi: ${toDMS(fix.lat, true)} ${toDMS(fix.lng, false)} (${fix.lat.toFixed(5)}, ${fix.lng.toFixed(5)})`,
    [
      fix.elevation !== null ? `elev ${Math.round(fix.elevation)} m` : null,
      fix.accuracy !== null ? `±${Math.round(fix.accuracy)} m` : null,
      formatTime(fix.time),
    ]
      .filter(Boolean)
      .join(', ') + '.',
    `Peta: https://maps.google.com/?q=${fix.lat.toFixed(5)},${fix.lng.toFixed(5)}`,
  ];
  return parts.join(' ');
};

export const isIOS = (ua = typeof navigator === 'undefined' ? '' : navigator.userAgent) =>
  /iPad|iPhone|iPod/.test(ua) || (ua.includes('Macintosh') && typeof document !== 'undefined' && 'ontouchend' in document);

/** sms: link with the message filled in (iOS separates the body with "&", others with "?") */
export const smsUrl = (numbers: string[], body: string, ios = isIOS()) => {
  const to = numbers.map((n) => n.replace(/[^\d+]/g, '')).join(',');
  return `sms:${to}${ios ? '&' : '?'}body=${encodeURIComponent(body)}`;
};

// International Morse for SOS (··· ——— ···), as [on, off] durations in ms, repeated
const DOT = 220;
export const SOS_LIGHT_PATTERN: [number, number][] = [
  ...[0, 0, 0].map((_, i) => [DOT, i === 2 ? DOT * 3 : DOT] as [number, number]),
  ...[0, 0, 0].map((_, i) => [DOT * 3, i === 2 ? DOT * 3 : DOT] as [number, number]),
  ...[0, 0, 0].map((_, i) => [DOT, i === 2 ? DOT * 7 : DOT] as [number, number]),
];
