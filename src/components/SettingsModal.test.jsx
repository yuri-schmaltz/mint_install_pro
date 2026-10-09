import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import SettingsModal from './SettingsModal';
import { pushToast } from './Toast';

vi.mock('./Toast', () => ({ pushToast: vi.fn() }));

const defaults = {
  searchInSummary: true, searchInDescription: true, searchInCategoryOnly: false,
  enableFlathubLive: true, allowUnverifiedFlatpaks: false,
  packageTypePreference: 'all', confirmBatchAction: true
};
const renderSettings = (props = {}) => render(<SettingsModal isOpen settings={defaults}
  onClose={() => {}} onSaveSettings={() => {}} onClearCache={() => {}} {...props} />);

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('Preferências: navegação e salvamento', () => {
  it('mostra somente as três abas restantes e nenhum elemento da aba removida', () => {
    renderSettings();
    for (const [tab, content] of [
      ['Pesquisa', 'Opções Gerais de Pesquisa'],
      ['Flatpaks', 'Gerenciamento de Flatpaks & Flathub'],
      ['Operações & Lote', 'Preferências de Execução de Pacotes']
    ]) {
      fireEvent.click(screen.getByRole('button', { name: tab, exact: true }));
      expect(screen.getByText(content)).toBeVisible();
      expect(screen.queryByText(/Sistema & Padrão|Integração com o Sistema Operacional|Manutenção do Cache e Dados/)).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Atualizar Agora|Restaurar/ })).not.toBeInTheDocument();
    }
  });

  it.each([
    ['Pesquisa', 'Buscar no resumo dos pacotes', 'searchInSummary'],
    ['Pesquisa', 'Buscar na descrição detalhada', 'searchInDescription'],
    ['Pesquisa', 'Limitar busca à categoria selecionada', 'searchInCategoryOnly'],
    ['Flatpaks', 'Busca online ao vivo no Flathub', 'enableFlathubLive'],
    ['Flatpaks', 'Incluir resultados online não verificados', 'allowUnverifiedFlatpaks'],
    ['Operações & Lote', 'Confirmar operações em lote', 'confirmBatchAction']
  ])('%s: alterna %s nas duas direções sem alterar outras opções', (tab, label, key) => {
    const onSaveSettings = vi.fn();
    renderSettings({ onSaveSettings });
    fireEvent.click(screen.getByRole('button', { name: tab, exact: true }));
    const input = screen.getByRole('checkbox', { name: new RegExp(label) });
    fireEvent.click(input);
    expect(input.checked).toBe(!defaults[key]);
    expect(onSaveSettings).toHaveBeenLastCalledWith({ ...defaults, [key]: !defaults[key] });
    fireEvent.click(input);
    expect(input.checked).toBe(defaults[key]);
    expect(onSaveSettings).toHaveBeenLastCalledWith(defaults);
  });

  it.each(['apt', 'flatpak', 'all'])('salva preferência de formato %s', value => {
    const onSaveSettings = vi.fn();
    renderSettings({ onSaveSettings });
    fireEvent.click(screen.getByRole('button', { name: 'Flatpaks', exact: true }));
    fireEvent.change(screen.getByRole('combobox'), { target: { value } });
    expect(onSaveSettings).toHaveBeenCalledWith({ ...defaults, packageTypePreference: value });
  });

  it('preserva alterações sequenciais entre abas', () => {
    const onSaveSettings = vi.fn();
    renderSettings({ onSaveSettings });
    fireEvent.click(screen.getByRole('checkbox', { name: /Buscar no resumo/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Operações & Lote', exact: true }));
    fireEvent.click(screen.getByRole('checkbox', { name: /Confirmar operações/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Pesquisa', exact: true }));
    expect(screen.getByRole('checkbox', { name: /Buscar no resumo/ })).not.toBeChecked();
    expect(onSaveSettings).toHaveBeenLastCalledWith({ ...defaults, searchInSummary: false, confirmBatchAction: false });
  });

  it('sincroniza preferências recebidas de fora sem disparar novo salvamento', () => {
    const onSaveSettings = vi.fn();
    const { rerender } = renderSettings({ onSaveSettings });
    rerender(<SettingsModal isOpen settings={{ ...defaults, searchInSummary: false }}
      onSaveSettings={onSaveSettings} onClearCache={() => {}} onClose={() => {}} />);
    expect(screen.getByRole('checkbox', { name: /Buscar no resumo/ })).not.toBeChecked();
    expect(onSaveSettings).not.toHaveBeenCalled();
  });

  it('oculta confirmação de salvamento após dois segundos', () => {
    vi.useFakeTimers();
    renderSettings();
    fireEvent.click(screen.getByRole('checkbox', { name: /Buscar no resumo/ }));
    expect(screen.getByText('Preferências salvas automaticamente!')).toBeVisible();
    act(() => vi.advanceTimersByTime(2000));
    expect(screen.queryByText('Preferências salvas automaticamente!')).not.toBeInTheDocument();
  });

  it('mantém Limpar Cache funcional em Operações & Lote', () => {
    const onClearCache = vi.fn();
    renderSettings({ onClearCache });
    fireEvent.click(screen.getByRole('button', { name: 'Operações & Lote', exact: true }));
    fireEvent.click(screen.getByRole('button', { name: 'Limpar Cache', exact: true }));
    expect(onClearCache).toHaveBeenCalledOnce();
  });
});

describe('Backup de aplicativos', () => {
  const importFile = text => {
    const input = document.querySelector('input[type="file"]');
    fireEvent.change(input, { target: { files: [new File([text], 'backup.json', { type: 'application/json' })] } });
    return input;
  };

  it.each([
    ['{"vlc":true,"gimp":false}', ['vlc']],
    ['{"vlc":true,"bad":"true","other":1,"nested":{"ok":true},"nil":null}', ['vlc']],
    ['{}', []],
    ['{"org.example.App":true,"docker.io":true}', ['org.example.App', 'docker.io']]
  ])('importa somente IDs marcados com booleano true: %s', async (text, ids) => {
    const onImportApps = vi.fn();
    renderSettings({ onImportApps });
    fireEvent.click(screen.getByRole('button', { name: 'Operações & Lote', exact: true }));
    const input = importFile(text);
    await waitFor(() => expect(onImportApps).toHaveBeenCalledWith(ids));
    expect(input.value).toBe('');
    expect(pushToast).not.toHaveBeenCalled();
  });

  it.each(['', '{', 'null', '[]', '["vlc"]', 'true', '42', '"vlc"'])('recusa backup inválido %s sem importar', async text => {
    const onImportApps = vi.fn();
    renderSettings({ onImportApps });
    fireEvent.click(screen.getByRole('button', { name: 'Operações & Lote', exact: true }));
    importFile(text);
    await waitFor(() => expect(pushToast).toHaveBeenCalledWith('Arquivo inválido', 'error'));
    expect(onImportApps).not.toHaveBeenCalled();
  });

  it('cancelar escolha de arquivo não altera a seleção', () => {
    const onImportApps = vi.fn();
    renderSettings({ onImportApps });
    fireEvent.click(screen.getByRole('button', { name: 'Operações & Lote', exact: true }));
    fireEvent.change(document.querySelector('input[type="file"]'), { target: { files: [] } });
    expect(onImportApps).not.toHaveBeenCalled();
    expect(pushToast).not.toHaveBeenCalled();
  });

  it.each([{ installedApps: [] }, { installedApps: [{ id: 'vlc' }, { id: 'org.example.App' }] }])('exporta a lista fornecida em JSON e libera a URL temporária: %j', async ({ installedApps }) => {
    const createObjectURL = vi.fn(() => 'blob:backup');
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    renderSettings({ installedApps });
    fireEvent.click(screen.getByRole('button', { name: 'Operações & Lote', exact: true }));
    fireEvent.click(screen.getByRole('button', { name: 'Exportar', exact: true }));
    const blob = createObjectURL.mock.calls[0][0];
    const text = await new Promise(resolve => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.readAsText(blob);
    });
    expect(JSON.parse(text)).toEqual(Object.fromEntries(installedApps.map(app => [app.id, true])));
    expect(click).toHaveBeenCalledOnce();
    expect(click.mock.instances[0].download).toMatch(/^mint-install-pro-installed-\d{4}-\d{2}-\d{2}\.json$/);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:backup');
    expect(pushToast).toHaveBeenCalledWith('Backup exportado com sucesso', 'success');
  });

  it('falha na exportação produz mensagem de erro', () => {
    vi.stubGlobal('URL', { createObjectURL: () => { throw new Error('indisponível'); } });
    renderSettings();
    fireEvent.click(screen.getByRole('button', { name: 'Operações & Lote', exact: true }));
    fireEvent.click(screen.getByRole('button', { name: 'Exportar', exact: true }));
    expect(pushToast).toHaveBeenCalledWith('Falha ao exportar backup', 'error');
  });
});
