import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { SosScreen } from './SosScreen';

const queueSosReport = vi.fn();
vi.mock('../lib/sosAlerts', () => ({
  queueSosReport: (...a: unknown[]) => queueSosReport(...a),
  flushSosOutbox: vi.fn(() => Promise.resolve(true)),
}));
vi.mock('../lib/supabaseClient', () => ({ supabase: {} }));
vi.mock('../utils/elevationUtils', () => ({ fetchTerrainRgbElevation: vi.fn(() => Promise.resolve(null)) }));

const skipCountdown = () => {
  for (let i = 0; i < 6; i++) act(() => vi.advanceTimersByTime(1000));
};
const settle = () => act(async () => {});

describe('SosScreen reports to the admin', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    queueSosReport.mockReset();
    queueSosReport.mockResolvedValue(true);
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: { watchPosition: vi.fn(), clearWatch: vi.fn() },
    });
  });
  afterEach(() => vi.useRealTimers());

  it('sends the alert when active, sends messages and resolves on "I\'m safe"', async () => {
    const onClose = vi.fn();
    render(<SosScreen userId="u1" userName="Budi" onClose={onClose} />);
    expect(queueSosReport).not.toHaveBeenCalled(); // not during the countdown
    skipCountdown();
    await settle();
    expect(queueSosReport).toHaveBeenCalledWith(expect.objectContaining({ status: 'active' }));
    expect(screen.getByText(/Sent to the admin/)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Message to the admin'), { target: { value: 'Kaki terkilir di pos 3' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
    await settle();
    expect(queueSosReport).toHaveBeenLastCalledWith(expect.objectContaining({ message: 'Kaki terkilir di pos 3' }));

    const clientId = queueSosReport.mock.calls[0][0].clientId;
    fireEvent.click(screen.getByText("I'm safe"));
    await settle();
    expect(queueSosReport).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'resolved', clientId }));
  });
});
