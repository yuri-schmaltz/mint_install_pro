import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { indexCatalog } from '../services/catalogIndex';
import { useFilteredApps } from './useFilteredApps';

// O resultado esperado vem de conjuntos declarados para este catálogo de teste,
// sem consultar os índices ou reutilizar a função de produção como referência.
const index = indexCatalog([
  { id: 'vlc', name: 'VLC', packageType: 'APT', category: 'media', summary: 'sumtoken', description: 'desctoken', installed: true },
  { id: 'org.test.VLC', name: 'VLC', packageType: 'Flatpak', category: 'media', summary: 'sumtoken', description: 'desctoken', installed: false },
  { id: 'editor', name: 'Editor', packageType: 'APT', category: 'graphics', fullSummary: 'sumtoken', installed: false },
  { id: 'org.test.Paint', name: 'Paint', packageType: 'Flatpak', category: 'graphics', description: 'desctoken', installed: true }
]);
const all = ['vlc', 'org.test.VLC', 'editor', 'org.test.Paint'];
const installed = new Set(['vlc', 'org.test.Paint']);
const categoryIds = {
  all, media: ['vlc', 'org.test.VLC'], graphics: ['editor', 'org.test.Paint'],
  flatpak: ['org.test.VLC', 'org.test.Paint']
};
const formatIds = {
  all, apt: ['vlc', 'editor', 'org.test.Paint'], flatpak: ['org.test.VLC', 'editor', 'org.test.Paint']
};
const queries = ['', '   ', '  vLc  ', 'sumtoken', 'desctoken', 'inexistente'];
const cases = [];
for (const packageTypePreference of ['all', 'apt', 'flatpak']) {
  for (const searchInSummary of [false, true]) {
    for (const searchInDescription of [false, true]) {
      for (const searchInCategoryOnly of [false, true]) {
        for (const installedOnly of [false, true]) {
          for (const selectedCategory of Object.keys(categoryIds)) {
            for (const searchQuery of queries) {
              cases.push({ packageTypePreference, searchInSummary, searchInDescription,
                searchInCategoryOnly, installedOnly, selectedCategory, searchQuery });
            }
          }
        }
      }
    }
  }
}

describe('Matriz completa dos filtros para as opções disponíveis', () => {
  it.each(cases)('combinação %#: %j', filters => {
    const query = filters.searchQuery.trim().toLowerCase();
    const queryIds = {
      '': all, vlc: ['vlc', 'org.test.VLC'], inexistente: [],
      sumtoken: filters.searchInSummary ? ['vlc', 'org.test.VLC', 'editor'] : [],
      desctoken: filters.searchInDescription ? ['vlc', 'org.test.VLC', 'org.test.Paint'] : []
    };
    const scope = query && !filters.searchInCategoryOnly ? all : categoryIds[filters.selectedCategory];
    const expected = all.filter(id => queryIds[query].includes(id)
      && scope.includes(id) && formatIds[filters.packageTypePreference].includes(id)
      && (!filters.installedOnly || installed.has(id)));
    const { result } = renderHook(() => useFilteredApps(index.apps, index, {
      ...filters, settings: filters
    }));
    expect(result.current.map(app => app.id)).toEqual(expected);
  });
});
