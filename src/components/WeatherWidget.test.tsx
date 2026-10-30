import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { WeatherWidget } from './WeatherWidget';
import { useMapStore } from '../store/useMapStore';

const TSV = [
  'code\tdesa\tkecamatan\tkabkota\tlat\tlon',
  '32.03.21.2001\tCibodas\tPacet\tCianjur\t-6.73890\t107.00250',
  '32.03.21.2002\tCiputri\tPacet\tCianjur\t-6.75120\t107.01980',
].join('\n');

const forecast = (desa: string, kecamatan: string, kotkab: string) => ({
  lokasi: { desa, kecamatan, kotkab },
  data: [
    {
      lokasi: { desa, kecamatan, kotkab },
      cuaca: [[{ local_datetime: '2026-10-30 12:00:00', t: 18, hu: 90, weather_desc: 'Hujan Ringan', ws: 5, wd: 'W', image: '' }]],
    },
  ],
});

let bmkg: (adm4: string) => object | null;

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      if (url.startsWith('/data/villages')) return new Response(TSV);
      const adm4 = new URL(url).searchParams.get('adm4')!;
      const body = bmkg(adm4);
      return new Response(JSON.stringify(body ?? { data: [] }));
    }),
  );
  // No location permission: the map centre is used
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: { getCurrentPosition: (_ok: unknown, fail: () => void) => fail() },
  });
});
afterEach(() => vi.unstubAllGlobals());

describe('WeatherWidget', () => {
  it('shows the forecast for the village nearest the map centre, not Jakarta', async () => {
    bmkg = (adm4) => (adm4 === '32.03.21.2001' ? forecast('Cibodas', 'Pacet', 'Cianjur') : null);
    useMapStore.setState({ showWeather: true, center: [107.005, -6.742] });
    render(<WeatherWidget />);
    expect(await screen.findByText('Cibodas, Pacet')).toBeInTheDocument();
    expect(screen.getByText('Cianjur · Map centre')).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith('https://api.bmkg.go.id/publik/prakiraan-cuaca?adm4=32.03.21.2001');
    // Only the village code goes to BMKG, never the position
    for (const [url] of vi.mocked(fetch).mock.calls) expect(String(url)).not.toMatch(/107\.005|6\.742/);
  });

  it('tries the next village when BMKG does not know the nearest, and refreshes on demand', async () => {
    bmkg = (adm4) => (adm4 === '32.03.21.2002' ? forecast('Ciputri', 'Pacet', 'Cianjur') : null);
    useMapStore.setState({ showWeather: true, center: [107.005, -6.742] });
    render(<WeatherWidget />);
    expect(await screen.findByText('Ciputri, Pacet')).toBeInTheDocument();

    // Move the map near Ciputri's neighbour and refresh
    bmkg = (adm4) => (adm4 === '32.03.21.2001' ? forecast('Cibodas', 'Pacet', 'Cianjur') : null);
    fireEvent.click(screen.getByRole('button', { name: 'Update the weather for my location' }));
    expect(await screen.findByText('Cibodas, Pacet')).toBeInTheDocument();
  });

  it('falls back to Jakarta Pusat outside the villages', async () => {
    bmkg = (adm4) => (adm4 === '31.71.03.1001' ? forecast('Kemayoran', 'Kemayoran', 'Kota Adm. Jakarta Pusat') : null);
    useMapStore.setState({ showWeather: true, center: [100, -10] });
    render(<WeatherWidget />);
    await waitFor(() => expect(screen.getByText(/Outside BMKG coverage · Jakarta Pusat/)).toBeInTheDocument());
  });
});
