import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { searchFlathub } from './flathubApi';

describe('flathubApi service tests', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe('searchFlathub', () => {
    it('retorna array vazio quando query é vazia ou só espaços', async () => {
      const fetchSpy = vi.fn();
      globalThis.fetch = fetchSpy;

      expect(await searchFlathub('')).toEqual([]);
      expect(await searchFlathub('   ')).toEqual([]);
      expect(await searchFlathub(null)).toEqual([]);
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('faz requisição POST com a query sanitizada e mapeia resposta', async () => {
      const mockResponse = {
        hits: [
          {
            app_id: 'org.blender.Blender',
            name: 'Blender',
            summary: '3D Creation Suite',
            description: '<p>Criação <b>3D</b> profissional</p>',
            icon: 'https://dl.flathub.org/repo/appstream/x86_64/icons/128x128/org.blender.Blender.png',
            developer_name: 'Blender Foundation',
            project_license: 'GPL-3.0'
          }
        ]
      };

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockResponse
      });

      const results = await searchFlathub('  blender  ');

      expect(globalThis.fetch).toHaveBeenCalledWith(
        'https://flathub.org/api/v2/search',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ query: 'blender' })
        })
      );

      expect(results).toHaveLength(1);
      const app = results[0];
      expect(app.id).toBe('org.blender.Blender');
      expect(app.name).toBe('Blender');
      expect(app.description).toBe('Criação 3D profissional');
      expect(app.category).toBe('flatpak');
      expect(app.flathub).toBe(true);
      expect(app.icon).toBe(mockResponse.hits[0].icon);
    });

    it('aplica fallbacks quando propriedades do hit estão ausentes', async () => {
      const mockResponse = {
        hits: [
          {
            id: 'com.simple.App'
          }
        ]
      };

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockResponse
      });

      const results = await searchFlathub('simple');
      expect(results).toHaveLength(1);
      const app = results[0];
      expect(app.id).toBe('com.simple.App');
      expect(app.name).toBe('com.simple.App');
      expect(app.summary).toBe('Aplicativo Flatpak no Flathub');
      expect(app.icon).toBe('/icons/software-manager.png');
      expect(app.developer).toBe('Flathub Publisher');
      expect(app.license).toBe('Open Source');
    });

    it('propaga erro HTTP para a interface', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500
      });

      await expect(searchFlathub('teste')).rejects.toThrow();
      consoleErrorSpy.mockRestore();
    });

    it('propaga erro de rede para a interface', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network disconnected'));

      await expect(searchFlathub('teste')).rejects.toThrow();
      consoleErrorSpy.mockRestore();
    });
  });

});
