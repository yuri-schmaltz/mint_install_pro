import React, { useState, useEffect, useCallback, useMemo, useRef, Suspense, lazy } from 'react';
import HeaderBar from './components/HeaderBar';
import CategoryNav from './components/CategoryNav';
import AppGrid from './components/AppGrid';
import LandingPage from './components/LandingPage';
import BatchActionBar from './components/BatchActionBar';
import ToastContainer, { pushToast } from './components/Toast';
import { indexCatalog } from './services/catalogIndex';

// Modais em chunks lazy. Resolve débito #17: cada modal fica em chunk
// próprio (~5-15KB), só baixa quando o usuário abre. Bundle inicial cai
// ~40KB (3 modais x ~13KB médio).
const AppDetailsModal = lazy(() => import('./components/AppDetailsModal'));
const SettingsModal = lazy(() => import('./components/SettingsModal'));

// BatchActionModal fica eager (import direto) — estávamos tendo um problema
// onde o chunk lazy demorava 50-200ms no GTK WebView e, durante esse
// intervalo, o React renderizava um Suspense fallback=null sem overlay
// visível, dando a impressão de "tela cinza vazia" ao usuário. O custo
// de bundle é de ~6KB gzipped (pequeno, vale a previsibilidade).
import BatchActionModal from './components/BatchActionModal';
import { categoriesList } from './data/categoriesList';
import { searchFlathub } from './services/flathubApi';
import { useInstalledMap } from './hooks/useInstalledMap';
import { useCatalog } from './hooks/useCatalog';
import { useFilteredApps } from './hooks/useFilteredApps';
import { useBatchSelection } from './hooks/useBatchSelection';
import { useNavigation } from './hooks/useNavigation';
import { debugLog } from './services/debugLog';
import { packageKind } from './services/packageManager';

const SETTINGS_KEY = 'mint_settings_v1';

const defaultSettings = {
  searchInSummary: true,
  searchInDescription: true,
  searchInCategoryOnly: false,
  enableFlathubLive: true,
  allowUnverifiedFlatpaks: false,
  packageTypePreference: 'all',
  confirmBatchAction: true,
};

export default function App() {
  // === Catalog + flatpak integration ===
  const { catalogIndex: localIndex, loading: catalogLoading, catalogError, flatpakStatus, installedSnapshot, installedError, refreshInstalled } = useCatalog();
  const [onlineApps, setOnlineApps] = useState([]);
  const catalogIndex = useMemo(() => {
    if (!localIndex) return null;
    if (!onlineApps.length) return localIndex;
    const merged = new Map(localIndex.apps.map(app => [app.id, app]));
    for (const app of onlineApps) merged.set(app.id, { ...merged.get(app.id), ...app });
    return indexCatalog([...merged.values()]);
  }, [localIndex, onlineApps]);

  // === Installed state with debounced localStorage ===
  const installedMap = useInstalledMap();

  const { replace: replaceInstalled } = installedMap;
  useEffect(() => {
    if (installedSnapshot) replaceInstalled([...installedSnapshot.apt, ...installedSnapshot.flatpaks]);
  }, [installedSnapshot, replaceInstalled]);
  const operationsAvailable = !!installedSnapshot && !installedError;

  // App array derivado de catalogIndex + installedMap
  const apps = useMemo(() => {
    if (!catalogIndex) return [];
    return installedMap.applyToApps(catalogIndex.apps, false).map(app => ({
      ...app,
      removalProtection: packageKind(app) === 'apt' ? installedSnapshot?.protectedPackages?.[app.id] || '' : ''
    }));
  }, [catalogIndex, installedMap, installedSnapshot]);

  // === Settings (localStorage) ===
  const [settings, setSettings] = useState(() => {
    try {
      const saved = localStorage.getItem(SETTINGS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        delete parsed.associateMimeTypes;
        delete parsed.isDefaultPackageManager;
        return { ...defaultSettings, ...parsed };
      }
    } catch (e) {
      console.error('Error loading settings', e);
    }
    return defaultSettings;
  });

  const handleSaveSettings = useCallback((newSettings) => {
    setSettings(newSettings);
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(newSettings));
    } catch (e) {
      console.error('Error saving settings', e);
    }
  }, []);

  // === UI state: search, installedOnly, selectedApp, isSettingsOpen ===
  const [searchQuery, setSearchQuery] = useState('');
  const [installedOnly, setInstalledOnly] = useState(false);
  const [selectedApp, setSelectedApp] = useState(null);
  const [detailsBusy, setDetailsBusy] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // === Navigation (currentView, selectedCategory, navHistory) ===
  const nav = useNavigation('picks');
  const { selectedCategory, canGoBack } = nav;

  // Quando searchQuery muda, marca search como ativo no nav (afeta isLandingVisible)
  useEffect(() => {
    nav.setSearch(!!searchQuery.trim());
  }, [searchQuery, nav]);

  // Only the latest live query may update the visible catalog.
  const [isSearchingFlathub, setIsSearchingFlathub] = useState(false);
  const [flathubError, setFlathubError] = useState('');
  const searchController = useRef(null);
  const handleSearchFlathubLive = useCallback(async (term) => {
    if (!settings.enableFlathubLive) return;
    const q = (term || searchQuery || 'browser').trim();
    searchController.current?.abort();
    const controller = new AbortController();
    searchController.current = controller;
    setIsSearchingFlathub(true);
    setFlathubError('');
    try {
      const hits = await searchFlathub(q, { signal: controller.signal });
      if (!controller.signal.aborted) {
        setOnlineApps(hits.filter(app => settings.allowUnverifiedFlatpaks || app.verified));
      }
    } catch (err) {
      if (!controller.signal.aborted) {
        setOnlineApps([]);
        setFlathubError(err.message || 'Falha ao consultar o Flathub.');
      }
    } finally {
      if (!controller.signal.aborted) setIsSearchingFlathub(false);
    }
  }, [settings.enableFlathubLive, settings.allowUnverifiedFlatpaks, searchQuery]);

  useEffect(() => {
    setOnlineApps([]);
    setFlathubError('');
    setIsSearchingFlathub(false);
    if (settings.enableFlathubLive && selectedCategory === 'flatpak' && searchQuery.trim().length >= 3) {
      const timer = setTimeout(() => handleSearchFlathubLive(searchQuery), 500);
      return () => { clearTimeout(timer); searchController.current?.abort(); };
    }
    return () => searchController.current?.abort();
  }, [searchQuery, selectedCategory, settings.enableFlathubLive, handleSearchFlathubLive]);

  // === Filtered apps (uses catalogIndex byName + _haystack) ===
  const filteredApps = useFilteredApps(apps, catalogIndex, {
    searchQuery, selectedCategory, installedOnly, settings
  });

  // === Batch selection ===
  const [gridApps, setGridApps] = useState([]);
  const batch = useBatchSelection(gridApps, apps, installedMap.isInstalled);
  const {
    selectedAppIds, toInstallApps, toUninstallApps,
    isAllVisibleSelected, toggleApp: handleToggleSelectApp,
    selectAllVisible: handleSelectAllVisible, clearSelection: handleClearSelection,
    removeFromSelection
  } = batch;

  // === Handlers composing the hooks ===
  const { setInstalled } = installedMap;
  const handleToggleInstall = useCallback((appId, value) => {
    if (typeof value === 'boolean') setInstalled(appId, value);
    refreshInstalled();
  }, [setInstalled, refreshInstalled]);

  const [batchModal, setBatchModal] = useState(null);
  const handleStartBatchExecution = useCallback(() => {
    if (!operationsAvailable) {
      pushToast('Atualize a lista de instalados antes de executar operações.', 'error');
      return;
    }
    const all = batch.selectedAppsList;
    if (all.length === 0) return;
    const appsToProcess = all.map((app) => ({
      ...app,
      batchAction: installedMap.isInstalled(app.id) ? 'uninstall' : 'install'
    }));
    debugLog('info', 'App', 'Iniciando batch execution', {
      total: appsToProcess.length,
      ids: appsToProcess.map((a) => a.id)
    });
    setBatchModal({ type: 'mixed', apps: appsToProcess });
  }, [batch.selectedAppsList, operationsAvailable, installedMap]);

  const handleBatchComplete = useCallback(({ installedIds = [], uninstalledIds = [] } = {}) => {
    for (const id of installedIds) setInstalled(id, true);
    for (const id of uninstalledIds) setInstalled(id, false);
    removeFromSelection([...installedIds, ...uninstalledIds]);
    refreshInstalled();
  }, [setInstalled, removeFromSelection, refreshInstalled]);

  // === Toggles composed ===
  const handleToggleInstalledOnly = useCallback(() => {
    setSearchQuery('');
    setInstalledOnly((prev) => {
      const next = !prev;
      if (next) {
        nav.goToPicks();
        nav.selectCategory('all');
      } else if (selectedCategory === 'all' || selectedCategory === 'picks') {
        nav.goToPicks();
      }
      return next;
    });
  }, [nav, selectedCategory]);

  const handleSelectCategory = useCallback((catId) => {
    setSearchQuery('');
    nav.selectCategory(catId);
    setInstalledOnly(false);
  }, [nav]);

  const handleBack = useCallback(() => {
    if (searchQuery) {
      setSearchQuery('');
      return;
    }
    nav.goBack();
  }, [nav, searchQuery]);

  // === Derived UI values ===
  const categoryTitle = useMemo(() => {
    if (searchQuery) return 'Resultados da Pesquisa';
    if (installedOnly) return 'Aplicativos Instalados';
    const cat = categoriesList.find((c) => c.id === selectedCategory);
    return cat ? cat.label : 'Início';
  }, [selectedCategory, searchQuery, installedOnly]);

  const installedCount = useMemo(
    () => apps.filter((a) => a.installed).length,
    [apps]
  );

  // Log estruturado de mudanças de UI state — útil pra debug remoto
  useEffect(() => {
    debugLog('debug', 'App', 'render', {
      selectedCategory,
      installedOnly,
      searchQuery: searchQuery ? searchQuery.slice(0, 30) : '',
      selectedCount: selectedAppIds.length,
      batchModal: batchModal ? { type: batchModal.type, count: batchModal.apps.length } : null,
      catalogLoading,
      catalogCount: catalogIndex?.apps?.length ?? 0
    });
  });

  const handleClearCache = useCallback(() => {
    installedMap.clear();
    window.location.reload();
  }, [installedMap]);

  // === Keyboard shortcuts globais (resolve débito #15) ===
  useEffect(() => {
    const onKey = (e) => {
      // Esc fecha modais OU limpa seleção
      if (e.key === 'Escape') {
        if (selectedApp) {
          if (!detailsBusy) setSelectedApp(null);
          e.preventDefault();
          return;
        }
        if (isSettingsOpen) {
          setIsSettingsOpen(false);
          e.preventDefault();
          return;
        }
        if (batchModal) {
          // Não fechamos batch mid-flight (precisa terminar); só limpa seleção
          if (selectedAppIds.length > 0) {
            handleClearSelection();
            e.preventDefault();
          }
          return;
        }
        if (selectedAppIds.length > 0) {
          handleClearSelection();
          e.preventDefault();
        }
        return;
      }
      // Ctrl+A (ou Cmd+A no Mac): seleciona todos os visíveis
      if ((e.ctrlKey || e.metaKey) && e.key === 'a' && !searchQuery) {
        // Não intercepta se o foco está num input/textarea
        const tag = e.target?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA') return;
        if (gridApps.length > 0) {
          handleSelectAllVisible();
          e.preventDefault();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [
    selectedApp, detailsBusy, isSettingsOpen, batchModal, selectedAppIds,
    handleClearSelection, handleSelectAllVisible, searchQuery, gridApps
  ]);

  return (
    <div className="w-full h-screen bg-[#26292d] flex flex-col overflow-hidden relative select-none">
      <HeaderBar
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        canGoBack={canGoBack || !!searchQuery}
        onBack={handleBack}
        onOpenSettings={() => setIsSettingsOpen(true)}
        flatpakStatus={flatpakStatus}
      />

      <CategoryNav
        categories={categoriesList}
        selectedCategory={searchQuery ? '' : selectedCategory}
        onSelectCategory={handleSelectCategory}
        installedOnly={installedOnly}
        onToggleInstalledOnly={handleToggleInstalledOnly}
        installedCount={installedCount}
      />

      {!installedSnapshot && !installedError && <div role="status" className="px-5 py-2 text-sm text-[#a4a9b2]">Consultando os pacotes instalados...</div>}
      {(catalogError || installedError) && <div role="alert" className="px-5 py-2 bg-amber-950 text-amber-200 text-sm">
        {catalogError ? `Não foi possível carregar o catálogo: ${catalogError}` : installedError}
        <button className="ml-3 underline" onClick={() => catalogError ? window.location.reload() : refreshInstalled()}>Tentar novamente</button>
      </div>}
      {flathubError && <div role="alert" className="px-5 py-2 text-amber-200 text-sm">{flathubError}</div>}

      {nav.isLandingVisible ? (
        <LandingPage
          onSelectCategory={handleSelectCategory}
          onSelectApp={setSelectedApp}
          apps={apps}
          isLoading={catalogLoading}
        />
      ) : (
        <AppGrid
          apps={filteredApps}
          onVisibleAppsChange={setGridApps}
          categoryTitle={categoryTitle}
          searchQuery={searchQuery}
          installedOnly={installedOnly}
          onSelectApp={setSelectedApp}
          selectedAppIds={selectedAppIds}
          onToggleSelectApp={handleToggleSelectApp}
          onSelectAllVisible={handleSelectAllVisible}
          isAllVisibleSelected={isAllVisibleSelected}
          selectedCategory={selectedCategory}
          onSearchFlathubLive={term => {
            if (!settings.enableFlathubLive) { pushToast('Ative a busca online nas preferências.', 'info'); return; }
            if (searchQuery !== term) setSearchQuery(term); else handleSearchFlathubLive(term);
          }}
          isSearchingFlathub={isSearchingFlathub}
          isLoading={catalogLoading}
        />
      )}

      <BatchActionBar
        selectedCount={selectedAppIds.length}
        toInstallCount={toInstallApps.length}
        toUninstallCount={toUninstallApps.length}
        onExecuteBatch={handleStartBatchExecution}
        onInstallBatch={handleStartBatchExecution}
        onUninstallBatch={handleStartBatchExecution}
        onClearSelection={handleClearSelection}
      />

      <Suspense fallback={
        // Fallback visual enquanto o chunk lazy do modal baixa.
        // Era null antes, o que dava a impressão de "tela cinza" no
        // GTK WebView (50-200ms de download). Agora mostra overlay + spinner.
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-40">
          <div className="bg-[#2a2d32] border border-[#3c4149] rounded-lg px-6 py-4 flex items-center space-x-3 shadow-2xl">
            <div className="w-4 h-4 border-2 border-[#87cf3e] border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-[#e0e0e0]">Carregando...</span>
          </div>
        </div>
      }>
        {selectedApp && (
          <AppDetailsModal
            app={apps.find(app => app.id === selectedApp.id) || selectedApp}
            operationsAvailable={operationsAvailable && (!selectedApp.isFlatpak || flatpakStatus === 'available')}
            onBusyChange={setDetailsBusy}
            onClose={() => { if (!detailsBusy) setSelectedApp(null); }}
            onToggleInstall={handleToggleInstall}
          />
        )}

        {batchModal && (
          <BatchActionModal
            confirmBeforeStart={settings.confirmBatchAction}
            actionType={batchModal.type}
            targetApps={batchModal.apps}
            onClose={() => setBatchModal(null)}
            onComplete={handleBatchComplete}
          />
        )}

        {isSettingsOpen && <SettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          settings={settings}
          onSaveSettings={handleSaveSettings}
          installedApps={apps.filter(app => app.installed)}
          onImportApps={ids => {
            const selected = apps.filter(app => ids.includes(app.id) && !app.installed).map(app => app.id);
            batch.selectIds(selected);
            setIsSettingsOpen(false);
            handleSelectCategory('all');
            pushToast(`${selected.length} aplicativo(s) selecionado(s) para instalação. Itens já instalados ou fora do catálogo foram ignorados.`, 'info', 6000);
          }}
          onClearCache={handleClearCache}
        />}
      </Suspense>

      <ToastContainer />
    </div>
  );
}
