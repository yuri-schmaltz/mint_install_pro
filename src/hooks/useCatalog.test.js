import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useCatalog } from './useCatalog';
import * as catalogService from '../services/catalog';

describe('useCatalog hook tests', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('carrega catálogo e sincroniza flatpaks com backend', async () => {
    const mockIndexed = {
      apps: [{ id: 'app1', name: 'App 1' }],
      byName: new Map(),
      countByCategory: new Map(),
      countByKind: new Map()
    };

    vi.spyOn(catalogService, 'getCachedIndex').mockReturnValue(null);
    vi.spyOn(catalogService, 'loadFullCatalog').mockResolvedValue(mockIndexed);

    globalThis.fetch = vi.fn().mockImplementation((url) => {
      if (url === '/api/installed') {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ apt: ['docker.io'], flatpaks: ['org.mozilla.firefox'], aptStatus: 'available', flatpakStatus: 'available' })
        });
      }
      return Promise.resolve({ ok: false, status: 404 });
    });

    const { result } = renderHook(() => useCatalog());

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.catalogIndex).toBe(mockIndexed);
    expect(result.current.flatpakStatus).toBe('available');
    expect(result.current.installedSnapshot.flatpaks).toEqual(['org.mozilla.firefox']);
  });

  it('identifica flatpak ausente sem perder o estado APT', async () => {
    vi.spyOn(catalogService, 'getCachedIndex').mockReturnValue({ apps: [] });

    globalThis.fetch = vi.fn().mockImplementation((url) => {
      if (url === '/api/installed') {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ apt: ['vlc'], flatpaks: [], aptStatus: 'available', flatpakStatus: 'missing' })
        });
      }
      return Promise.resolve({ ok: false, status: 404 });
    });

    const { result } = renderHook(() => useCatalog());

    await waitFor(() => {
      expect(result.current.flatpakStatus).toBe('missing');
    });

    expect(result.current.installedSnapshot.flatpaks).toEqual([]);
  });
});
