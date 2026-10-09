// debugLog.js — logger persistente com ring buffer no localStorage.
// Captura logs de diagnóstico
// de execução em campo mesmo após crash do React (que mata o console).
//
// Uso típico:
//   import { debugLog, getDebugSnapshot, clearDebug } from './services/debugLog';
//   debugLog('info', 'BatchActionModal', 'mount', { apps: 4 });
//
// Chave de storage: mip_debug_log_v1 (mip = Mint Install Pro)
// Limite: 200 entradas (ring buffer FIFO). Configurável via RING_SIZE.
//
// Em ambientes sem localStorage (test runner, SSR) cai para console.* sem
// quebrar.

const STORAGE_KEY = 'mip_debug_log_v1';
const RING_SIZE = 200;

/**
 * Verifica se localStorage está disponível e funcional. Em testes
 * (vitest+jsdom) está disponível mas o uso é reset entre testes.
 */
function safeLocalStorageAvailable() {
  try {
    if (typeof localStorage === 'undefined') return false;
    const probe = '__mip_debug_probe__';
    localStorage.setItem(probe, '1');
    localStorage.removeItem(probe);
    return true;
  } catch (_) {
    return false;
  }
}

const hasLS = safeLocalStorageAvailable();

/**
 * Lê o ring buffer atual. Retorna [] em qualquer falha.
 */
function readRing() {
  if (!hasLS) return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

/**
 * Escreve o ring buffer. Trunca para RING_SIZE (FIFO).
 */
function writeRing(entries) {
  if (!hasLS) return;
  try {
    const truncated = entries.length > RING_SIZE
      ? entries.slice(entries.length - RING_SIZE)
      : entries;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(truncated));
  } catch (_) {
    // localStorage cheio ou indisponível — descarta silenciosamente.
  }
}

/**
 * Loga uma entrada. Níveis: 'debug' | 'info' | 'warn' | 'error'.
 * Componente é o "module/tag", message é descrição curta, data é opcional.
 */
export function debugLog(level, component, message, data) {
  const entry = {
    t: new Date().toISOString(),
    lvl: level || 'info',
    cmp: component || '?',
    msg: String(message || ''),
    data: data === undefined ? null : safeClone(data)
  };

  // Espelha no console pra devs locais
  const line = `[${entry.t}] [${entry.lvl.toUpperCase()}] [${entry.cmp}] ${entry.msg}`;
  if (entry.lvl === 'error') {
    console.error(line, entry.data ?? '');
  } else if (entry.lvl === 'warn') {
    console.warn(line, entry.data ?? '');
  } else {
    console.log(line, entry.data ?? '');
  }

  // Persiste no ring buffer
  const ring = readRing();
  ring.push(entry);
  writeRing(ring);
}

/**
 * Retorna snapshot completo: { entries, emergencyLog, lastReactError }.
 * emergencyLog é populado por window.onerror/unhandledrejection no main.jsx.
 * lastReactError é populado pelo ErrorBoundary.
 */
export function getDebugSnapshot() {
  const out = {
    entries: readRing(),
    emergencyLog: [],
    lastReactError: null,
    timestamp: new Date().toISOString()
  };
  if (hasLS) {
    try {
      const em = localStorage.getItem('mip_emergency_log');
      if (em) out.emergencyLog = JSON.parse(em);
    } catch (_) { /* ignore */ }
    try {
      const re = localStorage.getItem('mip_last_error');
      if (re) out.lastReactError = JSON.parse(re);
    } catch (_) { /* ignore */ }
  }
  return out;
}

/**
 * Limpa todos os logs. Útil após análise em campo.
 */
export function clearDebug() {
  if (!hasLS) return;
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem('mip_emergency_log');
    localStorage.removeItem('mip_last_error');
  } catch (_) { /* ignore */ }
}

/**
 * Persiste uma entrada de emergency (window.onerror/unhandledrejection).
 * Chamado pelo main.jsx, separado do debugLog para evitar loops.
 */
export function pushEmergencyLog(kind, info) {
  if (!hasLS) return;
  try {
    const raw = localStorage.getItem('mip_emergency_log');
    const arr = raw ? JSON.parse(raw) : [];
    arr.push({
      t: new Date().toISOString(),
      kind,
      info: safeClone(info)
    });
    // Mantém últimas 50 entradas
    const truncated = arr.length > 50 ? arr.slice(arr.length - 50) : arr;
    localStorage.setItem('mip_emergency_log', JSON.stringify(truncated));
  } catch (_) { /* ignore */ }
}

/**
 * Persiste último erro do React (chamado pelo ErrorBoundary).
 */
export function pushLastReactError(error, componentStack) {
  if (!hasLS) return;
  try {
    localStorage.setItem('mip_last_error', JSON.stringify({
      t: new Date().toISOString(),
      message: String(error?.message || error || ''),
      stack: String(error?.stack || '').slice(0, 2000),
      componentStack: String(componentStack || '').slice(0, 4000)
    }));
  } catch (_) { /* ignore */ }
}

function safeClone(v) {
  // Tenta serializar; em falha, converte para string.
  try {
    return JSON.parse(JSON.stringify(v));
  } catch (_) {
    return String(v);
  }
}