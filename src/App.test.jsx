import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import App from './App';
import * as catalogService from './services/catalog';

describe('App Integration & End-to-End User Scenarios', () => {
  const originalFetch = globalThis.fetch;

  const sampleApps = [
    {
      id: 'vlc',
      name: 'VLC Media Player',
      summary: 'Reprodutor multimídia completo',
      fullSummary: 'Reprodutor multimídia livre e de código aberto',
      description: 'O VLC é um reprodutor multimídia livre e de código aberto.',
      category: 'sound-video',
      categoryLabel: 'Mídia',
      packageType: 'APT (Debian)',
      kind: 'apt',
      rating: 4.9,
      installed: false,
      flathub: false,
      _haystack: 'vlc media player reprodutor multimídia livre e de código aberto',
      _nameLower: 'vlc media player',
      isApt: true,
      isFlatpak: false
    },
    {
      id: 'gimp',
      name: 'GIMP',
      summary: 'Editor de Imagens GNU',
      fullSummary: 'Criação e edição gráfica avançada',
      description: 'Editor profissional de imagens.',
      category: 'graphics',
      categoryLabel: 'Gráficos',
      packageType: 'APT (Debian)',
      kind: 'apt',
      rating: 4.8,
      installed: true,
      flathub: false,
      _haystack: 'gimp editor de imagens gnu criação e edição gráfica avançada',
      _nameLower: 'gimp',
      isApt: true,
      isFlatpak: false
    },
    {
      id: 'org.blender.Blender',
      name: 'Blender',
      summary: 'Modelagem e Animação 3D',
      fullSummary: 'Software livre de criação 3D',
      description: 'Suite completa para animação e jogos.',
      category: 'graphics',
      categoryLabel: 'Gráficos',
      packageType: 'Flatpak (Flathub)',
      kind: 'flatpak',
      rating: 4.9,
      installed: false,
      flathub: true,
      _haystack: 'blender modelagem e animação 3d software livre',
      _nameLower: 'blender',
      isApt: false,
      isFlatpak: true
    }
  ];

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();

    const mockIndex = {
      apps: sampleApps,
      byName: new Map([
        ['vlc media player', [sampleApps[0]]],
        ['gimp', [sampleApps[1]]],
        ['blender', [sampleApps[2]]]
      ]),
      countByCategory: new Map([
        ['sound-video', 1],
        ['graphics', 2]
      ]),
      countByKind: new Map([
        ['apt', 2],
        ['flatpak', 1]
      ])
    };

    vi.spyOn(catalogService, 'getCachedIndex').mockReturnValue(mockIndex);
    vi.spyOn(catalogService, 'loadFullCatalog').mockResolvedValue(mockIndex);

    globalThis.fetch = vi.fn().mockImplementation((url) => {
      if (url === '/api/installed') {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ apt: ['gimp'], flatpaks: [], aptStatus: 'available', flatpakStatus: 'available' })
        });
      }
      return Promise.resolve({ ok: false, status: 404 });
    });
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('renderiza o HeaderBar, CategoryNav e LandingPage por padrão', async () => {
    render(<App />);

    expect(screen.getByPlaceholderText(/Pesquisar aplicativos.../i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Início' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Instalados/i })).toBeInTheDocument();
    expect(screen.getByText('Categorias de Aplicativos')).toBeInTheDocument();
    expect(screen.getByText('Mais Bem Avaliados')).toBeInTheDocument();
  });

  it('muda para o AppGrid ao pesquisar e volta à LandingPage ao limpar a busca', async () => {
    render(<App />);

    const searchInput = screen.getByPlaceholderText(/Pesquisar aplicativos.../i);
    fireEvent.change(searchInput, { target: { value: 'vlc' } });

    // Header da categoria muda para resultados de pesquisa
    expect(await screen.findByText('Resultados para "vlc"')).toBeInTheDocument();
    expect(screen.getByText('VLC Media Player')).toBeInTheDocument();
    expect(screen.queryByText('Categorias de Aplicativos')).not.toBeInTheDocument();

    // Limpa a busca com o botão X do input
    const clearBtn = searchInput.parentElement.querySelector('button');
    expect(clearBtn).toBeInTheDocument();
    fireEvent.click(clearBtn);

    expect(await screen.findByText('Categorias de Aplicativos')).toBeInTheDocument();
  });

  it('permite abrir e fechar a modal de preferências (SettingsModal)', async () => {
    render(<App />);

    // Abre menu hamburger
    const menuBtn = screen.getByTitle('Menu do aplicativo');
    fireEvent.click(menuBtn);

    const prefBtn = screen.getByText('Preferências');
    fireEvent.click(prefBtn);

    // Modal de preferências abre
    expect(await screen.findByText('Preferências do Gerenciador')).toBeInTheDocument();

    // Fecha modal clicando no botão de fechar (X)
    const modalHeader = screen.getByText('Preferências do Gerenciador').closest('div');
    const xBtn = modalHeader.parentElement.querySelector('button');
    if (xBtn) fireEvent.click(xBtn);

    await waitFor(() => {
      expect(screen.queryByText('Preferências do Gerenciador')).not.toBeInTheDocument();
    });
  });

  it('permite abrir o diálogo Sobre e fechá-lo', async () => {
    render(<App />);

    const menuBtn = screen.getByTitle('Menu do aplicativo');
    fireEvent.click(menuBtn);

    const aboutBtn = screen.getByText('Sobre o Gerenciador');
    fireEvent.click(aboutBtn);

    expect(screen.getByText(/Réplica interativa e de alta fidelidade visual/i)).toBeInTheDocument();

    const closeBtn = screen.getByRole('button', { name: 'Fechar' });
    fireEvent.click(closeBtn);

    expect(screen.queryByText(/Réplica interativa e de alta fidelidade visual/i)).not.toBeInTheDocument();
  });

  it('navega pelas abas de categoria e atualiza os aplicativos visíveis', async () => {
    render(<App />);

    // Clica na aba Gráficos
    const graphicsTab = screen.getByRole('button', { name: 'Gráficos' });
    fireEvent.click(graphicsTab);

    // Header da categoria no grid
    expect(screen.getByRole('heading', { level: 2, name: 'Gráficos' })).toBeInTheDocument();
    expect(screen.getByText('GIMP')).toBeInTheDocument();
    expect(screen.getByText('Blender')).toBeInTheDocument();
    expect(screen.queryByText('VLC Media Player')).not.toBeInTheDocument();

    // Botão Voltar deve estar ativo
    const backBtn = screen.getByTitle('Voltar');
    expect(backBtn).not.toBeDisabled();
    fireEvent.click(backBtn);

    // Retorna para a LandingPage
    expect(screen.getByText('Categorias de Aplicativos')).toBeInTheDocument();
  });

  it('atalho de teclado Escape limpa seleção ou fecha modais', async () => {
    render(<App />);

    // Abre categoria para ver cards com checkboxes
    fireEvent.click(screen.getByRole('button', { name: 'Gráficos' }));

    // Clica no checkbox do GIMP para selecionar
    const gimpCard = screen.getByText('GIMP').closest('.gtk-card');
    const gimpCheckbox = gimpCard.querySelector('.cursor-pointer.z-10');
    if (gimpCheckbox) fireEvent.click(gimpCheckbox);

    // BatchActionBar deve aparecer
    expect(await screen.findByRole('button', { name: /Executar Ações/i })).toBeInTheDocument();

    // Pressiona Escape para desmarcar
    fireEvent.keyDown(window, { key: 'Escape' });

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /Executar Ações/i })).not.toBeInTheDocument();
    });
  });

  it('atalho Ctrl+A seleciona todos os itens visíveis na lista', async () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'Gráficos' }));

    // Pressiona Ctrl+A
    fireEvent.keyDown(window, { key: 'a', ctrlKey: true });

    // Em Gráficos há 2 apps (GIMP e Blender)
    expect(await screen.findByText('1 para instalar')).toBeInTheDocument();
    expect(await screen.findByText('1 para desinstalar')).toBeInTheDocument();
  });
});
