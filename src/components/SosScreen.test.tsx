import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { SosScreen } from './SosScreen';
import { SosButton } from './SosButton';
import { useSurveyStore } from '../store/useSurveyStore';

vi.mock('../lib/supabaseClient', () => ({ supabase: {} }));
vi.mock('../utils/elevationUtils', () => ({ fetchTerrainRgbElevation: vi.fn(() => Promise.resolve(2958)) }));

const watchPosition = vi.fn();
beforeEach(() => {
  localStorage.clear();
  watchPosition.mockReset();
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: { watchPosition, clearWatch: vi.fn() },
  });
});

const giveFix = () =>
  act(() => {
    const success = watchPosition.mock.calls[0][0];
    success({ coords: { latitude: -6.78991, longitude: 106.9832, accuracy: 8, altitude: 2958 }, timestamp: Date.now() });
  });

// One second per act, so each tick is rendered before the next one is scheduled
const skipCountdown = () => {
  for (let i = 0; i < 6; i++) act(() => vi.advanceTimersByTime(1000));
};

describe('SosScreen', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('counts down first and can be cancelled', () => {
    const onClose = vi.fn();
    render(<SosScreen userId="u1" userName="Budi S." onClose={onClose} />);
    expect(screen.getByText('5')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('shows the GPS position in DMS, decimal and UTM once active', () => {
    render(<SosScreen userId="u1" userName="Budi S." onClose={vi.fn()} />);
    skipCountdown();
    expect(screen.getByText('S.O.S ACTIVE')).toBeInTheDocument();
    giveFix();
    expect(screen.getByText(/-6\.78991, 106\.98320/)).toBeInTheDocument();
    expect(screen.getByText(/^UTM /)).toBeInTheDocument();
    expect(screen.getByText('Elev 2958 m')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Emergency 112/ })).toHaveAttribute('href', 'tel:112');
    expect(screen.getByRole('link', { name: /Basarnas 115/ })).toHaveAttribute('href', 'tel:115');
  });

  it('adds emergency contacts and fills the SMS with the location', () => {
    render(<SosScreen userId="u1" userName="Budi S." onClose={vi.fn()} />);
    skipCountdown();
    giveFix();
    fireEvent.click(screen.getByText('Add SMS contacts'));
    fireEvent.change(screen.getByLabelText('Contact name'), { target: { value: 'Ibu' } });
    fireEvent.change(screen.getByLabelText('Contact phone'), { target: { value: '123' } });
    fireEvent.click(screen.getByTitle('Add contact'));
    expect(screen.getByText(/8 to 15 digits/)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Contact phone'), { target: { value: '0812-3456-7890' } });
    fireEvent.click(screen.getByTitle('Add contact'));
    const sms = screen.getByRole('link', { name: /SMS \(1\)/ }).getAttribute('href')!;
    expect(sms).toMatch(/^sms:081234567890[?&]body=/);
    expect(decodeURIComponent(sms)).toContain('Budi S. butuh bantuan');
    expect(decodeURIComponent(sms)).toContain('-6.78991,106.98320');
    // kept on the device for next time
    expect(JSON.parse(localStorage.getItem('l360-sos-contacts-u1')!)).toEqual([{ name: 'Ibu', phone: '0812-3456-7890' }]);
  });
});

describe('SosButton', () => {
  const setStore = (state: Record<string, unknown>) => useSurveyStore.setState(state as never);

  it('is hidden without S.O.S access', () => {
    setStore({ user: { id: 'u1', email: 'u@x.com', user_metadata: {} }, canUseSos: false, isAdmin: false });
    render(<SosButton />);
    expect(screen.queryByRole('button', { name: /S\.O\.S/ })).not.toBeInTheDocument();
  });

  it('shows for allowed accounts', () => {
    setStore({ user: { id: 'u1', email: 'u@x.com', user_metadata: {} }, canUseSos: true, isAdmin: false });
    render(<SosButton />);
    expect(screen.getByRole('button', { name: /S\.O\.S: hold for 3 seconds/ })).toBeInTheDocument();
  });

  it('is not on the map for the admin (it is in User Account)', () => {
    setStore({ user: { id: 'u1', email: 'u@x.com', user_metadata: {} }, canUseSos: true, isAdmin: true });
    render(<SosButton />);
    expect(screen.queryByRole('button', { name: /S\.O\.S/ })).not.toBeInTheDocument();
  });

  it('is hidden for guests', () => {
    setStore({ user: null, canUseSos: true, isAdmin: false });
    render(<SosButton />);
    expect(screen.queryByRole('button', { name: /S\.O\.S/ })).not.toBeInTheDocument();
  });
});
