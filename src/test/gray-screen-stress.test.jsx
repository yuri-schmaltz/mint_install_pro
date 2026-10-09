import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import App from '../App';
import { pushEmergencyLog } from '../services/debugLog';

// Mock packageManager
vi.mock('../services/packageManager', async importOriginal => ({
  ...await importOriginal(),
  executeBatch: vi.fn(async (apps, onLog, onEvent) => {
    for (let index = 0; index < apps.length; index++) {
      onEvent({ index, status: 'processing' });
      onLog(`[TEST] Processando ${apps[index].id}...`);
      await new Promise(resolve => setTimeout(resolve, 40));
      onEvent({ index, result: { success: true } });
    }
  }),
  executeInstall: vi.fn(async (app, onLog) => {
    onLog?.(`[TEST] Instalando ${app.id}...`);
    await new Promise(r => setTimeout(r, 40));
    return { success: true, simulated: true };
  }),
  executeUninstall: vi.fn(async (app, onLog) => {
    onLog?.(`[TEST] Removendo ${app.id}...`);
    await new Promise(r => setTimeout(r, 40));
    return { success: true, simulated: true };
  })
}));

const mockApps = [
  { id: 'app-installed-1', name: 'App Installed 1', summary: 'Installed app 1', installed: true, category: 'accessories', rating: 4.8 },
  { id: 'app-installed-2', name: 'App Installed 2', summary: 'Installed app 2', installed: true, category: 'internet', rating: 4.5 },
  { id: 'app-installed-3', name: 'App Installed 3', summary: 'Installed app 3', installed: true, category: 'development', rating: 4.9 },
  { id: 'app-uninstalled-1', name: 'App Uninstalled 1', summary: 'Uninstalled app 1', installed: false, category: 'accessories', rating: 4.0 }
];

vi.mock('../services/catalog', () => ({
  loadFullCatalog: vi.fn(async () => ({
    apps: mockApps,
    byName: new Map(mockApps.map(a => [a.name.toLowerCase(), a])),
    countByCategory: new Map([['accessories', 2], ['internet', 1], ['development', 1]]),
    countByKind: new Map([['apt', 4]])
  })),
  getCachedIndex: vi.fn(() => ({
    apps: mockApps,
    byName: new Map(mockApps.map(a => [a.name.toLowerCase(), a])),
    countByCategory: new Map([['accessories', 2], ['internet', 1], ['development', 1]]),
    countByKind: new Map([['apt', 4]])
  }))
}));

describe('Gray Screen Stress & Batch Action Investigation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    globalThis.fetch = vi.fn(async () => ({ ok: true, json: async () => ({
      apt: ['app-installed-1', 'app-installed-2', 'app-installed-3'], flatpaks: [], aptStatus: 'available', flatpakStatus: 'available'
    }) }));
  });

  it('fluxo exato do bug report: seleciona 1-3 apps instalados e clica Executar Ações sem crash ou tela cinza', async () => {
    const { container } = render(<App />);

    // Navega para aba Todos para exibir o AppGrid
    const todosTab = screen.getByText('Todos');
    fireEvent.click(todosTab);

    // Verifica que os apps estão no grid
    await waitFor(() => {
      expect(screen.getByText('App Installed 1')).toBeInTheDocument();
    });

    // Pega todos os checkboxes de instalados e clica no primeiro
    const checkboxes = await screen.findAllByTitle(/Instalado no sistema \(clique para desmarcar e desinstalar\)/i);
    expect(checkboxes.length).toBeGreaterThan(0);
    fireEvent.click(checkboxes[0]);

    // BatchActionBar deve aparecer
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Executar Ações/i })).toBeInTheDocument();
    });

    const executeBtn = screen.getByRole('button', { name: /Executar Ações/i });
    expect(executeBtn).toBeInTheDocument();

    // Clica "Executar Ações" - este era o ponto do relato da TELA CINZA
    fireEvent.click(executeBtn);
    fireEvent.click(await screen.findByRole('button', { name: 'Confirmar e executar' }));

    // O modal deve ser montado na DOM imediatamente
    await waitFor(() => {
      expect(screen.getByText(/Execução de Ações em Lote/i)).toBeInTheDocument();
    });

    // O container principal NUNCA deve estar vazio ou cinza sem conteúdo
    expect(container.querySelector('.gtk-card')).toBeInTheDocument();

    // Aguarda conclusão do lote
    await waitFor(() => {
      expect(screen.getByText(/Fila finalizada:/i)).toBeInTheDocument();
    }, { timeout: 4000 });

    // Clica no botão Concluir
    const finishBtn = screen.getByRole('button', { name: /Concluir/i });
    expect(finishBtn).not.toBeDisabled();
    fireEvent.click(finishBtn);

    // Modal se fecha com sucesso
    await waitFor(() => {
      expect(screen.queryByText(/Execução de Ações em Lote/i)).not.toBeInTheDocument();
    });
  });

  it('stress: múltiplas aberturas e cancelamentos rápidos de modais em paralelo não deixam tela cinza', async () => {
    render(<App />);

    const todosTab = screen.getByText('Todos');
    fireEvent.click(todosTab);

    await waitFor(() => {
      expect(screen.getByText('App Installed 1')).toBeInTheDocument();
    });

    // Abre modal de detalhes de app
    fireEvent.click(screen.getByText('App Installed 1'));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Remover/i })).toBeInTheDocument();
    });

    // Fecha com tecla Escape
    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /Remover/i })).not.toBeInTheDocument();
    });

    // Abre preferências pelo menu hamburger
    const menuBtn = screen.getByTitle('Menu do aplicativo');
    fireEvent.click(menuBtn);
    fireEvent.click(screen.getByText('Preferências'));

    await waitFor(() => {
      expect(screen.getByText('Preferências do Gerenciador')).toBeInTheDocument();
    });

    // Fecha preferências com Escape
    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => {
      expect(screen.queryByText('Preferências do Gerenciador')).not.toBeInTheDocument();
    });

    // A tela principal deve permanecer viva e responsiva
    expect(screen.getByText('App Installed 1')).toBeInTheDocument();
  });

  it('resiliência: emergency log persiste erros graves sem derrubar o App', () => {
    render(<App />);

    // Simula registro de emergência direto
    pushEmergencyLog('window.error', { message: 'Network glitch in GTK WebView' });

    // O App continua de pé
    expect(screen.getByText('Início')).toBeInTheDocument();

    // Emergency log no localStorage deve ter registrado o evento
    const rawEmergency = localStorage.getItem('mip_emergency_log');
    expect(rawEmergency).toBeTruthy();
    const parsed = JSON.parse(rawEmergency);
    expect(parsed[0].info.message).toBe('Network glitch in GTK WebView');
  });
});
