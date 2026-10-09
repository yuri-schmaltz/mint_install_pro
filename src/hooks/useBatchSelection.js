// Custom hook: gerencia seleção em lote (selectedAppIds) + deriva listas
// toInstall/toUninstall + helpers de select-all/deselect.

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';

/**
 * @param {Array} visibleApps - subset visível (filtrado) que aparece no grid
 * @returns {{
 *   selectedAppIds: string[],
 *   selectedAppsList: Array,           // apps onde id in selectedAppIds
 *   toInstallApps: Array,
 *   toUninstallApps: Array,
 *   isAllVisibleSelected: boolean,
 *   toggleApp: (appId: string) => void,
 *   selectAllVisible: () => void,
 *   clearSelection: () => void,
 *   removeFromSelection: (ids: string[]) => void
 * }}
 */
export function useBatchSelection(visibleApps, allApps = visibleApps, isInstalled) {
  const [selectedAppIds, setSelectedAppIds] = useState([]);
  const selectedCache = useRef(new Map());
  const selectableApps = useMemo(() => visibleApps.filter(app => !app.installed || !app.removalProtection), [visibleApps]);

  useEffect(() => {
    const blocked = new Set(allApps.filter(app => app.installed && app.removalProtection).map(app => app.id));
    setSelectedAppIds(previous => previous.some(id => blocked.has(id))
      ? previous.filter(id => !blocked.has(id)) : previous);
  }, [allApps]);

  const selectedAppsList = useMemo(() => {
    if (selectedAppIds.length === 0) return [];
    const current = new Map(allApps.map(app => [app.id, app]));
    const selected = selectedAppIds.map(id => current.get(id) || selectedCache.current.get(id))
      .filter(app => app && (!app.installed || !app.removalProtection));
    selectedCache.current = new Map(selected.map(app => [app.id, app]));
    return isInstalled ? selected.map(app => ({ ...app, installed: isInstalled(app.id) === true })) : selected;
  }, [allApps, selectedAppIds, isInstalled]);

  const toInstallApps = useMemo(
    () => selectedAppsList.filter((a) => !a.installed),
    [selectedAppsList]
  );
  const toUninstallApps = useMemo(
    () => selectedAppsList.filter((a) => a.installed),
    [selectedAppsList]
  );

  const isAllVisibleSelected = useMemo(() => {
    if (selectableApps.length === 0) return false;
    if (selectedAppIds.length === 0) return false;
    const set = new Set(selectedAppIds);
    return selectableApps.every((a) => set.has(a.id));
  }, [selectableApps, selectedAppIds]);

  const toggleApp = useCallback((appId) => {
    const app = allApps.find(item => item.id === appId) || selectedCache.current.get(appId);
    if (app?.installed && app.removalProtection) return;
    setSelectedAppIds((prev) =>
      prev.includes(appId) ? prev.filter((id) => id !== appId) : [...prev, appId]
    );
  }, [allApps]);

  const selectAllVisible = useCallback(() => {
    setSelectedAppIds((prev) => {
      const set = new Set(prev);
      if (selectableApps.every((a) => set.has(a.id))) {
        // Deselect all visible
        const visibleIds = new Set(selectableApps.map((a) => a.id));
        return prev.filter((id) => !visibleIds.has(id));
      }
      // Select all visible
      const newIds = new Set([...prev, ...selectableApps.map((a) => a.id)]);
      return Array.from(newIds);
    });
  }, [selectableApps]);

  const clearSelection = useCallback(() => {
    setSelectedAppIds([]);
  }, []);

  const removeFromSelection = useCallback((ids) => {
    if (!ids || ids.length === 0) return;
    const set = new Set(ids);
    setSelectedAppIds((prev) => prev.filter((id) => !set.has(id)));
  }, []);

  return {
    selectedAppIds,
    selectIds: setSelectedAppIds,
    selectedAppsList,
    toInstallApps,
    toUninstallApps,
    isAllVisibleSelected,
    toggleApp,
    selectAllVisible,
    clearSelection,
    removeFromSelection
  };
}
