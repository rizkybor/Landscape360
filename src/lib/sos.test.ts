import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  SOS_LIGHT_PATTERN,
  buildSosMessage,
  emergencyContactError,
  loadEmergencyContacts,
  saveEmergencyContacts,
  smsUrl,
} from './sos';

vi.mock('./supabaseClient', () => ({ supabase: {} }));

const fix = { lat: -6.78991, lng: 106.9832, accuracy: 8.4, elevation: 2958.2, time: new Date(2026, 9, 25, 14, 3).getTime() };

describe('S.O.S message', () => {
  it('includes the coordinates in DMS and decimal, elevation, accuracy, time and a map link', () => {
    const msg = buildSosMessage('Budi S.', fix);
    expect(msg).toContain('Budi S. butuh bantuan / needs help.');
    expect(msg).toMatch(/6°47'23\.\d+" S 106°58'59\.\d+" E \(-6\.78991, 106\.98320\)/);
    expect(msg).toContain('elev 2958 m, ±8 m, 25/10 14:03.');
    expect(msg).toContain('https://maps.google.com/?q=-6.78991,106.98320');
  });

  it('says when there is no GPS fix yet', () => {
    expect(buildSosMessage('', null)).toMatch(/A Landscape 360 user butuh bantuan.*no GPS fix yet/);
  });
});

describe('smsUrl', () => {
  it('puts the body after "?" on Android and "&" on iOS, numbers comma separated', () => {
    expect(smsUrl(['0812-3456-7890', '+62 811 222 333'], 'Help me', false)).toBe('sms:081234567890,+62811222333?body=Help%20me');
    expect(smsUrl(['0812-3456-7890'], 'Help me', true)).toBe('sms:081234567890&body=Help%20me');
  });
});

describe('emergency contacts', () => {
  beforeEach(() => localStorage.clear());

  it('are kept on the device per account', () => {
    saveEmergencyContacts('u1', [{ name: 'Ibu', phone: '0812345678' }]);
    expect(loadEmergencyContacts('u1')).toEqual([{ name: 'Ibu', phone: '0812345678' }]);
    expect(loadEmergencyContacts('u2')).toEqual([]);
  });

  it('validates a new contact', () => {
    const list = [{ name: 'Ibu', phone: '0812-345-678' }];
    expect(emergencyContactError({ name: '', phone: '0812345678' }, [])).toMatch(/name/);
    expect(emergencyContactError({ name: 'X', phone: '123' }, [])).toMatch(/8 to 15 digits/);
    expect(emergencyContactError({ name: 'Ayah', phone: '0812345678' }, list)).toMatch(/already/);
    expect(emergencyContactError({ name: 'Ayah', phone: '0811111111' }, Array(5).fill(list[0]))).toMatch(/At most 5/);
    expect(emergencyContactError({ name: 'Ayah', phone: '0811111111' }, list)).toBeNull();
  });
});

describe('SOS light pattern', () => {
  it('is dot dot dot, dash dash dash, dot dot dot', () => {
    expect(SOS_LIGHT_PATTERN.map(([on]) => (on > 300 ? '-' : '.')).join('')).toBe('...---...');
  });
});
