import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import App from './App';

vi.mock('@vercel/analytics/react', () => ({ Analytics: () => <div data-testid="vercel-analytics" /> }));
vi.mock('@vercel/speed-insights/react', () => ({ SpeedInsights: () => <div data-testid="speed-insights" /> }));
vi.mock('./components/LoadingOverlay', () => ({ LoadingOverlay: () => <div>Start Your Journey</div> }));
vi.mock('./components/MapDashboard', () => ({ MapDashboard: () => <div>Map</div> }));

const renderAt = (path: string) =>
  render(
    <HelmetProvider>
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>
    </HelmetProvider>,
  );

describe('App', () => {
  it('shows the start screen for the map only', () => {
    renderAt('/');
    expect(screen.getByText('Start Your Journey')).toBeInTheDocument();
  });

  it.each([
    ['/faq', /FAQ/],
    ['/terms', /Terms & Conditions/],
    ['/privacy', /Privacy Policy/],
  ])('opens %s directly without the start screen', async (path, heading) => {
    renderAt(path);
    expect(await screen.findByRole('heading', { name: heading, level: 1 })).toBeInTheDocument();
    expect(screen.queryByText('Start Your Journey')).not.toBeInTheDocument();
    expect(screen.getByTestId('vercel-analytics')).toBeInTheDocument();
  });

  it('links every content page from the footer, without cookie settings', async () => {
    renderAt('/terms');
    await screen.findByRole('heading', { name: /Terms & Conditions/, level: 1 });
    const footer = screen.getByRole('navigation', { name: 'Site' });
    for (const name of ['Documentation', 'Reviews', 'FAQ', 'Terms & Conditions', 'Privacy Policy']) {
      expect(footer).toContainElement(screen.getAllByRole('link', { name }).at(-1)!);
    }
    expect(screen.queryByText(/Cookie settings/)).not.toBeInTheDocument();
  });
});
