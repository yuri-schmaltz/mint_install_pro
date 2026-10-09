import { afterEach, describe, expect, it, vi } from 'vitest';
import { executeBatch } from './packageManager';

vi.mock('./debugLog', () => ({ debugLog: vi.fn() }));
const apps = [
  { id: 'vlc', name: 'VLC', kind: 'apt', installed: false },
  { id: 'gimp', name: 'GIMP', kind: 'apt', installed: true },
  { id: 'org.test.App', name: 'Teste', kind: 'flatpak', batchAction: 'install' }
];

function respond(lines, size = 65536, failAfterChunks = Infinity) {
  const bytes = new TextEncoder().encode(lines);
  let offset = 0, chunks = 0;
  const reader = {
    read: vi.fn(async () => {
      if (chunks++ === failAfterChunks) throw new Error('Conexão interrompida');
      if (offset >= bytes.length) return { done: true };
      const value = bytes.slice(offset, offset + size);
      offset += size;
      return { done: false, value };
    }),
    releaseLock: vi.fn()
  };
  const fetch = vi.fn(async () => ({ ok: true, status: 200, body: { getReader: () => reader } }));
  vi.stubGlobal('fetch', fetch);
  return { reader, fetch };
}
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });

describe('Lote: fragmentação e integridade do protocolo', () => {
  const cases = [];
  for (const size of [1, 2, 3, 7, 64, 65536]) {
    for (const ending of ['\n', '\r\n', '']) {
      for (const order of [[0, 1, 2], [2, 0, 1]]) cases.push({ size, ending, order });
    }
  }
  it.each(cases)('decodifica Unicode e preserva ordem dos resultados: %j', async ({ size, ending, order }) => {
    const results = [
      { success: true, output: 'Instalação concluída ✓ 🐧' },
      { success: false, output: 'Remoção recusada: dependência' },
      { success: true, output: 'Aplicação instalada' }
    ];
    const separator = ending || '\n';
    const text = '\n \n' + order.map(index => JSON.stringify({ index, result: results[index] })).join(separator) + ending;
    const { reader, fetch } = respond(text, size);
    const onEvent = vi.fn();
    expect(await executeBatch(apps, undefined, onEvent)).toEqual(results);
    expect(onEvent.mock.calls.map(([event]) => event.index)).toEqual(order);
    expect(fetch).toHaveBeenCalledOnce();
    expect(reader.releaseLock).toHaveBeenCalledOnce();
  });

  it.each([
    'null', '[]', 'true', '{}', 'invalid',
    '{"index":-1,"result":{"success":true}}',
    '{"index":3,"result":{"success":true}}',
    '{"index":0.5,"result":{"success":true}}',
    '{"index":"0","result":{"success":true}}',
    '{"index":0,"status":"unknown"}',
    '{"error":"Autorização cancelada"}'
  ])('evento inválido %s falha em todas as pendências e libera leitor', async line => {
    const { reader, fetch } = respond(line + '\n');
    const onEvent = vi.fn();
    const results = await executeBatch(apps, undefined, onEvent);
    expect(results).toHaveLength(3);
    expect(results.every(result => result.success === false)).toBe(true);
    expect(onEvent).toHaveBeenCalledTimes(3);
    expect(reader.releaseLock).toHaveBeenCalledOnce();
    expect(fetch).toHaveBeenCalledOnce();
  });

  it.each([{}, { success: 'true' }, { success: 1 }, { success: true, simulated: true }, { success: false }])(
    'somente success booleano e não simulado confirma a operação: %j', async result => {
      respond(JSON.stringify({ index: 0, result }));
      expect((await executeBatch([apps[0]]))[0].success).toBe(false);
    });

  it.each(['invalid\n', '{"index":0,"result":{"success":false}}\n', ''])('erro depois de sucesso confirmado preserva somente esse sucesso: %s', async suffix => {
    respond(JSON.stringify({ index: 0, result: { success: true } }) + '\n' + suffix);
    const result = await executeBatch(apps);
    expect(result[0]).toEqual({ success: true });
    expect(result.slice(1).every(item => item.success === false)).toBe(true);
  });

  it('interrupção durante read preserva conclusões e não repete requisição', async () => {
    const line = JSON.stringify({ index: 1, result: { success: true } }) + '\n';
    const { reader, fetch } = respond(line, 65536, 1);
    const results = await executeBatch(apps);
    expect(results[1]).toEqual({ success: true });
    expect(results[0]).toMatchObject({ success: false, error: 'Conexão interrompida' });
    expect(results[2]).toMatchObject({ success: false, error: 'Conexão interrompida' });
    expect(fetch).toHaveBeenCalledOnce();
    expect(reader.releaseLock).toHaveBeenCalledOnce();
  });

  it.each([
    { ok: true, body: null },
    { ok: false, status: 502, json: async () => { throw new Error('HTML inválido'); } }
  ])('resposta sem stream ou JSON nunca confirma instalações', async response => {
    vi.stubGlobal('fetch', vi.fn(async () => response));
    expect((await executeBatch(apps)).every(result => result.success === false)).toBe(true);
  });

  it('aceita o limite de 500 resultados em uma requisição e sem perda de eventos', async () => {
    const targets = Array.from({ length: 500 }, (_, index) => ({ id: `pkg-${index}`, name: `Pacote ${index}`, kind: 'apt' }));
    const lines = targets.map((_app, index) => JSON.stringify({ index, result: { success: true } })).join('\n');
    const { fetch } = respond(lines, 17);
    const onEvent = vi.fn();
    const results = await executeBatch(targets, undefined, onEvent);
    expect(results).toHaveLength(500);
    expect(results.every(result => result.success === true)).toBe(true);
    expect(onEvent).toHaveBeenCalledTimes(500);
    expect(fetch).toHaveBeenCalledOnce();
  });
});
