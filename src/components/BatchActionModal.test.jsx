import React, { StrictMode } from 'react';
import { it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import BatchActionModal from './BatchActionModal';
import { executeBatch } from '../services/packageManager';

vi.mock('../services/packageManager', () => ({ executeBatch: vi.fn() }));
vi.mock('../services/debugLog', () => ({ debugLog: vi.fn() }));

const apps = [
  { id: 'vlc', name: 'VLC', batchAction: 'install' },
  { id: 'gimp', name: 'GIMP', batchAction: 'uninstall', installed: true }
];
const renderModal = (props = {}) => render(<BatchActionModal actionType="mixed" targetApps={apps}
  onClose={() => {}} onComplete={() => {}} {...props} />);

beforeEach(() => {
  vi.resetAllMocks();
  executeBatch.mockImplementation(async (targets, onLog, onEvent) => {
    for (let index = 0; index < targets.length; index++) {
      onEvent({ index, status: 'processing' });
      await new Promise(resolve => setTimeout(resolve, 5));
      onLog('operação concluída');
      onEvent({ index, result: { success: true } });
    }
  });
});

it('mostra os aplicativos e bloqueia Concluir durante a operação', () => {
  renderModal();
  expect(screen.getByText(/Execução de Ações em Lote \(2 aplicativos\)/)).toBeInTheDocument();
  expect(screen.getByText('VLC')).toBeInTheDocument();
  expect(screen.getByText('GIMP')).toBeInTheDocument();
  expect(screen.getByText(/0% \(0\/2\)/)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Concluir' })).toBeDisabled();
});

it('envia o lote misto inteiro uma única vez, inclusive em StrictMode', async () => {
  const onComplete = vi.fn();
  render(<StrictMode><BatchActionModal actionType="mixed" targetApps={apps}
    onClose={() => {}} onComplete={onComplete} /></StrictMode>);
  await waitFor(() => expect(onComplete).toHaveBeenCalledOnce());
  expect(executeBatch).toHaveBeenCalledOnce();
  expect(executeBatch).toHaveBeenCalledWith(apps, expect.any(Function), expect.any(Function));
  expect(onComplete).toHaveBeenCalledWith({ installedIds: ['vlc'], uninstalledIds: ['gimp'] });
  expect(screen.getByText(/100% \(2\/2\)/)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Concluir' })).toBeEnabled();
});

it('aguarda confirmação e permite cancelar sem executar', () => {
  const onClose = vi.fn();
  renderModal({ confirmBeforeStart: true, onClose });
  expect(screen.getByText(/uma única autorização administrativa/)).toBeInTheDocument();
  expect(executeBatch).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
  expect(onClose).toHaveBeenCalledOnce();
  expect(executeBatch).not.toHaveBeenCalled();
});

it('confirmar envia uma única operação em lote', async () => {
  const onComplete = vi.fn();
  renderModal({ confirmBeforeStart: true, onComplete });
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar e executar' }));
  await waitFor(() => expect(onComplete).toHaveBeenCalledOnce());
  expect(executeBatch).toHaveBeenCalledOnce();
});

it('atualiza progresso conforme chegam resultados, inclusive fora da ordem da lista', async () => {
  let notify, finish;
  executeBatch.mockImplementation((_apps, _log, onEvent) => {
    notify = onEvent;
    return new Promise(resolve => { finish = resolve; });
  });
  const onComplete = vi.fn();
  renderModal({ onComplete });
  await waitFor(() => expect(executeBatch).toHaveBeenCalledOnce());
  act(() => notify({ index: 1, result: { success: true } }));
  expect(screen.getByText(/50% \(1\/2\)/)).toBeInTheDocument();
  expect(onComplete).not.toHaveBeenCalled();
  await act(async () => {
    notify({ index: 0, result: { success: false, output: 'APT falhou' } });
    finish();
  });
  expect(screen.getByText('Falhou')).toBeInTheDocument();
  expect(screen.getByText(/100% \(2\/2\)/)).toBeInTheDocument();
  expect(onComplete).toHaveBeenCalledWith({ installedIds: [], uninstalledIds: ['gimp'] });
});

it('cancelamento da autorização apresenta falha para todos sem repetir o lote', async () => {
  executeBatch.mockImplementation(async (_apps, onLog, onEvent) => {
    onLog('Autorização administrativa cancelada.');
    apps.forEach((_app, index) => onEvent({ index, result: { success: false, output: 'Autorização administrativa cancelada.' } }));
  });
  const onComplete = vi.fn();
  renderModal({ onComplete });
  await waitFor(() => expect(onComplete).toHaveBeenCalledWith({ installedIds: [], uninstalledIds: [] }));
  expect(executeBatch).toHaveBeenCalledOnce();
  expect(screen.getAllByText('Falhou')).toHaveLength(2);
  expect(screen.getByText(/Operação finalizada: 0 sucesso\(s\), 2 falha\(s\)/)).toBeInTheDocument();
});

it('não conta resultados simulados como instalação real', async () => {
  executeBatch.mockImplementation(async (_apps, _log, onEvent) => {
    apps.forEach((_app, index) => onEvent({ index, result: { success: true, simulated: true } }));
  });
  const onComplete = vi.fn();
  renderModal({ onComplete });
  await waitFor(() => expect(onComplete).toHaveBeenCalledWith({ installedIds: [], uninstalledIds: [] }));
  expect(screen.getAllByText('Falhou')).toHaveLength(2);
});

it('trocar callback durante a execução não envia o lote novamente', async () => {
  let finish;
  executeBatch.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  const first = vi.fn(), latest = vi.fn();
  const { rerender } = renderModal({ onComplete: first });
  await waitFor(() => expect(executeBatch).toHaveBeenCalledOnce());
  rerender(<BatchActionModal actionType="mixed" targetApps={apps} onClose={() => {}} onComplete={latest} />);
  await act(async () => finish());
  expect(executeBatch).toHaveBeenCalledOnce();
  expect(first).not.toHaveBeenCalled();
  expect(latest).toHaveBeenCalledOnce();
});

it('não atualiza callback depois de desmontar', async () => {
  let finish;
  executeBatch.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  const onComplete = vi.fn();
  const { unmount } = renderModal({ onComplete });
  await waitFor(() => expect(executeBatch).toHaveBeenCalledOnce());
  unmount();
  await act(async () => finish());
  expect(onComplete).not.toHaveBeenCalled();
});
