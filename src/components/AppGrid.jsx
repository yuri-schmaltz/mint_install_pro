import React, { useState } from 'react';
import PropTypes from 'prop-types';
import AppCard from './AppCard';
import { useVirtualGrid } from '../hooks/useVirtualGrid';
import { 
  PackageOpen, 
  CheckSquare, 
  Square, 
  Boxes, 
  Search, 
  Loader2, 
} from 'lucide-react';

export default function AppGrid({
  apps,
  categoryTitle,
  searchQuery,
  installedOnly,
  onSelectApp,
  selectedAppIds = [],
  onToggleSelectApp,
  onSelectAllVisible,
  isAllVisibleSelected,
  selectedCategory,
  onSearchFlathubLive,
  isSearchingFlathub,
  isLoading = false,
  onVisibleAppsChange
}) {
  const [packageTypeFilter, setPackageTypeFilter] = useState('all'); // 'all' | 'apt' | 'flatpak'

  const isFlatpakTab = selectedCategory === 'flatpak';
  const isAllAppsTab = selectedCategory === 'all';

  // Secondary filter for "Todos os Aplicativos"
  const displayedApps = React.useMemo(() => apps.filter(app => {
    if (packageTypeFilter === 'apt') {
      return !app.flathub && app.packageType?.includes('APT');
    }
    if (packageTypeFilter === 'flatpak') {
      return app.flathub || app.packageType?.includes('Flatpak');
    }
    return true;
  }), [apps, packageTypeFilter]);

  React.useEffect(() => { onVisibleAppsChange?.(displayedApps); }, [displayedApps, onVisibleAppsChange]);

  const virtualGrid = useVirtualGrid(isLoading ? 0 : displayedApps.length,
    JSON.stringify([selectedCategory, searchQuery, installedOnly, packageTypeFilter]));
  const visibleApps = displayedApps.slice(virtualGrid.startIndex, virtualGrid.endIndex);
  const selectedIds = React.useMemo(() => new Set(selectedAppIds), [selectedAppIds]);

  const aptCount = apps.filter(a => !a.flathub).length;
  const flatpakCount = apps.filter(a => a.flathub || a.packageType?.includes('Flatpak')).length;

  return (
    <div 
      ref={virtualGrid.containerRef}
      onScroll={virtualGrid.onScroll}
      className="app-grid-scroll flex-1 min-h-0 overflow-y-auto px-5 py-4 bg-[#26292d] relative"
    >
      
      {/* Flathub Special Banner when on Flatpak Tab */}
      {isFlatpakTab && (
        <div className="mb-4 p-4 rounded-lg bg-gradient-to-r from-sky-950/80 via-[#233549] to-[#1e2733] border border-sky-500/30 shadow-md">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-lg bg-sky-500/20 flex items-center justify-center border border-sky-500/40 flex-shrink-0">
                <Boxes className="w-6 h-6 text-sky-400" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                  <span>Catálogo Oficial Flathub</span>
                  <span className="text-[10px] font-semibold px-2 py-0.2 rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/30">
                    Live API
                  </span>
                </h3>
                <p className="text-xs text-sky-200/70 mt-0.5">
                  Pesquise e instale qualquer aplicativo Flatpak disponível na plataforma Flathub mundial.
                </p>
              </div>
            </div>

            {/* Quick Live Flathub Trigger */}
            <div className="flex items-center space-x-2">
              <button
                onClick={() => onSearchFlathubLive && onSearchFlathubLive(searchQuery || 'browser')}
                disabled={isSearchingFlathub}
                className="px-3 py-1.5 rounded bg-sky-600 hover:bg-sky-500 text-white font-medium text-xs flex items-center space-x-1.5 transition-colors shadow-xs"
              >
                {isSearchingFlathub ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Buscando...</span>
                  </>
                ) : (
                  <>
                    <Search className="w-3.5 h-3.5" />
                    <span>Consultar Flathub Online</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Category Header with Select All Action and Type Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-3.5 pb-2 border-b border-[#32363c] gap-2">
        <div className="flex items-baseline space-x-2">
          <h2 className="text-[17px] font-semibold text-[#ffffff] tracking-normal">
            {searchQuery ? `Resultados para "${searchQuery}"` : categoryTitle}
          </h2>
          <span className="text-xs text-[#8e95a0] font-normal">
            ({displayedApps.length} {displayedApps.length === 1 ? 'aplicativo' : 'aplicativos'})
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Package Type Pills on "Todos os Aplicativos" */}
          {isAllAppsTab && (
            <div className="flex items-center space-x-1 bg-[#1e2024] p-0.5 rounded border border-[#32363c] text-xs">
              <button
                onClick={() => setPackageTypeFilter('all')}
                className={`px-2 py-0.5 rounded transition-colors ${
                  packageTypeFilter === 'all' 
                    ? 'bg-[#35393f] text-white font-medium' 
                    : 'text-[#8e95a0] hover:text-white'
                }`}
              >
                Todos ({apps.length})
              </button>
              <button
                onClick={() => setPackageTypeFilter('apt')}
                className={`px-2 py-0.5 rounded transition-colors ${
                  packageTypeFilter === 'apt' 
                    ? 'bg-[#35393f] text-[#87cf3e] font-medium' 
                    : 'text-[#8e95a0] hover:text-[#87cf3e]'
                }`}
              >
                APT ({aptCount})
              </button>
              <button
                onClick={() => setPackageTypeFilter('flatpak')}
                className={`px-2 py-0.5 rounded transition-colors ${
                  packageTypeFilter === 'flatpak' 
                    ? 'bg-[#35393f] text-sky-400 font-medium' 
                    : 'text-[#8e95a0] hover:text-sky-400'
                }`}
              >
                Flatpak ({flatpakCount})
              </button>
            </div>
          )}

          {/* Select all toggle button */}
          {displayedApps.length > 0 && onSelectAllVisible && (
            <button
              onClick={onSelectAllVisible}
              className="flex items-center space-x-1.5 text-xs text-[#a0a5ad] hover:text-[#87cf3e] transition-colors py-0.5 px-2 rounded hover:bg-[#35393f]"
              title={isAllVisibleSelected ? "Desmarcar todos da lista" : "Marcar todos da lista para instalação/desinstalação em lote"}
            >
              {isAllVisibleSelected ? (
                <CheckSquare className="w-3.5 h-3.5 text-[#87cf3e]" />
              ) : (
                <Square className="w-3.5 h-3.5 text-[#7d828c]" />
              )}
              <span>{isAllVisibleSelected ? "Desmarcar Todos" : "Marcar Todos"}</span>
            </button>
          )}

          {installedOnly && (
            <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-[#55b335]/20 text-[#68cf42] border border-[#55b335]/40">
              Filtro: Somente Instalados
            </span>
          )}
        </div>
      </div>

      {/* Skeleton de carregamento do catálogo */}
      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {[...Array(9)].map((_, i) => (
            <div
              key={`skel-${i}`}
              className="h-[74px] rounded-md bg-[#2a2d33] border border-[#2e3238] animate-pulse flex items-center px-3 space-x-3"
            >
              <div className="w-4 h-4 rounded bg-[#23262a]" />
              <div className="w-11 h-11 rounded bg-[#23262a]" />
              <div className="flex-1 space-y-2">
                <div className="h-3 bg-[#23262a] rounded w-2/3" />
                <div className="h-2.5 bg-[#23262a] rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Grid of 3 Columns matching Linux Mint Software Manager */}
      {!isLoading && displayedApps.length > 0 ? (
        <>
          <div
            ref={virtualGrid.gridRef}
            onFocusCapture={virtualGrid.onFocus}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5"
            style={{ paddingTop: virtualGrid.paddingTop, paddingBottom: virtualGrid.paddingBottom }}
          >
            {visibleApps.map((app) => (
              <AppCard 
                key={app.id} 
                app={app} 
                onClick={onSelectApp}
                isSelected={selectedIds.has(app.id)}
                onToggleSelect={onToggleSelectApp}
              />
            ))}
          </div>
        </>
      ) : (
        /* Empty State */
        <div className="flex flex-col items-center justify-center py-20 text-[#8e95a0]">
          <PackageOpen className="w-16 h-16 text-[#4a4f58] mb-3 stroke-[1.2]" />
          <p className="text-sm font-medium text-[#dcdcdc]">Nenhum aplicativo encontrado</p>
          <p className="text-xs text-[#7c828c] mt-1 max-w-sm text-center">
            {searchQuery 
              ? `Nenhum resultado correspondeu à sua pesquisa "${searchQuery}".`
              : 'Nenhum aplicativo disponível com os filtros atuais selecionados.'}
          </p>

          {isFlatpakTab && (
            <button
              onClick={() => onSearchFlathubLive && onSearchFlathubLive(searchQuery)}
              className="mt-4 px-4 py-1.5 rounded bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold transition-colors flex items-center space-x-1.5"
            >
              <Search className="w-3.5 h-3.5" />
              <span>Buscar &quot;{searchQuery || 'todos'}&quot; diretamente no Flathub</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

AppGrid.propTypes = {
  apps: PropTypes.array,
  categoryTitle: PropTypes.string,
  searchQuery: PropTypes.string,
  installedOnly: PropTypes.bool,
  onSelectApp: PropTypes.func,
  selectedAppIds: PropTypes.arrayOf(PropTypes.string),
  onToggleSelectApp: PropTypes.func,
  onSelectAllVisible: PropTypes.func,
  isAllVisibleSelected: PropTypes.bool,
  selectedCategory: PropTypes.string,
  onSearchFlathubLive: PropTypes.func,
  isSearchingFlathub: PropTypes.bool,
  flathubLiveQuery: PropTypes.string,
  flathubQueryCount: PropTypes.number,
  isLoading: PropTypes.bool,
  onVisibleAppsChange: PropTypes.func
};
