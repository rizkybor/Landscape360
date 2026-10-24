import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SosAlertsPanel } from './SosAlertsPanel';
import type { SosAlert } from '../lib/sosAlerts';

const listSosAlerts = vi.fn();
const resolveSosAlert = vi.fn();
vi.mock('../lib/sosAlerts', () => ({
  listSosAlerts: (...a: unknown[]) => listSosAlerts(...a),
  resolveSosAlert: (...a: unknown[]) => resolveSosAlert(...a),
}));
vi.mock('../lib/supabaseClient', () => ({ supabase: {} }));

const alert: SosAlert = {
  id: 'a1', userId: 'u1', email: 'budi@example.com', name: 'Budi', phone: '0812 3456 7890', organization: 'Mapala UI',
  status: 'active', message: 'Kaki terkilir di pos 3', lat: -6.78991, lng: 106.9832, accuracy: 8, elevation: 2100, battery: 15,
  locatedAt: new Date().toISOString(), startedAt: new Date().toISOString(), receivedAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(), resolvedAt: null, resolvedNote: null, pointCount: 4,
};

describe('SosAlertsPanel', () => {
  beforeEach(() => {
    listSosAlerts.mockReset().mockResolvedValue([alert]);
    resolveSosAlert.mockReset().mockResolvedValue(undefined);
  });

  it('shows who, the message, location, battery and contact links', async () => {
    render(<SosAlertsPanel onClose={vi.fn()} />);
    expect(await screen.findByText('“Kaki terkilir di pos 3”')).toBeInTheDocument();
    expect(screen.getByText('Budi')).toBeInTheDocument();
    expect(screen.getByText(/Mapala UI/)).toBeInTheDocument();
    expect(screen.getByText(/-6\.78991, 106\.98320/)).toBeInTheDocument();
    expect(screen.getByText(/15%/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Call/ })).toHaveAttribute('href', 'tel:081234567890');
    expect(screen.getByRole('link', { name: /WhatsApp/ })).toBeInTheDocument();
  });

  it('marks an alert resolved with a note', async () => {
    render(<SosAlertsPanel onClose={vi.fn()} />);
    fireEvent.click(await screen.findByText('Mark resolved'));
    fireEvent.change(screen.getByLabelText('Resolution note'), { target: { value: 'Found safe' } });
    listSosAlerts.mockResolvedValue([]);
    fireEvent.click(screen.getByRole('button', { name: 'Resolve' }));
    await waitFor(() => expect(resolveSosAlert).toHaveBeenCalledWith('a1', 'Found safe'));
    expect(await screen.findByText('No active S.O.S')).toBeInTheDocument();
  });
});
