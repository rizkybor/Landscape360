import { describe, it, expect, vi, beforeEach } from 'vitest';

const rpc = vi.fn();
vi.mock('./supabaseClient', () => ({ supabase: { rpc: (...args: unknown[]) => rpc(...args) } }));

import { flushSosOutbox, listSosAlerts, pendingSosReports, queueSosReport, type SosReport } from './sosAlerts';

const report = (over: Partial<SosReport> = {}): SosReport => ({
  clientId: '11111111-1111-4111-8111-111111111111',
  startedAt: '2026-10-25T01:00:00.000Z',
  status: 'active',
  message: '  kaki terkilir  ',
  fix: { lat: -6.78991, lng: 106.9832, accuracy: 8, elevation: 2100, time: Date.parse('2026-10-25T01:00:30Z') },
  battery: 42,
  ...over,
});

describe('S.O.S alerts', () => {
  beforeEach(() => {
    localStorage.clear();
    rpc.mockReset();
  });

  it('sends the message, full location, battery and times', async () => {
    rpc.mockResolvedValue({ error: null });
    expect(await queueSosReport(report())).toBe(true);
    expect(rpc).toHaveBeenCalledWith('sos_report', {
      p_client_id: '11111111-1111-4111-8111-111111111111',
      p_started_at: '2026-10-25T01:00:00.000Z',
      p_status: 'active',
      p_message: 'kaki terkilir',
      p_lat: -6.78991,
      p_lng: 106.9832,
      p_accuracy: 8,
      p_elevation: 2100,
      p_battery: 42,
      p_located_at: '2026-10-25T01:00:30.000Z',
    });
    expect(pendingSosReports()).toEqual([]);
  });

  it('keeps the latest report without signal and sends it when back online', async () => {
    rpc.mockResolvedValue({ error: { message: 'Failed to fetch' } });
    await expect(queueSosReport(report())).rejects.toThrow('Failed to fetch');
    await expect(queueSosReport(report({ status: 'resolved', fix: null }))).rejects.toThrow();
    expect(pendingSosReports()).toHaveLength(1);
    expect(pendingSosReports()[0].status).toBe('resolved');

    rpc.mockResolvedValue({ error: null });
    expect(await flushSosOutbox()).toBe(true);
    expect(rpc).toHaveBeenLastCalledWith('sos_report', expect.objectContaining({ p_status: 'resolved', p_lat: null, p_located_at: null }));
    expect(pendingSosReports()).toEqual([]);
  });

  it('explains a missing migration', async () => {
    rpc.mockResolvedValue({ error: { message: 'Could not find the function public.sos_report', code: 'PGRST202' } });
    await expect(queueSosReport(report())).rejects.toThrow(/20261024000015/);
  });

  it('maps the admin list', async () => {
    rpc.mockResolvedValue({
      data: [{ id: 'a', user_id: 'u', email: 'x@y.id', name: null, status: 'active', lat: '-6.5', lng: '106.9', battery: 15, point_count: '3', started_at: 's', received_at: 'r', updated_at: 'u' }],
      error: null,
    });
    const [a] = await listSosAlerts(true);
    expect(rpc).toHaveBeenCalledWith('admin_sos_alerts', { p_only_active: true, p_limit: 100 });
    expect(a).toMatchObject({ id: 'a', lat: -6.5, lng: 106.9, battery: 15, pointCount: 3, elevation: null, status: 'active' });
  });
});
