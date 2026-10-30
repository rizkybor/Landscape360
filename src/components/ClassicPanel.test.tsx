import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, act, within, waitFor } from '@testing-library/react';
import { ClassicPanel } from './ClassicPanel';
import { useClassicStore } from '../store/useClassicStore';
import { useSurveyStore } from '../store/useSurveyStore';
import * as share from '../services/classicShareSync';

vi.mock('../services/classicShareSync', () => ({
  saveFieldWorkLink: vi.fn(async ({ token }: { token: string | null }) => token ?? '0123456789abcdef0123456789abcdef'),
  revokeFieldWorkLink: vi.fn(async () => undefined),
  openFieldWorkLink: vi.fn(),
}));
import { bearingTo, toDmsInput } from '../utils/classicNav';
import type { LngLat } from '../types/markedArea';

// A hiker at Kandang Badak; the summits of Gede and Pangrango
const hiker: LngLat = [106.9726, -6.7808];
const gede: LngLat = [106.9806, -6.7845];
const pangrango: LngLat = [106.9618, -6.7704];

const type = (label: string, deg: number) => {
  const { d, m, s } = toDmsInput(deg);
  fireEvent.change(screen.getByLabelText(`${label} degrees`), { target: { value: d } });
  fireEvent.change(screen.getByLabelText(`${label} minutes`), { target: { value: m } });
  fireEvent.change(screen.getByLabelText(`${label} seconds`), { target: { value: s } });
};

// Compass degrees, to a tenth as a person would type them
const r1 = (v: number) => Math.round(v * 10) / 10;
const deg = (label: string, v: number) => fireEvent.change(screen.getByLabelText(label), { target: { value: String(r1(v)) } });

const typePoint = (title: string, [lng, lat]: LngLat) => {
  type(`${title} latitude`, Math.abs(lat));
  type(`${title} longitude`, Math.abs(lng));
};

const card = (name: string) => screen.getByRole('region', { name });

describe('ClassicPanel', () => {
  beforeEach(() => {
    act(() => {
      // A clean store: one empty Field Work in each mode
      localStorage.removeItem('landscape360-classic');
      useClassicStore.setState(useClassicStore.getInitialState(), true);
      useClassicStore.getState().setPanelOpen(true);
    });
  });

  it('resection: your position once, then only azimuth and back azimuth for each point', () => {
    render(<ClassicPanel />);
    const you = screen.getByRole('region', { name: 'Your position' });
    // The points have no position fields: only your position is set, once
    expect(screen.queryByLabelText('Point A latitude degrees')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Check my work/ })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Point A azimuth')).toBeDisabled();

    // A typo is explained, then the position is set
    type('Your position latitude', Math.abs(hiker[1]));
    fireEvent.change(screen.getByLabelText('Your position latitude minutes'), { target: { value: '75' } });
    expect(within(you).getByText(/Minutes go from 0 to 59/)).toBeInTheDocument();
    typePoint('Your position', hiker);
    expect(screen.getByLabelText('Point A azimuth')).toBeEnabled();
    expect(card('Point B')).toHaveAttribute('aria-disabled', 'true');

    // Point A: azimuth, then back azimuth (the azimuth itself gets the rule, not the number)
    deg('Point A azimuth', 60);
    expect(screen.getByLabelText('Point A back azimuth')).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Check point A azimuth' }));
    deg('Point A back azimuth', 60);
    fireEvent.click(screen.getByRole('button', { name: 'Check point A back azimuth' }));
    expect(within(card('Point A')).getByText(/That is the azimuth itself/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Check point A back azimuth' }));
    expect(within(card('Point A')).getByText('240°')).toBeInTheDocument();
    deg('Point A back azimuth', 240);
    expect(within(card('Point A')).getByText('Correct.')).toBeInTheDocument();

    // Point B: only azimuth and back azimuth, from the same position
    expect(card('Point B')).toHaveAttribute('aria-disabled', 'false');
    deg('Point B azimuth', 300);
    fireEvent.click(screen.getByRole('button', { name: 'Check point B azimuth' }));
    deg('Point B back azimuth', 120);
    fireEvent.click(screen.getByRole('button', { name: 'Check point B back azimuth' }));

    // Summary of the sightings, no crossing to compute
    const result = screen.getByRole('region', { name: 'Result' });
    expect(within(result).getByText('Point A').parentElement).toHaveTextContent('Az 60° ENE · Back 240° WSW');
    expect(within(result).getByText('Point B').parentElement).toHaveTextContent('Az 300° WNW · Back 120° ESE');
    // The compass points explain themselves in Indonesian
    expect(within(result).getAllByText('ENE')[0]).toHaveAttribute('title', 'ENE = Timur-Timur Laut (East-NorthEast), sekitar 57°–78°');
    fireEvent.click(within(result).getByRole('button', { name: /Apa arti ENE, WSW/ }));
    expect(within(result).getByText('Barat-Barat Daya').parentElement).toHaveClass('bg-gold-100');
    expect(screen.queryByText(/Copy coordinates/)).not.toBeInTheDocument();

    // More points can be added, and removed again
    fireEvent.click(screen.getByRole('button', { name: 'Add point C' }));
    expect(screen.queryByLabelText('Point C latitude degrees')).not.toBeInTheDocument();
    deg('Point C azimuth', 15);
    fireEvent.click(screen.getByRole('button', { name: 'Remove point C' }));
    expect(screen.queryByRole('button', { name: /Remove point/ })).not.toBeInTheDocument();
  });

  it('intersection: the same object from positions A and B (azimuth, then back azimuth)', () => {
    act(() => useClassicStore.getState().setMode('intersection'));
    render(<ClassicPanel />);
    const z1 = bearingTo(gede, hiker).bearing;
    const z2 = bearingTo(pangrango, hiker).bearing;

    typePoint('Position A', gede);
    deg('Position A azimuth', z1);
    fireEvent.click(screen.getByRole('button', { name: 'Check position A azimuth' }));
    // No "Check my work" in an intersection: the hints cover the typing, the back azimuth and the cut
    expect(screen.queryByRole('button', { name: /Check my work/ })).not.toBeInTheDocument();
    // Then its back azimuth, as in a resection; position B waits until it is right
    const r = (v: number) => Math.round(v * 10) / 10;
    expect(card('Position B')).toHaveAttribute('aria-disabled', 'true');
    deg('Position A back azimuth', r(z1));
    fireEvent.click(screen.getByRole('button', { name: 'Check position A back azimuth' }));
    expect(within(card('Position A')).getByText(/That is the azimuth itself/)).toBeInTheDocument();
    deg('Position A back azimuth', (r(z1) + 180) % 360);
    expect(within(card('Position A')).getByText('Correct.')).toBeInTheDocument();
    expect(card('Position B')).toHaveAttribute('aria-disabled', 'false');

    // Same spot as position A is refused
    typePoint('Position B', [106.98061, -6.78451]);
    expect(within(card('Position B')).getByText(/within 50 m of position A/)).toBeInTheDocument();
    typePoint('Position B', pangrango);
    deg('Position B azimuth', z2);
    fireEvent.click(screen.getByRole('button', { name: 'Check position B azimuth' }));
    expect(screen.queryByText(/Copy coordinates/)).not.toBeInTheDocument();
    deg('Position B back azimuth', (r(z2) + 180) % 360);
    fireEvent.click(screen.getByRole('button', { name: 'Check position B back azimuth' }));

    expect(screen.getByText(/Copy coordinates/)).toBeInTheDocument();
    expect(screen.getByText(/Most likely within ±\d+ m/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add position C' })).toBeEnabled();
  });

  it('phone: a bottom sheet that lowers to its header and comes back', () => {
    const original = window.matchMedia;
    window.matchMedia = ((query: string) => ({
      matches: true,
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    })) as unknown as typeof window.matchMedia;
    try {
      render(<ClassicPanel />);
      const sheet = document.querySelector('[data-classic-panel]')!;
      expect(sheet.className).toContain('rounded-t-2xl');
      expect(sheet.className).toContain('inset-x-0');
      expect(screen.getByText(/Where am I on the map/)).toBeVisible();

      fireEvent.click(screen.getByRole('button', { name: 'Lower the Classic sheet' }));
      expect(screen.getByText(/Resection · swipe up to continue/)).toBeInTheDocument();
      expect(screen.getByText(/Where am I on the map/).closest('.hidden')).not.toBeNull();

      // Dragging up raises it again
      const handle = screen.getByRole('button', { name: 'Raise the Classic sheet' });
      fireEvent.touchStart(handle, { touches: [{ clientY: 700 }] });
      fireEvent.touchMove(handle, { touches: [{ clientY: 600 }] });
      fireEvent.touchEnd(handle);
      expect(screen.getByRole('button', { name: 'Lower the Classic sheet' })).toBeInTheDocument();
      expect(screen.getByText(/Where am I on the map/).closest('.hidden')).toBeNull();
    } finally {
      window.matchMedia = original;
    }
  });

  it('the panel can be minimized (desktop and phone)', () => {
    render(<ClassicPanel />);
    // The whole panel (desktop too): header only, then back
    fireEvent.click(screen.getByRole('button', { name: 'Minimize Classic' }));
    expect(screen.getByText(/Resection · expand to continue/)).toBeInTheDocument();
    expect(screen.getByText(/Where am I on the map/).closest('.hidden')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Expand Classic' }));
    expect(screen.getByText(/Where am I on the map/).closest('.hidden')).toBeNull();
  });

  it('How it works is hidden until opened', () => {
    render(<ClassicPanel />);
    expect(screen.queryByText(/Set your position on the map once/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'How it works' }));
    expect(screen.getByText(/Set your position on the map once/)).toBeInTheDocument();
    expect(screen.getByText(/Work out the back azimuth/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'How it works' }));
    expect(screen.queryByText(/Work out the back azimuth/)).not.toBeInTheDocument();
  });

  it('hand-set line lengths can be reset', () => {
    render(<ClassicPanel />);
    typePoint('Your position', hiker);
    expect(screen.queryByRole('button', { name: 'Reset line lengths' })).not.toBeInTheDocument();
    act(() => useClassicStore.getState().setLineLength('0:main', 2500));
    fireEvent.click(screen.getByRole('button', { name: 'Reset line lengths' }));
    expect(useClassicStore.getState().lineLengths).toEqual({});
  });

  it('each card can be hidden to one line and shown again', () => {
    render(<ClassicPanel />);
    typePoint('Your position', hiker);
    deg('Point A azimuth', 70);
    fireEvent.click(screen.getByRole('button', { name: 'Check point A azimuth' }));
    deg('Point A back azimuth', 250);
    fireEvent.click(screen.getByRole('button', { name: 'Check point A back azimuth' }));

    fireEvent.click(screen.getByRole('button', { name: 'Hide point A' }));
    expect(screen.queryByLabelText('Point A azimuth')).not.toBeInTheDocument();
    expect(card('Point A')).toHaveTextContent('Az 70° ENE · Back 250° WSW');
    // The other cards are not affected
    expect(screen.getByLabelText('Point B azimuth')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Show point A' }));
    expect(screen.getByLabelText('Point A azimuth')).toHaveValue('70');
  });

  it('Field Works: separate exercises per mode, added, switched, renamed and deleted', () => {
    act(() => useSurveyStore.setState({ user: { id: 'u1' }, subscriptionStatus: 'Pro', isAdmin: false } as never));
    render(<ClassicPanel />);
    const tabs = () => within(screen.getByRole('tablist', { name: 'Field Works' })).getAllByRole('tab').map((t) => t.textContent);
    expect(tabs()).toEqual(['Field Work 1']);
    typePoint('Your position', hiker);
    deg('Point A azimuth', 70);

    // A new Field Work starts empty; the first keeps its data
    fireEvent.click(screen.getByRole('button', { name: 'New' }));
    expect(tabs()).toEqual(['Field Work 1', 'Field Work 2']);
    expect(screen.getByLabelText('Point A azimuth')).toHaveValue('');
    fireEvent.click(screen.getByRole('tab', { name: 'Field Work 1' }));
    expect(screen.getByLabelText('Point A azimuth')).toHaveValue('70');

    // Rename
    fireEvent.click(screen.getByRole('button', { name: 'Rename Field Work 1' }));
    fireEvent.change(screen.getByLabelText('Field Work name'), { target: { value: 'Gede ridge' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(tabs()).toEqual(['Gede ridge', 'Field Work 2']);

    // Intersection has its own list; coming back finds the resection work as it was
    fireEvent.click(screen.getByRole('tab', { name: /intersection/i }));
    expect(tabs()).toEqual(['Field Work 1']);
    fireEvent.click(screen.getByRole('tab', { name: /resection/i }));
    expect(tabs()).toEqual(['Gede ridge', 'Field Work 2']);
    expect(screen.getByLabelText('Point A azimuth')).toHaveValue('70');

    // Delete (with confirmation) opens the next one
    fireEvent.click(screen.getByRole('button', { name: 'Delete Gede ridge' }));
    fireEvent.click(screen.getByRole('button', { name: 'Yes' }));
    expect(tabs()).toEqual(['Field Work 2']);
    // The last one is only cleared, never removed
    deg('Point A azimuth', 12);
    fireEvent.click(screen.getByRole('button', { name: 'Delete Field Work 2' }));
    expect(screen.getByText('Clear it?')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Yes' }));
    expect(tabs()).toEqual(['Field Work 2']);
    expect(screen.getByLabelText('Point A azimuth')).toHaveValue('');
  });

  it('Field Works are remembered in this browser', () => {
    act(() => {
      useClassicStore.getState().addFieldWork();
      useClassicStore.getState().updateSighting(0, { azimuth: '33' });
    });
    const saved = JSON.parse(localStorage.getItem('landscape360-classic')!).state;
    expect(saved.fieldWorks.resection.map((f: { name: string }) => f.name)).toEqual(['Field Work 1', 'Field Work 2']);
    expect(saved.sightings[0].azimuth).toBe('33');
    expect(saved).not.toHaveProperty('isPanelOpen');
  });

  it('Free accounts and guests keep one Field Work per mode', () => {
    act(() => useSurveyStore.setState({ user: { id: 'u1' }, subscriptionStatus: 'Free', isAdmin: false } as never));
    render(<ClassicPanel />);
    expect(screen.getByRole('button', { name: 'New' })).toBeDisabled();
    expect(screen.getByText(/Pro \(5\) and Enterprise \(10\) accounts can keep several Field Works/)).toBeInTheDocument();
  });

  it('Field Work limits: Pro 5 per mode, admin unlimited', () => {
    act(() => useSurveyStore.setState({ user: { id: 'u1' }, subscriptionStatus: 'Pro', isAdmin: false } as never));
    const { unmount } = render(<ClassicPanel />);
    for (let i = 0; i < 6; i++) fireEvent.click(screen.getByRole('button', { name: 'New' }));
    expect(useClassicStore.getState().fieldWorks.resection).toHaveLength(5);
    expect(screen.getByRole('button', { name: 'New' })).toBeDisabled();
    expect(screen.getByText(/Your Pro plan allows 5 Field Works in each mode/)).toBeInTheDocument();
    expect(screen.getByText(/5\/5 Field Works in Resection/)).toBeInTheDocument();
    unmount();

    act(() => useSurveyStore.setState({ subscriptionStatus: 'Enterprise', isAdmin: true } as never));
    render(<ClassicPanel />);
    for (let i = 0; i < 10; i++) fireEvent.click(screen.getByRole('button', { name: 'New' }));
    expect(useClassicStore.getState().fieldWorks.resection).toHaveLength(15);
    expect(screen.getByRole('button', { name: 'New' })).toBeEnabled();
  });

  it('your position card can be hidden to one line', () => {
    render(<ClassicPanel />);
    typePoint('Your position', hiker);
    fireEvent.click(screen.getByRole('button', { name: 'Hide your position' }));
    expect(screen.queryByLabelText('Your position latitude degrees')).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Your position' })).toHaveTextContent(/6°46'50\.88" S · 106°58'21\.36" E/);
    fireEvent.click(screen.getByRole('button', { name: 'Show your position' }));
    expect(screen.getByLabelText('Your position latitude degrees')).toHaveValue('6');
  });

  it('sharing: a link that always shows the latest version, and can be turned off', async () => {
    act(() => useSurveyStore.setState({ user: { id: 'u1' }, subscriptionStatus: 'Free', isAdmin: false } as never));
    render(<ClassicPanel />);
    fireEvent.click(screen.getByRole('button', { name: 'Share Field Work 1' }));
    fireEvent.click(screen.getByRole('button', { name: /Create link/ }));
    await waitFor(() => expect(screen.getByLabelText('Share link')).toHaveValue('https://landscape360.jcdigital.co.id/?classic=0123456789abcdef0123456789abcdef'));
    expect(share.saveFieldWorkLink).toHaveBeenCalledWith(expect.objectContaining({ token: null, mode: 'resection', name: 'Field Work 1' }));

    // An edit is saved to the same link shortly after
    vi.mocked(share.saveFieldWorkLink).mockClear();
    typePoint('Your position', hiker);
    await waitFor(
      () => expect(share.saveFieldWorkLink).toHaveBeenCalledWith(expect.objectContaining({ token: '0123456789abcdef0123456789abcdef' })),
      { timeout: 3000 },
    );

    fireEvent.click(screen.getByRole('button', { name: 'Stop sharing' }));
    await waitFor(() => expect(share.revokeFieldWorkLink).toHaveBeenCalledWith('0123456789abcdef0123456789abcdef'));
    await waitFor(() => expect(screen.getByRole('button', { name: /Create link/ })).toBeInTheDocument());
  });

  it('guests are asked to sign in to share', () => {
    act(() => useSurveyStore.setState({ user: null, subscriptionStatus: 'Free', isAdmin: false } as never));
    render(<ClassicPanel />);
    fireEvent.click(screen.getByRole('button', { name: 'Share Field Work 1' }));
    expect(screen.getByText('Sign in to share this Field Work.')).toBeInTheDocument();
  });

  it('a shared Field Work opens read only, without changing your own', () => {
    act(() => useClassicStore.getState().updateSighting(0, { azimuth: '12' }));
    act(() =>
      useClassicStore.getState().setViewing({
        token: '0123456789abcdef0123456789abcdef',
        mode: 'resection',
        name: 'Gede ridge',
        ownerName: 'Rizky',
        updatedAt: Date.parse('2026-10-30T06:00:00Z'),
        origin: useClassicStore.getState().origin,
        sightings: [
          { point: useClassicStore.getState().origin, azimuth: '70', back: '250', azChecks: 1, backChecks: 1 },
          { point: useClassicStore.getState().origin, azimuth: '300', back: '120', azChecks: 1, backChecks: 1 },
        ],
        lineLengths: {},
        declination: '0',
      }),
    );
    render(<ClassicPanel />);
    expect(screen.getByText('Shared · view only')).toBeInTheDocument();
    expect(screen.getByText('Gede ridge')).toBeInTheDocument();
    expect(screen.getByText(/shared by Rizky/)).toBeInTheDocument();
    // Nothing to type into
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Start over' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Close and open my own Classic' }));
    expect(useClassicStore.getState().viewing).toBeNull();
    expect(screen.getByLabelText('Point A azimuth')).toHaveValue('12');
  });
});
