import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import HeaderBar from './HeaderBar';
import CategoryNav from './CategoryNav';
import AppCard from './AppCard';
import BatchActionBar from './BatchActionBar';
import { categoriesList } from '../data/categoriesList';

describe('HeaderBar Component Tests', () => {
  it('renderiza campo de busca e dispara setSearchQuery', () => {
    const setSearchQuery = vi.fn();
    render(
      <HeaderBar
        searchQuery=""
        setSearchQuery={setSearchQuery}
        canGoBack={false}
        onBack={() => {}}
        onOpenSettings={() => {}}
      />
    );
    const input = screen.getByPlaceholderText(/Pesquisar aplicativos\.\.\./i);
    fireEvent.change(input, { target: { value: 'firefox' } });
    expect(setSearchQuery).toHaveBeenCalledWith('firefox');
  });

  it('botão voltar respeita canGoBack', () => {
    const onBack = vi.fn();
    const { rerender } = render(
      <HeaderBar
        searchQuery=""
        setSearchQuery={() => {}}
        canGoBack={false}
        onBack={onBack}
        onOpenSettings={() => {}}
      />
    );
    const backBtn = screen.getByTitle('Voltar');
    expect(backBtn).toBeDisabled();
    fireEvent.click(backBtn);
    expect(onBack).not.toHaveBeenCalled();

    rerender(
      <HeaderBar
        searchQuery=""
        setSearchQuery={() => {}}
        canGoBack={true}
        onBack={onBack}
        onOpenSettings={() => {}}
      />
    );
    expect(backBtn).not.toBeDisabled();
    fireEvent.click(backBtn);
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('exibe badge quando flatpakStatus é missing', () => {
    render(
      <HeaderBar
        searchQuery=""
        setSearchQuery={() => {}}
        canGoBack={false}
        onBack={() => {}}
        onOpenSettings={() => {}}
        flatpakStatus="missing"
      />
    );
    expect(screen.getByText('Flatpak ausente')).toBeInTheDocument();
  });

  it('abre menu hamburger e modal Sobre', () => {
    const onOpenSettings = vi.fn();
    render(
      <HeaderBar
        searchQuery=""
        setSearchQuery={() => {}}
        canGoBack={false}
        onBack={() => {}}
        onOpenSettings={onOpenSettings}
      />
    );
    const menuBtn = screen.getByTitle('Menu do aplicativo');
    fireEvent.click(menuBtn);
    expect(screen.getByText('Preferências')).toBeInTheDocument();
    expect(screen.getByText('Sobre o Gerenciador')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Preferências'));
    expect(onOpenSettings).toHaveBeenCalledTimes(1);

    fireEvent.click(menuBtn);
    fireEvent.click(screen.getByText('Sobre o Gerenciador'));
    expect(screen.getByRole('heading', { name: 'Gerenciador de Aplicativos' })).toBeInTheDocument();
  });
});

describe('CategoryNav Component Tests', () => {
  it('renderiza todas as 12 abas incluindo Instalados', () => {
    render(
      <CategoryNav
        categories={categoriesList}
        selectedCategory="picks"
        onSelectCategory={() => {}}
        installedOnly={false}
        onToggleInstalledOnly={() => {}}
        installedCount={42}
      />
    );
    expect(screen.getByText('Início')).toBeInTheDocument();
    expect(screen.getByText('Instalados')).toBeInTheDocument();
    expect(screen.getByText('Todos')).toBeInTheDocument();
  });

  it('dispara onSelectCategory ao clicar em abas comuns', () => {
    const onSelect = vi.fn();
    render(
      <CategoryNav
        categories={categoriesList}
        selectedCategory="picks"
        onSelectCategory={onSelect}
        installedOnly={false}
        onToggleInstalledOnly={() => {}}
        installedCount={5}
      />
    );
    fireEvent.click(screen.getByText('Internet'));
    expect(onSelect).toHaveBeenCalledWith('internet');
  });

  it('dispara onToggleInstalledOnly ao clicar na aba Instalados', () => {
    const onToggle = vi.fn();
    render(
      <CategoryNav
        categories={categoriesList}
        selectedCategory="all"
        onSelectCategory={() => {}}
        installedOnly={false}
        onToggleInstalledOnly={onToggle}
        installedCount={10}
      />
    );
    fireEvent.click(screen.getByText('Instalados'));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });
});

describe('AppCard Component Tests', () => {
  const mockApp = {
    id: 'test-app',
    name: 'Test App',
    summary: 'A test application',
    installed: false
  };

  it('renderiza app name e summary', () => {
    render(<AppCard app={mockApp} onClick={() => {}} />);
    expect(screen.getByText('Test App')).toBeInTheDocument();
    expect(screen.getByText('A test application')).toBeInTheDocument();
  });

  it('dispara onClick com app', () => {
    const onClick = vi.fn();
    render(<AppCard app={mockApp} onClick={onClick} />);
    fireEvent.click(screen.getByText('Test App'));
    expect(onClick).toHaveBeenCalledWith(mockApp);
  });

  it('dispara onToggleSelect ao clicar no checkbox', () => {
    const onToggle = vi.fn();
    render(<AppCard app={mockApp} onClick={() => {}} onToggleSelect={onToggle} />);
    const checkbox = screen.getByTitle(/Não instalado \(clique para marcar e instalar\)/i);
    fireEvent.click(checkbox);
    expect(onToggle).toHaveBeenCalledWith('test-app');
  });
});

describe('BatchActionBar Component Tests', () => {
  it('não renderiza nada se selectedCount === 0', () => {
    const { container } = render(
      <BatchActionBar
        selectedCount={0}
        toInstallCount={0}
        toUninstallCount={0}
        onClearSelection={() => {}}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renderiza contadores e botões quando selectedCount > 0', () => {
    const onExecute = vi.fn();
    const onClear = vi.fn();
    render(
      <BatchActionBar
        selectedCount={3}
        toInstallCount={2}
        toUninstallCount={1}
        onExecuteBatch={onExecute}
        onClearSelection={onClear}
      />
    );
    expect(screen.getByText(/2 para instalar/i)).toBeInTheDocument();
    expect(screen.getByText(/1 para desinstalar/i)).toBeInTheDocument();

    const actionBtn = screen.getByRole('button', { name: /Executar Ações/i });
    fireEvent.click(actionBtn);
    expect(onExecute).toHaveBeenCalledTimes(1);

    const clearBtn = screen.getByTitle('Limpar seleção');
    fireEvent.click(clearBtn);
    expect(onClear).toHaveBeenCalledTimes(1);
  });
});

it('identifica componentes protegidos e bloqueia a seleção para remover', () => {
  const app = { id: 'cinnamon', name: 'Cinnamon', installed: true, removalProtection: 'Interface gráfica do sistema.' };
  const onToggleSelect = vi.fn();
  render(<AppCard app={app} onClick={() => {}} onToggleSelect={onToggleSelect} />);
  expect(screen.getByText('Protegido')).toBeInTheDocument();
  const selector = screen.getByTitle('Remoção bloqueada: Interface gráfica do sistema.');
  expect(selector).toHaveAttribute('aria-disabled', 'true');
  fireEvent.click(selector);
  expect(onToggleSelect).not.toHaveBeenCalled();
});
