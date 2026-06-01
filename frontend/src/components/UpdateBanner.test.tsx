import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const updateApp = vi.fn();
const close = vi.fn();
let needRefresh = false;
let offlineReady = false;

vi.mock('../hooks/usePwaUpdate', () => ({
  usePwaUpdate: () => ({ needRefresh, offlineReady, updateApp, close }),
}));

import { UpdateBanner } from './UpdateBanner';

describe('UpdateBanner', () => {
  beforeEach(() => {
    updateApp.mockClear();
    close.mockClear();
    needRefresh = false;
    offlineReady = false;
  });

  it("n'affiche rien sans nouvelle version ni état offline", () => {
    const { container } = render(<UpdateBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  it('affiche le bandeau quand une nouvelle version est prête', () => {
    needRefresh = true;
    render(<UpdateBanner />);
    expect(screen.getByText(/nouvelle version/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /recharger/i })).toBeInTheDocument();
  });

  it('clic sur Recharger déclenche updateApp', () => {
    needRefresh = true;
    render(<UpdateBanner />);
    fireEvent.click(screen.getByRole('button', { name: /recharger/i }));
    expect(updateApp).toHaveBeenCalledTimes(1);
  });

  it('affiche un toast hors-ligne prête (offlineReady) sans bouton Recharger', () => {
    offlineReady = true;
    render(<UpdateBanner />);
    expect(screen.getByText(/hors-ligne/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /recharger/i })).not.toBeInTheDocument();
  });
});
