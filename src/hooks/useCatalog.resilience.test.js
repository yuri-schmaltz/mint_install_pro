import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useCatalog } from './useCatalog';

vi.mock('../services/catalog', () => ({
  getCachedIndex: () => ({ apps: [] }), loadFullCatalog: vi.fn()
}));
const snapshot = { apt: ['vlc'], flatpaks: [], aptStatus: 'available', flatpakStatus: 'available', protectedPackages: {} };
const response = data => ({ ok: true, json: async () => data });
beforeEach(() => vi.stubGlobal('fetch', vi.fn(async () => response(snapshot))));
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('Inventário instalado: falhas e concorrência', () => {
  it.each([
    null, {}, { ...snapshot, apt: null }, { ...snapshot, flatpaks: 'invalid' },
    { ...snapshot, aptStatus: 'unknown' }, { ...snapshot, flatpakStatus: 'unknown' }
  ])('recusa inventário incompleto %j e mantém o último válido', async invalid => {
    const { result } = renderHook(() => useCatalog());
    await waitFor(() => expect(result.current.installedSnapshot).toEqual(snapshot));
    fetch.mockResolvedValueOnce(response(invalid));
    await act(async () => { expect(await result.current.refreshInstalled()).toBeNull(); });
    expect(result.current.installedSnapshot).toEqual(snapshot);
    expect(result.current.installedError).not.toBe('');
    expect(result.current.flatpakStatus).toBe('unknown');
  });

  it.each([403, 429, 500, 503])('HTTP %i bloqueia operações até consulta válida posterior', async status => {
    fetch.mockResolvedValueOnce({ ok: false, status });
    const { result } = renderHook(() => useCatalog());
    await waitFor(() => expect(result.current.installedError).not.toBe(''));
    expect(result.current.installedSnapshot).toBeNull();
    await act(async () => result.current.refreshInstalled());
    expect(result.current.installedSnapshot).toEqual(snapshot);
    expect(result.current.installedError).toBe('');
  });

  it('uma resposta antiga não apaga um inventário mais recente', async () => {
    let resolveOld;
    fetch.mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve; }));
    const { result } = renderHook(() => useCatalog());
    const oldSignal = fetch.mock.calls[0][1].signal;
    await act(async () => result.current.refreshInstalled());
    expect(oldSignal.aborted).toBe(true);
    expect(result.current.installedSnapshot).toEqual(snapshot);
    await act(async () => resolveOld(response({ ...snapshot, apt: [] })));
    expect(result.current.installedSnapshot).toEqual(snapshot);
  });

  it('um erro antigo não invalida um inventário mais recente', async () => {
    let rejectOld;
    fetch.mockImplementationOnce(() => new Promise((_resolve, reject) => { rejectOld = reject; }));
    const { result } = renderHook(() => useCatalog());
    await act(async () => result.current.refreshInstalled());
    await act(async () => rejectOld(new Error('resposta antiga')));
    expect(result.current.installedError).toBe('');
    expect(result.current.installedSnapshot).toEqual(snapshot);
  });

  it('tempo limite aborta consulta, informa erro e permite recuperação', async () => {
    vi.useFakeTimers();
    fetch.mockImplementationOnce((_url, { signal }) => new Promise((_resolve, reject) => {
      signal.addEventListener('abort', () => reject(new DOMException('timeout', 'AbortError')));
    }));
    const { result } = renderHook(() => useCatalog());
    await act(async () => vi.advanceTimersByTimeAsync(15000));
    expect(result.current.installedError).toContain('tempo limite');
    await act(async () => result.current.refreshInstalled());
    expect(result.current.installedError).toBe('');
  });

  it('consulta ao recuperar foco e remove listeners e timers ao desmontar', async () => {
    vi.useFakeTimers();
    const { unmount } = renderHook(() => useCatalog());
    await act(async () => {});
    expect(fetch).toHaveBeenCalledTimes(1);
    await act(async () => window.dispatchEvent(new Event('focus')));
    expect(fetch).toHaveBeenCalledTimes(2);
    await act(async () => vi.advanceTimersByTimeAsync(30000));
    expect(fetch).toHaveBeenCalledTimes(3);
    unmount();
    const calls = fetch.mock.calls.length;
    await act(async () => {
      window.dispatchEvent(new Event('focus'));
      await vi.advanceTimersByTimeAsync(60000);
    });
    expect(fetch).toHaveBeenCalledTimes(calls);
  });
});
