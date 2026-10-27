import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AppShareButton } from './AppShareButton';

describe('AppShareButton', () => {
  it('opens a menu to send the app link on WhatsApp or copy it', async () => {
    const writeText = vi.fn(() => Promise.resolve());
    Object.assign(navigator, { clipboard: { writeText } });
    render(<AppShareButton />);
    fireEvent.click(screen.getByRole('button', { name: 'Share Landscape 360' }));

    const wa = decodeURIComponent(screen.getByRole('link', { name: /Send to WhatsApp/ }).getAttribute('href')!);
    expect(wa).toContain('Landscape 360 · Explore without Limits');
    expect(wa).toContain('https://landscape360.jcdigital.co.id/');

    fireEvent.click(screen.getByRole('button', { name: /Copy link/ }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('https://landscape360.jcdigital.co.id/'));
    expect(await screen.findByText('Link copied')).toBeInTheDocument();
  });
});
