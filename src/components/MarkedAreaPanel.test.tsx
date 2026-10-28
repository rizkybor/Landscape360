import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MarkedAreaPanel } from './MarkedAreaPanel';
import { useSurveyStore } from '../store/useSurveyStore';
import { useMarkedAreaStore } from '../store/useMarkedAreaStore';
import * as cloud from '../services/markedAreaSync';
import type { MarkedArea } from '../types/markedArea';

vi.mock('../lib/supabaseClient', () => ({ supabase: {} }));
vi.mock('../services/markedAreaSync', () => ({
  fetchMyAreas: vi.fn(() => Promise.resolve([])),
  createArea: vi.fn(),
  updateArea: vi.fn(),
  deleteArea: vi.fn(() => Promise.resolve()),
  createAreaLink: vi.fn(() => Promise.resolve('0123456789abcdef0123456789abcdef')),
  getAreaLink: vi.fn(() => Promise.resolve(null)),
  revokeAreaLink: vi.fn(() => Promise.resolve()),
}));

const ring: [number, number][] = [
  [106.98, -6.79],
  [106.981, -6.79],
  [106.981, -6.789],
];

const asUser = (subscriptionStatus: string) =>
  useSurveyStore.setState({ user: { id: 'u1', email: 'u@x.id', user_metadata: {} }, subscriptionStatus, isAdmin: false } as never);

describe('MarkedAreaPanel', () => {
  beforeEach(() => {
    useMarkedAreaStore.getState().reset();
    vi.mocked(cloud.fetchMyAreas).mockResolvedValue([]);
  });

  it('draws an area by tapping points, then saves it with a name', async () => {
    asUser('Free');
    vi.mocked(cloud.createArea).mockImplementation(async (input) => ({
      ...input,
      id: 'a1',
      userId: 'u1',
      areaM2: 12345,
      perimeterM: 450,
      createdAt: 0,
      updatedAt: 0,
    }) as MarkedArea);
    render(<MarkedAreaPanel />);
    act(() => useMarkedAreaStore.getState().setPanelOpen(true));
    expect(await screen.findByText('0 / 5')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Add area/ }));
    expect(screen.getByText(/Tap the map to add the corners/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Done/ })).toBeDisabled();
    act(() => ring.forEach((p) => useMarkedAreaStore.getState().addPoint(p)));
    expect(screen.getByText(/3 points/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Done/ }));

    fireEvent.change(screen.getByLabelText('Area name'), { target: { value: 'Surya Kencana' } });
    fireEvent.click(screen.getByRole('button', { name: /Save area/ }));
    await waitFor(() =>
      expect(cloud.createArea).toHaveBeenCalledWith({ name: 'Surya Kencana', color: '#d49b22', notes: null, ring }),
    );
    expect(await screen.findByText('Surya Kencana')).toBeInTheDocument();
    // Free plan: no share links
    expect(screen.queryByRole('button', { name: /Share/ })).not.toBeInTheDocument();
  });

  it('focus darkens the rest of the map; share links point to the mobile app', async () => {
    asUser('Pro');
    vi.mocked(cloud.fetchMyAreas).mockResolvedValue([
      { id: 'a1', userId: 'u1', name: 'Camp', color: '#2563eb', notes: null, ring, areaM2: 12345, perimeterM: 450, createdAt: 0, updatedAt: 0 },
    ]);
    render(<MarkedAreaPanel />);
    act(() => useMarkedAreaStore.getState().setPanelOpen(true));
    fireEvent.click(await screen.findByRole('button', { name: /Focus/ }));
    expect(useMarkedAreaStore.getState().focusId).toBe('a1');

    // Share links are made in the mobile app
    fireEvent.click(screen.getByRole('button', { name: /Share/ }));
    expect(screen.getByText(/Create a WhatsApp link for this area in the Landscape 360 Mobile App/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Create link/ })).not.toBeInTheDocument();
  });
});
