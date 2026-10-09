import { test, expect } from '@playwright/test';

const catalog = Array.from({ length: 1800 }, (_, index) => ({
  id: `scroll-app-${String(index).padStart(4, '0')}`,
  name: `Aplicativo ${String(index).padStart(4, '0')}`,
  summary: 'Aplicativo para verificar a rolagem do catálogo',
  category: index % 2 ? 'graphics' : 'accessories',
  packageType: index % 5 ? 'APT' : 'Flatpak',
  flathub: index % 5 === 0,
  kind: index % 5 ? 'apt' : 'flatpak',
  icon: '/icons/software-manager.png',
  rating: 4.5
}));
const installed = catalog.slice(0, 180);
const snapshot = {
  apt: installed.filter(app => app.kind === 'apt').map(app => app.id),
  flatpaks: installed.filter(app => app.kind === 'flatpak').map(app => app.id),
  aptStatus: 'available', flatpakStatus: 'available',
  protectedPackages: { [catalog[1].id]: 'Componente essencial do sistema' }
};

const cards = page => page.locator('.app-grid-scroll .gtk-card');
const scroller = page => page.locator('.app-grid-scroll');
const card = (page, index) => cards(page).filter({ has: page.getByRole('heading', { name: catalog[index].name, exact: true }) });
const scrollTo = (page, position) => scroller(page).evaluate((element, target) => {
  element.scrollTop = target === 'bottom' ? element.scrollHeight : target;
}, position);

async function assertBounded(page) {
  await expect.poll(() => cards(page).count()).toBeLessThanOrEqual(90);
  expect(await cards(page).count()).toBeGreaterThan(0);
}

test.beforeEach(async ({ page }) => {
  await page.route('**/data/catalog.json', route => route.fulfill({ json: catalog }));
  await page.route('**/api/**', route => route.fulfill({ status: 503, json: { error: 'Operações bloqueadas neste teste' } }));
  await page.route('**/api/installed', route => route.fulfill({ json: snapshot }));
  await page.goto('/');
  await page.getByRole('button', { name: 'Todos', exact: true }).click();
  await expect(card(page, 0)).toBeVisible();
});

for (const [width, columns] of [[390, 1], [820, 2], [1280, 3]]) {
  test(`rolagem de 1800 apps com ${columns} coluna(s): altura estável e DOM limitado`, async ({ page }) => {
    await page.setViewportSize({ width, height: 842 });
    await expect.poll(() => scroller(page).locator('.grid').evaluate(element =>
      getComputedStyle(element).gridTemplateColumns.split(' ').length)).toBe(columns);
    const height = await scroller(page).evaluate(element => element.scrollHeight);
    expect(height).toBeGreaterThan(1800 / columns * 74);
    for (const target of [height / 4, height / 2, 'bottom']) {
      await scrollTo(page, target);
      await expect.poll(() => cards(page).first().locator('h3').textContent()).not.toBe(catalog[0].name);
      await assertBounded(page);
      expect(await scroller(page).evaluate(element => element.scrollHeight)).toBe(height);
    }
    await expect(card(page, 1799)).toBeVisible();
    await page.mouse.move(width / 2, 500);
    await page.mouse.wheel(0, -2000);
    await expect(card(page, 1799)).not.toBeVisible();
    await scrollTo(page, 0);
    await expect(card(page, 0)).toBeVisible();
    await assertBounded(page);
    expect(await scroller(page).evaluate(element => element.scrollHeight)).toBe(height);
    await expect(page.getByText(/Carregando mais aplicativos|Clique para carregar mais/)).toHaveCount(0);
  });
}

test('seleção e proteção permanecem após reciclar cards; Marcar Todos inclui itens fora da tela', async ({ page }) => {
  await card(page, 0).locator('[title^="Instalado no sistema"]').click();
  await card(page, 2).locator('[title^="Instalado no sistema"]').click();
  await expect(card(page, 1).getByText('Protegido')).toBeVisible();
  await scrollTo(page, 'bottom');
  await expect(card(page, 1799)).toBeVisible();
  await card(page, 1799).locator('[title^="Não instalado"]').click();
  await scrollTo(page, 0);
  await expect(card(page, 0).getByText('Desinstalar', { exact: true })).toBeVisible();
  await expect(card(page, 2).getByText('Desinstalar', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Marcar Todos', exact: true }).click();
  await page.getByRole('button', { name: /Executar Ações/ }).click();
  const dialog = page.getByRole('dialog', { name: 'Confirmar operações em lote' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('1620 para instalar e 179 para remover.', { exact: true })).toBeVisible();
  // Não executa operações; também confirma que o pacote protegido não entrou na seleção.
  await expect(dialog.getByText('Remover: Aplicativo 0001', { exact: true })).toHaveCount(0);
});

test('pesquisa, formato, categoria e instalados funcionam após rolar ao fim', async ({ page }) => {
  await scrollTo(page, 'bottom');
  await expect(card(page, 1799)).toBeVisible();
  await page.getByPlaceholder('Pesquisar aplicativos...').fill(catalog[1700].name);
  await expect(card(page, 1700)).toBeVisible();
  await expect(cards(page)).toHaveCount(1);
  expect(await scroller(page).evaluate(element => element.scrollTop)).toBe(0);
  await page.getByPlaceholder('Pesquisar aplicativos...').fill('Sem resultado correspondente');
  await expect(page.getByText('Nenhum aplicativo encontrado')).toBeVisible();
  await page.getByPlaceholder('Pesquisar aplicativos...').fill('');
  await expect(card(page, 0)).toBeVisible();
  await page.getByRole('button', { name: /^APT \(/ }).click();
  await expect(card(page, 1)).toBeVisible();
  await scrollTo(page, 'bottom');
  await expect(card(page, 1799)).toBeVisible();
  await page.getByRole('button', { name: /^Flatpak \(/ }).click();
  await expect(card(page, 0)).toBeVisible();
  await scrollTo(page, 'bottom');
  await expect(card(page, 1795)).toBeVisible();
  await page.getByRole('button', { name: 'Gráficos', exact: true }).click();
  await expect(card(page, 5)).toBeVisible();
  await page.getByRole('button', { name: 'Todos', exact: true }).click();
  await page.getByRole('button', { name: /^Todos \(/ }).click();
  await page.getByRole('button', { name: 'Instalados', exact: true }).click();
  await expect(page.getByText('(180 aplicativos)', { exact: true })).toBeVisible();
  await scrollTo(page, 'bottom');
  await expect(card(page, 179)).toBeVisible();
  await assertBounded(page);
});

test('Tab atravessa a janela renderizada e abre detalhes de um app distante', async ({ page }) => {
  await card(page, 0).focus();
  for (let index = 1; index <= 90; index++) {
    await page.keyboard.press('Tab');
    await expect(card(page, index)).toBeFocused();
  }
  for (let index = 89; index >= 45; index--) {
    await page.keyboard.press('Shift+Tab');
    await expect(card(page, index)).toBeFocused();
  }
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: catalog[45].name, exact: true }).last()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Fechar detalhes' }).first()).toBeVisible();
  await assertBounded(page);
});

test('redimensionamento e atualização do inventário preservam uma lista utilizável', async ({ page }) => {
  await scrollTo(page, 'bottom');
  await expect(card(page, 1799)).toBeVisible();
  for (const width of [390, 820, 1280]) {
    await page.setViewportSize({ width, height: 650 });
    await scrollTo(page, 'bottom');
    await expect(card(page, 1799)).toBeVisible();
    await assertBounded(page);
  }
  const before = await scroller(page).evaluate(element => element.scrollTop);
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(card(page, 1799)).toBeVisible();
  expect(await scroller(page).evaluate(element => element.scrollTop)).toBe(before);
  await page.getByRole('button', { name: 'Instalados', exact: true }).click();
  await scrollTo(page, 'bottom');
  await expect(card(page, 179)).toBeVisible();
  await page.route('**/api/installed', route => route.fulfill({ json: { ...snapshot, apt: [], flatpaks: [] } }));
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(cards(page)).toHaveCount(0);
  await expect(page.getByText('Nenhum aplicativo encontrado')).toBeVisible();
});
