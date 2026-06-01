import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// Spy partagé exposé par le mock du module virtuel.
const updateServiceWorker = vi.fn();
const setNeedRefresh = vi.fn();
const setOfflineReady = vi.fn();
let needRefreshValue = false;
let offlineReadyValue = false;

vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: () => ({
    needRefresh: [needRefreshValue, setNeedRefresh],
    offlineReady: [offlineReadyValue, setOfflineReady],
    updateServiceWorker,
  }),
}));

import { usePwaUpdate } from './usePwaUpdate';

describe('usePwaUpdate', () => {
  beforeEach(() => {
    updateServiceWorker.mockClear();
    setNeedRefresh.mockClear();
    setOfflineReady.mockClear();
    needRefreshValue = false;
    offlineReadyValue = false;
  });

  it('expose needRefresh = false par défaut', () => {
    const { result } = renderHook(() => usePwaUpdate());
    expect(result.current.needRefresh).toBe(false);
  });

  it('propage needRefresh = true', () => {
    needRefreshValue = true;
    const { result } = renderHook(() => usePwaUpdate());
    expect(result.current.needRefresh).toBe(true);
  });

  it('updateApp recharge en activant le nouveau SW', () => {
    const { result } = renderHook(() => usePwaUpdate());
    act(() => result.current.updateApp());
    expect(updateServiceWorker).toHaveBeenCalledWith(true);
  });

  it('close réinitialise les deux états', () => {
    const { result } = renderHook(() => usePwaUpdate());
    act(() => result.current.close());
    expect(setNeedRefresh).toHaveBeenCalledWith(false);
    expect(setOfflineReady).toHaveBeenCalledWith(false);
  });
});
