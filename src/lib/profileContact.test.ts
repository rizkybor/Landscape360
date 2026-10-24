import { describe, it, expect, vi } from 'vitest';
import { accountDisplayName, isValidPhone, whatsappUrl } from './profileContact';

vi.mock('./supabaseClient', () => ({ supabase: {} }));

describe('accountDisplayName', () => {
  it('reads the name wherever the account stored it', () => {
    expect(accountDisplayName({ user_metadata: { display_name: 'Budi Santoso' } })).toBe('Budi Santoso');
    expect(accountDisplayName({ user_metadata: { full_name: 'Old', display_name: 'Current' } })).toBe('Current');
    expect(accountDisplayName({ user_metadata: { full_name: 'Older account' } })).toBe('Older account');
    expect(accountDisplayName({ user_metadata: { name: 'Google Name' } })).toBe('Google Name');
    expect(accountDisplayName({ user_metadata: {} })).toBe('');
  });
});

describe('isValidPhone', () => {
  it('accepts 8 to 15 digits, or nothing', () => {
    expect(isValidPhone('+62 812-3456-7890')).toBe(true);
    expect(isValidPhone('')).toBe(true);
    expect(isValidPhone('12345')).toBe(false);
    expect(isValidPhone('1234567890123456')).toBe(false);
  });
});

describe('whatsappUrl', () => {
  it('turns a local Indonesian number into an international one', () => {
    expect(whatsappUrl('0812-3456-7890')).toBe('https://wa.me/6281234567890');
    expect(whatsappUrl('+62 812 3456 7890')).toBe('https://wa.me/6281234567890');
    expect(whatsappUrl('123')).toBeNull();
  });
});
