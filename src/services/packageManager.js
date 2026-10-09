import { debugLog } from './debugLog';

export function packageKind(app) {
  if (app.kind === 'apt' || app.kind === 'flatpak') return app.kind;
  const type = (app.packageType || '').toLowerCase();
  if (type.includes('apt')) return 'apt';
  return type.includes('flatpak') || app.flathub === true ? 'flatpak' : 'apt';
}

async function execute(action, app, onLog) {
  const kind = packageKind(app);
  onLog?.(`[${kind.toUpperCase()}] ${action === 'install' ? 'Instalando' : action === 'uninstall' ? 'Removendo' : 'Abrindo'} ${app.name} (${app.id})...`);
  debugLog('info', 'packageManager', action, { id: app.id, kind });
  try {
    const response = await fetch(`/api/${action}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: app.id, packageType: kind })
    });
    let result;
    try { result = await response.json(); } catch {
      throw new Error(`Resposta inválida do serviço de pacotes (HTTP ${response.status}).`);
    }
    if (!response.ok || result?.success !== true || result.simulated) {
      throw new Error(result?.error || result?.output || `Operação recusada (HTTP ${response.status}).`);
    }
    if (result.output) onLog?.(`[${kind.toUpperCase()}] ${result.output}`);
    return result;
  } catch (err) {
    const error = String(err?.message || err);
    debugLog('error', 'packageManager', action, { id: app.id, error });
    onLog?.(`[ERRO] ${error}`);
    return { success: false, error, output: error };
  }
}

export const executeInstall = (app, onLog) => execute('install', app, onLog);
export const executeUninstall = (app, onLog) => execute('uninstall', app, onLog);
export const executeLaunch = (app, onLog) => execute('launch', app, onLog);

export async function executeBatch(apps, onLog, onEvent) {
  const results = new Map();
  const handleEvent = event => {
    if (event.error) throw new Error(event.error);
    if (!Number.isInteger(event.index) || event.index < 0 || event.index >= apps.length) {
      throw new Error('Resposta inválida do serviço de pacotes.');
    }
    if (event.result) {
      if (results.has(event.index)) throw new Error('Resultado repetido no lote.');
      const result = { ...event.result, success: event.result.success === true && !event.result.simulated };
      results.set(event.index, result);
      if (result.output) onLog?.(`[${apps[event.index].name}] ${result.output}`);
      onEvent?.({ index: event.index, result });
    } else if (event.status === 'processing') {
      onEvent?.(event);
    } else {
      throw new Error('Evento inválido do serviço de pacotes.');
    }
  };
  try {
    onLog?.('[SISTEMA] Aguardando autorização única para as operações administrativas do lote...');
    const response = await fetch('/api/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ operations: apps.map(app => ({
        id: app.id, packageType: packageKind(app),
        action: app.batchAction || (app.installed ? 'uninstall' : 'install')
      })) })
    });
    if (!response.ok) {
      const result = await response.json();
      throw new Error(result?.error || `Operação recusada (HTTP ${response.status}).`);
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let pending = '';
    try {
      for (;;) {
        const { value, done } = await reader.read();
        pending += decoder.decode(value, { stream: !done });
        let newline;
        while ((newline = pending.indexOf('\n')) !== -1) {
          const line = pending.slice(0, newline);
          pending = pending.slice(newline + 1);
          if (line.trim()) handleEvent(JSON.parse(line));
        }
        if (done) break;
      }
      if (pending.trim()) handleEvent(JSON.parse(pending));
      if (results.size !== apps.length) throw new Error('A conexão terminou antes de concluir o lote. Consulte o estado do sistema.');
    } finally {
      reader.releaseLock();
    }
  } catch (err) {
    const error = String(err?.message || err);
    debugLog('error', 'packageManager', 'batch', { error });
    onLog?.(`[ERRO] ${error}`);
    apps.forEach((_app, index) => {
      if (!results.has(index)) {
        const result = { success: false, error, output: error };
        results.set(index, result);
        onEvent?.({ index, result });
      }
    });
  }
  return apps.map((_app, index) => results.get(index));
}
