import { describe, it, expect } from 'vitest';
import { formatBytes, formatMb, usageBarClass, usagePercent } from './storageUsage';

describe('storage usage helpers', () => {
  it('formats bytes', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(1536)).toBe('1.5 KB');
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.00 MB');
    expect(formatBytes(150 * 1024 * 1024)).toBe('150.0 MB');
    expect(formatBytes(2 * 1024 * 1024 * 1024)).toBe('2.00 GB');
  });

  it('formats MB limits', () => {
    expect(formatMb(10)).toBe('10 MB');
    expect(formatMb(0.05)).toBe('0.05 MB');
    expect(formatMb(1024)).toBe('1 GB');
    expect(formatMb(1536)).toBe('1.5 GB');
  });

  it('computes usage percent, capped, and null when unlimited', () => {
    expect(usagePercent(5, 10)).toBe(50);
    expect(usagePercent(20, 10)).toBe(100);
    expect(usagePercent(0, 0)).toBe(100);
    expect(usagePercent(123, null)).toBeNull();
  });

  it('colors the bar by how full it is', () => {
    expect(usageBarClass(null)).toBe('bg-forest-700');
    expect(usageBarClass(50)).toBe('bg-forest-700');
    expect(usageBarClass(75)).toBe('bg-gold-400');
    expect(usageBarClass(95)).toBe('bg-brick-500');
  });
});
