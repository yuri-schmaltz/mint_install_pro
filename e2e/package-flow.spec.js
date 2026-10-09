import { test, expect } from '@playwright/test';

function batchResponse(operations, result) {
  return {
    contentType: 'application/x-ndjson',
    body: operations.map((_operation, index) => JSON.stringify({ index, result })).join('\n') + '\n'
  };
}

test.beforeEach(async ({ page }) => {
  await page.route('**/api/**', route => route.fulfill({ status: 503, json: { success: false, error: 'API não configurada no teste' } }));
  await page.route('**/api/installed', route => route.fulfill({ json: { apt: [], flatpaks: [], aptStatus: 'available', flatpakStatus: 'available' } }));
  await page.goto('/');
  await page.getByRole('button', { name: 'Todos', exact: true }).click();
});

test('lote confirma, termina e sincroniza instalação e remoção', async ({ page }) => {
  const installed = new Set();
  let calls = 0;
  await page.route('**/api/installed', route => route.fulfill({ json: { apt: [...installed], flatpaks: [], aptStatus: 'available', flatpakStatus: 'available' } }));
  await page.route('**/api/batch', route => {
    calls++;
    const { operations } = route.request().postDataJSON();
    for (const { id, action } of operations) {
      if (action === 'uninstall') installed.delete(id); else installed.add(id);
    }
    return route.fulfill(batchResponse(operations, { success: true, output: 'Operação de teste concluída' }));
  });
  const card = page.locator('.gtk-card').first();
  await card.locator('[title="Não instalado (clique para marcar e instalar)"]').click();
  await page.getByRole('button', { name: /Executar Ações/ }).click();
  await expect(page.getByRole('dialog', { name: 'Confirmar operações em lote' })).toBeVisible();
  expect(calls).toBe(0);
  await page.getByRole('button', { name: 'Confirmar e executar' }).click();
  await expect(page.getByText('Operação finalizada: 1 sucesso(s), 0 falha(s).')).toBeVisible();
  expect(calls).toBe(1);
  await page.getByRole('button', { name: 'Concluir', exact: true }).click();
  await expect(card).toHaveAttribute('aria-label', /Instalado/);
  await card.locator('[title="Instalado no sistema (clique para desmarcar e desinstalar)"]').click();
  await page.getByRole('button', { name: /Executar Ações/ }).click();
  await page.getByRole('button', { name: 'Confirmar e executar' }).click();
  await expect(page.getByText('Operação finalizada: 1 sucesso(s), 0 falha(s).')).toBeVisible();
  await page.getByRole('button', { name: 'Concluir', exact: true }).click();
  await expect(card).not.toHaveAttribute('aria-label', /Instalado/);
  expect(calls).toBe(2);
});

test('falha do comando aparece como falha e preserva seleção', async ({ page }) => {
  await page.route('**/api/batch', route => route.fulfill(batchResponse(route.request().postDataJSON().operations, { success: false, output: 'Repositório indisponível' })));
  await page.locator('[title="Não instalado (clique para marcar e instalar)"]').first().click();
  await page.getByRole('button', { name: /Executar Ações/ }).click();
  await page.getByRole('button', { name: 'Confirmar e executar' }).click();
  await expect(page.getByText('Operação finalizada: 0 sucesso(s), 1 falha(s).')).toBeVisible();
  await expect(page.getByText('Falhou', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Concluir', exact: true }).click();
  await expect(page.getByRole('button', { name: /Executar Ações/ })).toBeVisible();
});

test('HTTP 429 nos detalhes não marca aplicativo como instalado', async ({ page }) => {
  await page.route('**/api/install', route => route.fulfill({ status: 429, json: { success: false, error: 'Outra operação em andamento' } }));
  await page.locator('.gtk-card').first().click();
  await page.getByRole('button', { name: 'Instalar', exact: true }).click();
  await expect(page.getByText('Outra operação em andamento', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Instalar', exact: true })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Remover', exact: true })).toHaveCount(0);
});

test('pesquisa Flathub exibe aplicativo ausente do catálogo local', async ({ page }) => {
  await page.route('https://flathub.org/api/v2/search', route => route.fulfill({ json: { hits: [
    { app_id: 'org.example.Novo', name: 'NovoAplicativoTeste', summary: 'Aplicativo online', verification_verified: true }
  ] } }));
  await page.getByRole('button', { name: 'Flatpak', exact: true }).click();
  await page.getByPlaceholder('Pesquisar aplicativos...').fill('NovoAplicativoTeste');
  await expect(page.locator('.gtk-card').filter({ hasText: 'NovoAplicativoTeste' })).toBeVisible();
});

test('instalados externos desaparecem após consulta vazia', async ({ page }) => {
  let apt = ['synapse'];
  await page.route('**/api/installed', route => route.fulfill({ json: { apt, flatpaks: [], aptStatus: 'available', flatpakStatus: 'available' } }));
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await page.getByRole('button', { name: /Instalados/ }).click();
  await expect(page.locator('.gtk-card').filter({ hasText: 'Synapse' })).toBeVisible();
  apt = [];
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.locator('.gtk-card')).toHaveCount(0);
});

test('ponte da API rejeita origem estrangeira e argumentos inválidos', async ({ request, baseURL }) => {
  // These requests bypass page mocks, but are rejected before any system command.
  const foreign = await request.post(`${baseURL}/api/install`, {
    headers: { Origin: 'https://example.invalid' }, data: { id: 'vlc', packageType: 'apt' }
  });
  expect(foreign.status()).toBe(403);
  const invalid = await request.post(`${baseURL}/api/install`, {
    headers: { Origin: baseURL }, data: { id: '--help', packageType: 'apt' }
  });
  expect(invalid.status()).toBe(400);
});

test('selecionar todos respeita o filtro de formato da grade', async ({ page }) => {
  await page.getByRole('button', { name: /Flatpak \(/ }).click();
  await page.keyboard.press('Control+a');
  await page.getByRole('button', { name: /Executar Ações/ }).click();
  const names = await page.getByRole('dialog').locator('li').allTextContents();
  expect(names).toHaveLength(200);
});

test('preferência permite executar lote sem a etapa de confirmação', async ({ page }) => {
  await page.evaluate(() => localStorage.setItem('mint_settings_v1', JSON.stringify({ confirmBatchAction: false })));
  await page.reload();
  await page.getByRole('button', { name: 'Todos', exact: true }).click();
  await page.route('**/api/batch', route => route.fulfill(batchResponse(route.request().postDataJSON().operations, { success: false, output: 'Falha de teste' })));
  await page.locator('[title="Não instalado (clique para marcar e instalar)"]').first().click();
  await page.getByRole('button', { name: /Executar Ações/ }).click();
  await expect(page.getByText('Operação finalizada: 0 sucesso(s), 1 falha(s).')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Confirmar e executar' })).toHaveCount(0);
});

test('resposta antiga do Flathub não substitui a pesquisa atual', async ({ page }) => {
  let releaseOld;
  const oldResponse = new Promise(resolve => { releaseOld = resolve; });
  await page.route('https://flathub.org/api/v2/search', async route => {
    const { query } = route.request().postDataJSON();
    if (query === 'AntigoTeste') await oldResponse;
    await route.fulfill({ json: { hits: [{ app_id: `org.example.${query}`, name: query, verification_verified: true }] } });
  });
  await page.getByRole('button', { name: 'Flatpak', exact: true }).click();
  const oldRequest = page.waitForRequest(request => request.url().includes('/api/v2/search') && request.postDataJSON().query === 'AntigoTeste');
  await page.getByPlaceholder('Pesquisar aplicativos...').fill('AntigoTeste');
  await oldRequest;
  await page.getByPlaceholder('Pesquisar aplicativos...').fill('AtualTeste');
  await expect(page.locator('.gtk-card').filter({ hasText: 'AtualTeste' })).toBeVisible();
  releaseOld();
  await expect(page.locator('.gtk-card').filter({ hasText: 'AntigoTeste' })).toHaveCount(0);
});


test('vários programas e lote misto usam uma única requisição por execução', async ({ page }) => {
  const installed = new Set();
  const batches = [];
  await page.route('**/api/installed', route => route.fulfill({ json: {
    apt: [...installed], flatpaks: [], aptStatus: 'available', flatpakStatus: 'available'
  } }));
  await page.route('**/api/batch', route => {
    const { operations } = route.request().postDataJSON();
    batches.push(operations);
    operations.forEach(({ id, action }) => action === 'install' ? installed.add(id) : installed.delete(id));
    return route.fulfill(batchResponse(operations, { success: true, output: 'ok' }));
  });
  const cards = page.locator('.gtk-card');
  for (let i = 0; i < 2; i++) {
    await cards.nth(i).locator('[title="Não instalado (clique para marcar e instalar)"]').click();
  }
  await page.getByRole('button', { name: /Executar Ações/ }).click();
  await page.getByRole('button', { name: 'Confirmar e executar' }).click();
  await expect(page.getByText('Operação finalizada: 2 sucesso(s), 0 falha(s).')).toBeVisible();
  expect(batches).toHaveLength(1);
  expect(batches[0]).toHaveLength(2);
  await page.getByRole('button', { name: 'Concluir', exact: true }).click();
  for (let i = 0; i < 2; i++) {
    await cards.nth(i).locator('[title="Instalado no sistema (clique para desmarcar e desinstalar)"]').click();
  }
  await cards.nth(2).locator('[title="Não instalado (clique para marcar e instalar)"]').click();
  await page.getByRole('button', { name: /Executar Ações/ }).click();
  await page.getByRole('button', { name: 'Confirmar e executar' }).click();
  await expect(page.getByText('Operação finalizada: 3 sucesso(s), 0 falha(s).')).toBeVisible();
  expect(batches).toHaveLength(2);
  expect(batches[1].map(operation => operation.action)).toEqual(['uninstall', 'uninstall', 'install']);
});

test('componentes protegidos exibem aviso, bloqueiam Remover e são excluídos de Marcar Todos', async ({ page }) => {
  let mutations = 0;
  await page.route('**/api/installed', route => route.fulfill({ json: {
    apt: ['grep', 'vlc'], flatpaks: [], aptStatus: 'available', flatpakStatus: 'available',
    protectedPackages: { grep: 'Pacote essencial para o funcionamento do sistema.' }
  } }));
  await page.route('**/api/uninstall', route => {
    mutations++;
    return route.fulfill({ status: 403, json: { success: false, error: 'Remoção bloqueada.' } });
  });
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  const search = page.getByRole('textbox', { name: 'Pesquisar aplicativos' });
  await search.fill('grep');
  const card = page.getByRole('button', { name: /^Grep\./ });
  await expect(card.getByText('Protegido', { exact: true })).toBeVisible();
  const selection = card.getByTitle('Remoção bloqueada: Pacote essencial para o funcionamento do sistema.');
  await expect(selection).toHaveAttribute('aria-disabled', 'true');
  await selection.click();
  await expect(page.getByRole('button', { name: /Executar Ações/ })).toHaveCount(0);
  await card.click();
  await expect(page.getByText('Componente protegido do sistema — remoção bloqueada')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Remover', exact: true })).toBeDisabled();
  expect(mutations).toBe(0);
  await page.getByRole('button', { name: 'Fechar detalhes' }).first().click();
  await search.fill('');
  await page.getByRole('button', { name: /Instalados/ }).click();
  await expect(page.locator('.gtk-card')).toHaveCount(2);
  await page.getByTitle('Marcar todos da lista para instalação/desinstalação em lote').click();
  await expect(page.getByRole('button', { name: /Executar Ações/ })).toBeVisible();
  await page.getByRole('button', { name: /Executar Ações/ }).click();
  const dialog = page.getByRole('dialog', { name: 'Confirmar operações em lote' });
  await expect(dialog.locator('li')).toHaveCount(1);
  await expect(dialog.locator('li')).not.toHaveText(/Grep/);
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  expect(mutations).toBe(0);
});
