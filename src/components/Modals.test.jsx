import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import AppDetailsModal from './AppDetailsModal';
import SettingsModal from './SettingsModal';
import { executeLaunch } from '../services/packageManager';

vi.mock('../services/packageManager', () => ({
  executeLaunch: vi.fn(async () => ({ success: true })),
  executeInstall: vi.fn(async (app, onLog) => {
    onLog?.('[APT] Instalando teste...');
    return { success: true };
  }),
  executeUninstall: vi.fn(async (app, onLog) => {
    onLog?.('[APT] Removendo teste...');
    return { success: true };
  })
}));

describe('AppDetailsModal Component Tests', () => {
  const uninstalledApp = {
    id: 'gimp',
    name: 'GIMP Image Editor',
    summary: 'GNU Image Manipulation Program',
    description: 'Create and edit raster graphics.',
    version: '2.10.36',
    installed: false,
    rating: 4.8,
    category: 'graphics',
    packageType: 'APT (Debian)'
  };

  const installedApp = {
    ...uninstalledApp,
    installed: true
  };

  it('não renderiza se app for nulo', () => {
    const { container } = render(<AppDetailsModal app={null} onClose={() => {}} onToggleInstall={() => {}} />);
    expect(container.firstChild).toBeNull();
  });

  it('renderiza detalhes do app não instalado com botão Instalar', () => {
    render(<AppDetailsModal app={uninstalledApp} onClose={() => {}} onToggleInstall={() => {}} />);
    expect(screen.getByText('GIMP Image Editor')).toBeInTheDocument();
    expect(screen.getByText('GNU Image Manipulation Program')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Instalar/i })).toBeInTheDocument();
  });

  it('renderiza detalhes do app instalado com botão Remover', () => {
    render(<AppDetailsModal app={installedApp} onClose={() => {}} onToggleInstall={() => {}} />);
    expect(screen.getByRole('button', { name: /Remover/i })).toBeInTheDocument();
  });

  it('Executar solicita abertura ao backend', async () => {
    render(<AppDetailsModal app={installedApp} onClose={() => {}} onToggleInstall={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Executar' }));
    await waitFor(() => expect(executeLaunch).toHaveBeenCalledWith(installedApp));
  });

  it('executa instalação e chama onToggleInstall', async () => {
    const onToggle = vi.fn();
    render(<AppDetailsModal app={uninstalledApp} onClose={() => {}} onToggleInstall={onToggle} />);
    const installBtn = screen.getByRole('button', { name: /Instalar/i });
    fireEvent.click(installBtn);

    await waitFor(() => {
      expect(onToggle).toHaveBeenCalledWith('gimp', true);
    });
  });
});

describe('SettingsModal Component Tests', () => {
  const mockSettings = {
    searchInSummary: true,
    searchInDescription: true,
    searchInCategoryOnly: false,
    enableFlathubLive: true,
    allowUnverifiedFlatpaks: false,
    packageTypePreference: 'all',
    confirmBatchAction: true,
    isDefaultPackageManager: true
  };

  it('não renderiza se isOpen === false', () => {
    const { container } = render(
      <SettingsModal
        isOpen={false}
        onClose={() => {}}
        settings={mockSettings}
        onSaveSettings={() => {}}
        onClearCache={() => {}}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renderiza preferências e permite troca de abas', () => {
    render(
      <SettingsModal
        isOpen={true}
        onClose={() => {}}
        settings={mockSettings}
        onSaveSettings={() => {}}
        onClearCache={() => {}}
      />
    );
    expect(screen.getByText('Preferências do Gerenciador')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Pesquisa/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Flatpaks/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Flatpaks/i }));
    expect(screen.getByText(/Gerenciamento de Flatpaks & Flathub/i)).toBeInTheDocument();
  });

  it('ativa e desativa Flatpaks não verificados exibindo a confirmação de salvamento', () => {
    const onSaveSettings = vi.fn();
    render(<SettingsModal isOpen settings={mockSettings} onClose={() => {}}
      onSaveSettings={onSaveSettings} onClearCache={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /Flatpaks/i }));
    const checkbox = screen.getByRole('checkbox', { name: /Incluir resultados online não verificados/i });
    fireEvent.click(checkbox);
    expect(checkbox).toBeChecked();
    expect(onSaveSettings).toHaveBeenLastCalledWith({ ...mockSettings, allowUnverifiedFlatpaks: true });
    expect(screen.getByText('Preferências salvas automaticamente!')).toBeInTheDocument();
    fireEvent.click(checkbox);
    expect(checkbox).not.toBeChecked();
    expect(onSaveSettings).toHaveBeenLastCalledWith(mockSettings);
  });

  it('chama onClose ao clicar no botão fechar', () => {
    const onClose = vi.fn();
    render(
      <SettingsModal
        isOpen={true}
        onClose={onClose}
        settings={mockSettings}
        onSaveSettings={() => {}}
        onClearCache={() => {}}
      />
    );
    const closeBtn = screen.getByRole('button', { name: /Fechar/i });
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

it('avisa e desabilita Remover para um componente protegido do sistema', () => {
  const app = { id: 'cinnamon', name: 'Cinnamon', installed: true, rating: 4.5,
    removalProtection: 'Componente da interface gráfica e da sessão do sistema.' };
  const toggle = vi.fn();
  render(<AppDetailsModal app={app} onClose={() => {}} onToggleInstall={toggle} />);
  expect(screen.getByText('Componente protegido do sistema — remoção bloqueada')).toBeInTheDocument();
  const remove = screen.getByRole('button', { name: 'Remover', exact: true });
  expect(remove).toBeDisabled();
  fireEvent.click(remove);
  expect(toggle).not.toHaveBeenCalled();
});
