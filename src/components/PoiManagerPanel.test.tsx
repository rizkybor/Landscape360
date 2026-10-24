import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { PoiManagerPanel } from './PoiManagerPanel';
import { createPoi, deletePoi, listAllPois, updatePoi, type PointOfInterest } from '../lib/pointsOfInterest';
import { usePoiStore } from '../store/usePoiStore';

vi.mock('../lib/supabaseClient', () => ({ supabase: {} }));
vi.mock('../lib/pointsOfInterest', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/pointsOfInterest')>()),
  listAllPois: vi.fn(),
  listPublishedPois: vi.fn(() => Promise.resolve([])),
  createPoi: vi.fn(),
  updatePoi: vi.fn(),
  deletePoi: vi.fn(),
}));

const poi = (over: Partial<PointOfInterest>): PointOfInterest => ({
  id: 'p1',
  name: 'Gunung Gede (TNGGP)',
  subtitle: '2.958 mdpl',
  description: null,
  category: 'mountain',
  lat: -6.78991,
  lng: 106.9832,
  isPublished: true,
  updatedAt: null,
  ...over,
});

const rowOf = (name: string) => screen.getByText(name).closest('.rounded-xl') as HTMLElement;

describe('PoiManagerPanel', () => {
  const reload = vi.fn(() => Promise.resolve());

  beforeEach(() => {
    vi.clearAllMocks();
    usePoiStore.setState({ load: reload });
    vi.mocked(listAllPois).mockResolvedValue([
      poi({}),
      poi({ id: 'p2', name: 'Gua Ciasem', category: 'cave', subtitle: null, isPublished: false }),
    ]);
    vi.mocked(createPoi).mockImplementation(async (input) => poi({ ...input, id: 'new' }));
    vi.mocked(updatePoi).mockImplementation(async (id, input) => poi({ ...input, id }));
    vi.mocked(deletePoi).mockResolvedValue(undefined);
  });

  it('lists every point, hidden ones marked, and filters by category', async () => {
    render(<PoiManagerPanel onClose={vi.fn()} />);
    expect(await screen.findByText('Gunung Gede (TNGGP)')).toBeInTheDocument();
    expect(within(rowOf('Gua Ciasem')).getByText('Hidden')).toBeInTheDocument();
    expect(screen.getByText(/2 points · 1 on the map/)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Filter by category'), { target: { value: 'cave' } });
    expect(screen.queryByText('Gunung Gede (TNGGP)')).not.toBeInTheDocument();
  });

  it('adds a point and refreshes the map', async () => {
    render(<PoiManagerPanel onClose={vi.fn()} />);
    await screen.findByText('Gunung Gede (TNGGP)');
    fireEvent.click(screen.getByRole('button', { name: /Add Point/ }));
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Mata Air Baru' } });
    fireEvent.change(screen.getByLabelText('Category'), { target: { value: 'water' } });
    fireEvent.change(screen.getByLabelText('Latitude'), { target: { value: '-6.7' } });
    fireEvent.change(screen.getByLabelText('Longitude'), { target: { value: '106.9' } });
    fireEvent.click(screen.getAllByRole('button', { name: /Add Point/ }).at(-1)!);

    await waitFor(() =>
      expect(createPoi).toHaveBeenCalledWith(expect.objectContaining({ name: 'Mata Air Baru', category: 'water', lat: -6.7, lng: 106.9, isPublished: true })),
    );
    expect(reload).toHaveBeenCalled();
    expect(await screen.findByText('Mata Air Baru added')).toBeInTheDocument();
  });

  it('rejects coordinates out of range before saving', async () => {
    render(<PoiManagerPanel onClose={vi.fn()} />);
    await screen.findByText('Gunung Gede (TNGGP)');
    fireEvent.click(screen.getByRole('button', { name: /Add Point/ }));
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Somewhere' } });
    fireEvent.change(screen.getByLabelText('Latitude'), { target: { value: '120' } });
    fireEvent.click(screen.getAllByRole('button', { name: /Add Point/ }).at(-1)!);
    expect(await screen.findByText(/Latitude must be between/)).toBeInTheDocument();
    expect(createPoi).not.toHaveBeenCalled();
  });

  it('edits, hides and deletes a point', async () => {
    render(<PoiManagerPanel onClose={vi.fn()} />);
    await screen.findByText('Gunung Gede (TNGGP)');

    fireEvent.click(within(rowOf('Gunung Gede (TNGGP)')).getByTitle('Edit'));
    expect(screen.getByLabelText('Name')).toHaveValue('Gunung Gede (TNGGP)');
    fireEvent.change(screen.getByLabelText('Subtitle'), { target: { value: '2.962 mdpl' } });
    fireEvent.click(screen.getByRole('button', { name: /Save Changes/ }));
    await waitFor(() => expect(updatePoi).toHaveBeenCalledWith('p1', expect.objectContaining({ subtitle: '2.962 mdpl' })));

    fireEvent.click(within(rowOf('Gunung Gede (TNGGP)')).getByTitle('Hide from the map'));
    await waitFor(() => expect(updatePoi).toHaveBeenLastCalledWith('p1', expect.objectContaining({ isPublished: false })));

    fireEvent.click(within(rowOf('Gua Ciasem')).getByTitle('Delete'));
    fireEvent.click(within(rowOf('Gua Ciasem')).getByTitle('Confirm delete'));
    await waitFor(() => expect(deletePoi).toHaveBeenCalledWith('p2'));
  });

  it('explains when the migration has not been run', async () => {
    vi.mocked(listAllPois).mockRejectedValue(new Error('relation "public.points_of_interest" does not exist'));
    render(<PoiManagerPanel onClose={vi.fn()} />);
    expect(await screen.findByText(/Run the 20261024000012_points_of_interest migration/)).toBeInTheDocument();
  });
});
