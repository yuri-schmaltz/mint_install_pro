// e2e/main-flow.spec.js — testes end-to-end do fluxo principal.
// Complementa vitest exercitando interações REAIS do navegador.
//
// Histórico: o DebugDock foi removido da tela principal em v1.5.1
// por pedido do usuário (atrapalhava a UI). Os testes abaixo foram
// ajustados para NÃO esperar a presença do botão DEBUG.

import { test, expect } from '@playwright/test';

test.describe('Mint Install Pro — fluxo E2E principal', () => {
  test.beforeEach(async ({ page }) => {
    // No browser test may modify real system packages.
    await page.route('**/api/**', route => {
      if (new URL(route.request().url()).pathname === '/api/installed') {
        return route.fulfill({ json: { apt: [], flatpaks: [], aptStatus: 'available', flatpakStatus: 'available' } });
      }
      return route.fulfill({ status: 503, json: { success: false, error: 'Operação não configurada no teste' } });
    });
    // Limpa localStorage pra ter estado limpo entre testes
    await page.addInitScript(() => {
      window.localStorage.clear();
    });
    await page.goto('/');
    // Espera o app inicializar
    await page.waitForLoadState('networkidle');
  });

  test('app carrega com UI básica visível (sem DebugDock)', async ({ page }) => {
    // HeaderBar presente
    await expect(page.locator('input[placeholder*="Pesquisar"]')).toBeVisible();
    // CategoryNav presente (12 abas)
    await expect(page.locator('nav button')).toHaveCount(12);
    // DebugDock NÃO deve estar visível (removido da UI em v1.5.1)
    await expect(page.locator('[title="Abrir painel de diagnóstico"]')).toHaveCount(0);
  });

  test('navegação por abas funciona', async ({ page }) => {
    // Clica em "Acessórios"
    await page.locator('button:has-text("Acessórios")').first().click();
    await page.waitForTimeout(200);
    // AppGrid deve aparecer (saiu da landing)
    await expect(page.locator('.gtk-card').first()).toBeVisible({ timeout: 10_000 });
  });

  test('busca atualiza o grid filtrado', async ({ page }) => {
    // Digita termo de busca
    const searchInput = page.locator('input[placeholder*="Pesquisar"]');
    await searchInput.fill('vlc');
    await page.waitForTimeout(500); // debounce
    // Pelo menos 1 card visível (ou mensagem de empty state)
    const cards = page.locator('[role="button"][aria-label]');
    await expect(cards.first()).toBeVisible({ timeout: 5000 });
  });

  test('tecla Escape fecha modais abertos', async ({ page }) => {
    // Abre About modal via menu hambúrguer
    await page.locator('button[title="Menu do aplicativo"]').click();
    await page.locator('text="Sobre o Gerenciador"').click();
    // Modal aberto
    await expect(page.getByText(/Versão .*Clone Mint-Y Dark/)).toBeVisible();
    // Esc fecha
    await page.keyboard.press('Escape');
    await expect(page.getByText(/Versão .*Clone Mint-Y Dark/)).not.toBeVisible();
  });

  test('seleção em lote atualiza BatchActionBar', async ({ page }) => {
    // Vai pra Todos
    await page.locator('button:has-text("Todos")').first().click();
    await page.waitForTimeout(500);
    // Pega primeiro checkbox
    const firstCheckbox = page.locator('[role="button"] >> nth=0').first();
    const ariaLabel = await firstCheckbox.getAttribute('aria-label');
    if (ariaLabel && ariaLabel.includes('Instalado')) {
      // Para instalados, click desmarcaria para remoção
    }
    // Ctrl+A marca todos visíveis
    await page.keyboard.press('Control+a');
    await page.waitForTimeout(200);
    // BatchActionBar deve aparecer com a ação de execução disponível
    await expect(page.getByRole('button', { name: /Executar Ações/ })).toBeVisible({ timeout: 3000 });
  });

  test('navegação não ressuscita DebugDock (regressão)', async ({ page }) => {
    // Força re-renders via navegação
    await page.locator('button:has-text("Início")').first().click();
    await page.locator('button:has-text("Acessórios")').first().click();
    await page.locator('button:has-text("Início")').first().click();
    await page.waitForTimeout(300);

    // DebugDock continua escondido
    await expect(page.locator('[title="Abrir painel de diagnóstico"]')).toHaveCount(0);
    await expect(page.locator('text=/DEBUG \\(\\d+\\)/')).toHaveCount(0);
  });
});
