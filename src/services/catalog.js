// Carregador lazy do catálogo de apps. Carrega o JSON sob demanda, pré-computa
// índices de busca (O(1) por nome, _haystack em lowercase) e cacheia em memória.
//
// Estratégia: fetch() direto a /data/catalog.json. Sem fallback estático
// para evitar que o Vite faça modulepreload do array de 1MB no carregamento
// inicial da página.

import { indexCatalog } from './catalogIndex.js';

let _indexed = null;       // { apps, byName, countByCategory, countByKind }
let _fullPromise = null;

/**
 * Carrega o catálogo completo + pré-computa índices. Idempotente.
 * Retorna `{ apps, byName, countByCategory, countByKind }`.
 *
 * @returns {Promise<import('./catalogIndex.js').CatalogIndex>}
 */
export async function loadFullCatalog() {
  if (_indexed) return _indexed;
  if (_fullPromise) return _fullPromise;
  _fullPromise = fetch('/data/catalog.json')
    .then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    })
    .then((rawApps) => {
      _indexed = indexCatalog(rawApps);
      return _indexed;
    })
    .catch((err) => {
      console.error('[catalog] Falha ao carregar catálogo:', err.message);
      _fullPromise = null;
      throw err;
    });
  return _fullPromise;
}

/**
 * Acesso SÍNCRONO ao índice completo (apps + byName + counts).
 */
export function getCachedIndex() {
  return _indexed;
}

/**
 * Invalida o cache para isolar os testes do serviço.
 */
export function invalidateCatalog() {
  _indexed = null;
  _fullPromise = null;
}
