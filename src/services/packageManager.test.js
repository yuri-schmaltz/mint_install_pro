import { describe, it, expect, vi, afterEach } from 'vitest';
import { executeInstall, executeUninstall, executeLaunch, executeBatch, packageKind } from './packageManager';

const app = { id: 'docker.io', name: 'Docker', kind: 'apt' };
afterEach(() => vi.unstubAllGlobals());
for (const [action, execute] of [['install', executeInstall], ['uninstall', executeUninstall], ['launch', executeLaunch]]) {
  describe(action, () => {
    it('usa o tipo explícito e retorna apenas sucesso confirmado', async () => {
      const fetch = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ success: true, output: 'ok' }) }));
      vi.stubGlobal('fetch', fetch);
      const log = vi.fn();
      expect((await execute(app, log)).success).toBe(true);
      expect(fetch).toHaveBeenCalledWith(`/api/${action}`, expect.objectContaining({ body: JSON.stringify({ id: 'docker.io', packageType: 'apt' }) }));
      expect(log).toHaveBeenCalledWith('[APT] ok');
    });
    it.each([400, 403, 429, 500, 503, 504])('HTTP %i nunca vira sucesso', async status => {
      vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status, json: async () => ({ error: 'recusado' }) })));
      expect(await execute(app)).toMatchObject({ success: false, error: 'recusado' });
    });
    it.each([{ success: false, output: 'erro do comando' }, {}, { success: true, simulated: true }])('rejeita resposta sem sucesso real: %j', async result => {
      vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => result })));
      expect((await execute(app)).success).toBe(false);
    });
    it('erro de rede é falha explícita', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
      expect(await execute(app)).toMatchObject({ success: false, error: 'offline' });
    });
    it('resposta inválida é falha explícita', async () => {
      vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => { throw new Error('HTML'); } })));
      expect((await execute(app)).success).toBe(false);
    });
  });
}
it('classifica pelo metadado, nunca pelo ponto no nome', () => {
  expect(packageKind({ id: 'dotnet-sdk-8.0', packageType: 'APT' })).toBe('apt');
  expect(packageKind({ id: 'org.test.App', kind: 'flatpak' })).toBe('flatpak');
  expect(packageKind({ id: 'org.test.App', packageType: 'Flatpak (Flathub)' })).toBe('flatpak');
});

describe('executeBatch', () => {
  const apps = [app, { id: 'org.test.App', name: 'Flatpak', kind: 'flatpak', batchAction: 'uninstall' }];
  const streamResponse = chunks => {
    const bytes = chunks.map(chunk => typeof chunk === 'string' ? new TextEncoder().encode(chunk) : chunk);
    const reader = { read: vi.fn(async () => bytes.length ? { value: bytes.shift(), done: false } : { done: true }), releaseLock: vi.fn() };
    return { ok: true, status: 200, body: { getReader: () => reader } };
  };

  it('envia uma única requisição para APT e Flatpak e recebe progresso incremental', async () => {
    const text = JSON.stringify({ index: 0, status: 'processing' }) + '\n' +
      JSON.stringify({ index: 1, result: { success: false, output: 'remoção falhou' } }) + '\n' +
      JSON.stringify({ index: 0, result: { success: true, output: 'instalado' } }) + '\n';
    const bytes = new TextEncoder().encode(text);
    const fetch = vi.fn(async () => streamResponse(Array.from(bytes, byte => new Uint8Array([byte]))));
    vi.stubGlobal('fetch', fetch);
    const onEvent = vi.fn(), onLog = vi.fn();
    expect(await executeBatch(apps, onLog, onEvent)).toEqual([
      { success: true, output: 'instalado' }, { success: false, output: 'remoção falhou' }
    ]);
    expect(fetch).toHaveBeenCalledOnce();
    expect(fetch).toHaveBeenCalledWith('/api/batch', expect.objectContaining({ body: JSON.stringify({ operations: [
      { id: 'docker.io', packageType: 'apt', action: 'install' },
      { id: 'org.test.App', packageType: 'flatpak', action: 'uninstall' }
    ] }) }));
    expect(onEvent).toHaveBeenCalledWith({ index: 0, status: 'processing' });
    expect(onLog).toHaveBeenCalledWith('[Flatpak] remoção falhou');
  });

  it.each([403, 429, 503])('HTTP %i falha para todos sem refazer a autorização', async status => {
    const fetch = vi.fn(async () => ({ ok: false, status, json: async () => ({ error: 'recusado' }) }));
    vi.stubGlobal('fetch', fetch);
    const onEvent = vi.fn();
    const results = await executeBatch(apps, undefined, onEvent);
    expect(results.every(result => result.success === false && result.error === 'recusado')).toBe(true);
    expect(fetch).toHaveBeenCalledOnce();
    expect(onEvent).toHaveBeenCalledTimes(2);
  });

  it('preserva sucessos recebidos e falha somente pendências quando a conexão termina cedo', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => streamResponse([
      JSON.stringify({ index: 0, result: { success: true } }) + '\n'
    ])));
    const onEvent = vi.fn();
    expect(await executeBatch(apps, undefined, onEvent)).toEqual([
      { success: true }, expect.objectContaining({ success: false, error: expect.stringContaining('antes de concluir') })
    ]);
    expect(onEvent).toHaveBeenCalledTimes(2);
  });

  it.each(['invalid JSON\n', '{"index":99,"result":{"success":true}}\n', '{"error":"pkexec ausente"}\n'])('stream inválido ou erro nunca vira sucesso: %s', async text => {
    vi.stubGlobal('fetch', vi.fn(async () => streamResponse([text])));
    expect((await executeBatch(apps)).every(result => result.success === false)).toBe(true);
  });

  it('resposta simulada nunca vira sucesso real', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => streamResponse([
      JSON.stringify({ index: 0, result: { success: true, simulated: true } }) + '\n'
    ])));
    expect((await executeBatch([app]))[0].success).toBe(false);
  });

  it('erro de rede marca todas as operações como falha', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    expect((await executeBatch(apps)).every(result => result.success === false && result.error === 'offline')).toBe(true);
  });
});
