import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useBatchSelection } from './useBatchSelection';

describe('useBatchSelection hook tests', () => {
  const mockVisibleApps = [
    { id: 'vlc', name: 'VLC', installed: false },
    { id: 'gimp', name: 'GIMP', installed: true },
    { id: 'inkscape', name: 'Inkscape', installed: false }
  ];

  it('inicia com seleção vazia', () => {
    const { result } = renderHook(() => useBatchSelection(mockVisibleApps));
    expect(result.current.selectedAppIds).toEqual([]);
    expect(result.current.selectedAppsList).toEqual([]);
    expect(result.current.toInstallApps).toEqual([]);
    expect(result.current.toUninstallApps).toEqual([]);
    expect(result.current.isAllVisibleSelected).toBe(false);
  });

  it('toggleApp adiciona e remove item da seleção', () => {
    const { result } = renderHook(() => useBatchSelection(mockVisibleApps));
    
    act(() => {
      result.current.toggleApp('vlc');
    });
    expect(result.current.selectedAppIds).toEqual(['vlc']);
    expect(result.current.toInstallApps).toHaveLength(1);
    expect(result.current.toInstallApps[0].id).toBe('vlc');

    act(() => {
      result.current.toggleApp('gimp');
    });
    expect(result.current.selectedAppIds).toEqual(['vlc', 'gimp']);
    expect(result.current.toUninstallApps).toHaveLength(1);
    expect(result.current.toUninstallApps[0].id).toBe('gimp');

    act(() => {
      result.current.toggleApp('vlc');
    });
    expect(result.current.selectedAppIds).toEqual(['gimp']);
  });

  it('selectAllVisible alterna entre selecionar todos os visíveis e desmarcar todos', () => {
    const { result } = renderHook(() => useBatchSelection(mockVisibleApps));

    act(() => {
      result.current.selectAllVisible();
    });
    expect(result.current.selectedAppIds).toEqual(['vlc', 'gimp', 'inkscape']);
    expect(result.current.isAllVisibleSelected).toBe(true);

    act(() => {
      result.current.selectAllVisible();
    });
    expect(result.current.selectedAppIds).toEqual([]);
    expect(result.current.isAllVisibleSelected).toBe(false);
  });

  it('removeFromSelection remove IDs específicos após conclusão do lote', () => {
    const { result } = renderHook(() => useBatchSelection(mockVisibleApps));

    act(() => {
      result.current.selectAllVisible();
    });
    expect(result.current.selectedAppIds).toHaveLength(3);

    act(() => {
      result.current.removeFromSelection(['vlc', 'inkscape']);
    });
    expect(result.current.selectedAppIds).toEqual(['gimp']);
  });

  it('clearSelection limpa todos os selecionados', () => {
    const { result } = renderHook(() => useBatchSelection(mockVisibleApps));

    act(() => {
      result.current.toggleApp('vlc');
    });
    expect(result.current.selectedAppIds).toHaveLength(1);

    act(() => {
      result.current.clearSelection();
    });
    expect(result.current.selectedAppIds).toEqual([]);
  });
});

it('mantém operações selecionadas ao navegar para outra categoria', () => {
  const all = [{ id: 'a', installed: false }, { id: 'b', installed: true }];
  const { result, rerender } = renderHook(({ visible }) => useBatchSelection(visible, all), { initialProps: { visible: [all[0]] } });
  act(() => result.current.toggleApp('a'));
  rerender({ visible: [all[1]] });
  act(() => result.current.toggleApp('b'));
  expect(result.current.selectedAppsList.map(a => a.id)).toEqual(['a', 'b']);
});

it('preserva aplicativo online selecionado após sair da busca', () => {
  const online = { id: 'org.example.Online', installed: false };
  const { result, rerender } = renderHook(({ apps }) => useBatchSelection(apps, apps), { initialProps: { apps: [online] } });
  act(() => result.current.toggleApp(online.id));
  rerender({ apps: [] });
  expect(result.current.selectedAppsList).toEqual([online]);
});

it('ignora componentes protegidos ao selecionar individualmente e com Marcar Todos', () => {
  const apps = [
    { id: 'cinnamon', installed: true, removalProtection: 'Interface gráfica.' },
    { id: 'vlc', installed: true },
    { id: 'gimp', installed: false }
  ];
  const { result } = renderHook(() => useBatchSelection(apps));
  act(() => result.current.toggleApp('cinnamon'));
  expect(result.current.selectedAppIds).toEqual([]);
  act(() => result.current.selectAllVisible());
  expect(result.current.selectedAppIds).toEqual(['vlc', 'gimp']);
  expect(result.current.toUninstallApps.map(app => app.id)).toEqual(['vlc']);
  expect(result.current.isAllVisibleSelected).toBe(true);
  act(() => result.current.selectAllVisible());
  expect(result.current.selectedAppIds).toEqual([]);
});

it('remove da seleção um componente que passou a ser protegido após atualização', () => {
  const { result, rerender } = renderHook(({ apps }) => useBatchSelection(apps), {
    initialProps: { apps: [{ id: 'component', installed: true }] }
  });
  act(() => result.current.toggleApp('component'));
  expect(result.current.selectedAppIds).toEqual(['component']);
  rerender({ apps: [{ id: 'component', installed: true, removalProtection: 'Componente de base.' }] });
  expect(result.current.selectedAppIds).toEqual([]);
  expect(result.current.selectedAppsList).toEqual([]);
});

it('permite instalar um componente protegido ainda não instalado', () => {
  const apps = [{ id: 'component', installed: false, removalProtection: 'Componente de base.' }];
  const { result } = renderHook(() => useBatchSelection(apps));
  act(() => result.current.toggleApp('component'));
  expect(result.current.toInstallApps).toHaveLength(1);
});
