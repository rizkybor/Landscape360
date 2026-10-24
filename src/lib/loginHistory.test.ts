import { describe, it, expect, vi } from 'vitest';
import { describeUserAgent } from './loginHistory';

vi.mock('./supabaseClient', () => ({ supabase: {} }));

describe('describeUserAgent', () => {
  it.each([
    ['Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1', 'Safari on iPhone'],
    ['Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/120.0 Mobile Safari/537.36', 'Chrome on Android'],
    ['Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36 Edg/120.0', 'Edge on Windows'],
    ['Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0; rv:121.0) Gecko/20100101 Firefox/121.0', 'Firefox on macOS'],
    ['Mozilla/5.0 (Linux; Android 13; SM-A536E) AppleWebKit/537.36 SamsungBrowser/23.0 Chrome/115.0 Mobile Safari/537.36', 'Samsung Internet on Android'],
  ])('%s', (ua, expected) => {
    expect(describeUserAgent(ua)).toBe(expected);
  });

  it('handles a missing user agent', () => {
    expect(describeUserAgent(null)).toBe('Unknown device');
  });
});
