import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  loadFullCatalog,
  getCachedIndex,
  invalidateCatalog
} from './catalog';

describe('catalog service tests', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    invalidateCatalog();
    vi.clearAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe('loadFullCatalog', () => {
    it('carrega catalog.json, indexa e retorna estrutura esperada', async () => {
      const mockRawApps = [
        { id: 'vlc', name: 'VLC Media Player', kind: 'apt', packageType: 'APT (Debian)', category: 'sound-video', summary: 'Reprodutor multimídia' },
        { id: 'org.blender.Blender', name: 'Blender', kind: 'flatpak', packageType: 'Flatpak (Flathub)', category: 'graphics', summary: '3D Studio', flathub: true }
      ];

      globalThis.fetch = vi.fn().mockImplementation((url) => {
        if (url.includes('/data/catalog.json')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => mockRawApps
          });
        }
        return Promise.resolve({ ok: false, status: 404 });
      });

      const indexed = await loadFullCatalog();
      expect(indexed.apps).toHaveLength(2);
      expect(indexed.byName.has('vlc media player')).toBe(true);
      expect(indexed.countByKind.get('apt')).toBe(1);
      expect(indexed.countByKind.get('flatpak')).toBe(1);

      // Idempotência: chamadas subsequentes usam o cache
      const cached = await loadFullCatalog();
      expect(cached).toBe(indexed);
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);

      // Funções síncronas
      expect(getCachedIndex()).toBe(indexed);
    });

    it('propaga falha no fetch e permite tentar novamente', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404
      });

      await expect(loadFullCatalog()).rejects.toThrow('HTTP 404');
      globalThis.fetch.mockResolvedValue({ ok: true, json: async () => [] });
      expect((await loadFullCatalog()).apps).toEqual([]);

      consoleErrorSpy.mockRestore();
    });
  });

});
