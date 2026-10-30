import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CompassDial } from './CompassDial';

const needle = () => document.querySelector('svg g:last-of-type') as SVGGElement;

describe('CompassDial', () => {
  it('shows the bearing and its compass point, and swings the short way round', () => {
    const { rerender } = render(<CompassDial value={350} label="Azimuth compass" />);
    expect(screen.getByText('350°')).toBeInTheDocument();
    expect(needle().style.transform).toBe('rotate(350deg)');
    // 350° -> 10° turns 20° clockwise, not 340° back
    rerender(<CompassDial value={10} label="Azimuth compass" />);
    expect(needle().style.transform).toBe('rotate(370deg)');
    expect(screen.getByText('10°')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Azimuth compass' })).toHaveAttribute('aria-valuetext', '10° N');
  });

  it('can be turned with the arrow keys and by dragging', () => {
    const onChange = vi.fn();
    render(<CompassDial value={90} onChange={onChange} label="Azimuth compass" />);
    const dial = screen.getByRole('slider', { name: 'Azimuth compass' });
    fireEvent.keyDown(dial, { key: 'ArrowRight' });
    expect(onChange).toHaveBeenLastCalledWith(91);
    fireEvent.keyDown(dial, { key: 'ArrowLeft', shiftKey: true });
    expect(onChange).toHaveBeenLastCalledWith(80);

    // A press below the centre points the needle south
    dial.getBoundingClientRect = () => ({ left: 0, top: 0, width: 100, height: 100, right: 100, bottom: 100, x: 0, y: 0, toJSON: () => '' });
    dial.setPointerCapture = () => undefined;
    fireEvent.pointerDown(dial, { clientX: 50, clientY: 95, pointerId: 1 });
    expect(onChange).toHaveBeenLastCalledWith(180);
    fireEvent.pointerMove(dial, { clientX: 5, clientY: 50, pointerId: 1 });
    expect(onChange).toHaveBeenLastCalledWith(270);
  });

  it('shows a dash when nothing is set, and ignores input when disabled', () => {
    const onChange = vi.fn();
    render(<CompassDial value={null} onChange={onChange} label="Back azimuth compass" disabled />);
    expect(screen.getByText('---°')).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole('slider'), { key: 'ArrowRight' });
    expect(onChange).not.toHaveBeenCalled();
  });
});
