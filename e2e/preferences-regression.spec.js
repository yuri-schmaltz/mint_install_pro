import { readFile } from 'node:fs/promises';
import { test, expect } from '@playwright/test';

const catalog = [
  { id: 'vlc', name: 'VLC', summary: 'Reprodutor multimídia', description: 'Vídeos e música', packageType: 'APT', kind: 'apt', category: 'accessories', rating: 4.8 },
  { id: 'gimp', name: 'Editor de imagens com um nome longo para verificar o layout', summary: 'Editor de imagens', packageType: 'APT', kind: 'apt', category: 'graphics', rating: 4.7 },
  { id: 'grep', name: 'Grep', summary: 'Pesquisa de texto', packageType: 'APT', kind: 'apt', category: 'accessories', rating: 4.6 }
];
const snapshot = { apt: ['vlc', 'grep'], flatpaks: [], aptStatus: 'available', flatpakStatus: 'available',
  protectedPackages: { grep: 'Pacote essencial para o funcionamento do sistema.' } };

async function openSettings(page, tab = 'Pesquisa') {
  await page.getByTitle('Menu do aplicativo').click();
  await page.getByText('Preferências', { exact: true }).click();
  await page.getByRole('button', { name: tab, exact: true }).click();
}

test.beforeEach(async ({ page }) => {
  await page.route('**/data/catalog.json', route => route.fulfill({ json: catalog }));
  await page.route('**/api/**', route => route.fulfill({ status: 503, json: { success: false, error: 'Operação não configurada no teste' } }));
  await page.route('**/api/installed', route => route.fulfill({ json: snapshot }));
});

for (const viewport of [{ width: 1280, height: 900 }, { width: 820, height: 650 }, { width: 390, height: 650 }]) {
  test(`preferências com três abas e controles acessíveis em ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('/');
    await openSettings(page);
    for (const [name, content] of [
      ['Pesquisa', 'Opções Gerais de Pesquisa'],
      ['Flatpaks', 'Gerenciamento de Flatpaks & Flathub'],
      ['Operações & Lote', 'Preferências de Execução de Pacotes']
    ]) {
      await page.getByRole('button', { name, exact: true }).click();
      await expect(page.getByText(content, { exact: true })).toBeVisible();
      const button = await page.getByRole('button', { name, exact: true }).boundingBox();
      expect(button.x).toBeGreaterThanOrEqual(0);
      expect(button.x + button.width).toBeLessThanOrEqual(viewport.width);
    }
    await expect(page.getByText('Sistema & Padrão', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Integração com o Sistema Operacional', { exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Atualizar Agora|Restaurar/ })).toHaveCount(0);
    await page.getByRole('button', { name: 'Fechar', exact: true }).click();
    await expect(page.getByText('Preferências do Gerenciador', { exact: true })).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test(`cards neutros, checkbox preservado e rótulos à direita em ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('/');
    await page.getByRole('button', { name: 'Todos', exact: true }).click();
    const vlc = page.locator('.gtk-card').filter({ has: page.getByRole('heading', { name: 'VLC', exact: true }) });
    const editor = page.locator('.gtk-card').filter({ has: page.getByRole('heading', { name: catalog[1].name, exact: true }) });
    await expect(vlc).toHaveAttribute('aria-label', /Instalado/);
    const normalStyle = card => card.evaluate(element => ({
      background: getComputedStyle(element).backgroundColor,
      image: getComputedStyle(element).backgroundImage
    }));
    expect(await normalStyle(vlc)).toEqual(await normalStyle(editor));
    await expect(vlc.locator('[title^="Instalado no sistema"] svg')).toBeVisible();
    await vlc.locator('[title^="Instalado no sistema"]').click();
    await editor.locator('[title^="Não instalado"]').click();
    for (const [card, label] of [[vlc, 'Desinstalar'], [editor, 'Instalar']]) {
      const badge = await card.getByText(label, { exact: true }).boundingBox();
      const title = await card.locator('h3').boundingBox();
      const bounds = await card.boundingBox();
      expect(badge.x).toBeGreaterThanOrEqual(title.x + title.width);
      expect(bounds.x + bounds.width - badge.x - badge.width).toBeLessThan(18);
      expect(Math.abs(title.y + title.height / 2 - badge.y - badge.height / 2)).toBeLessThan(3);
    }
    await expect(page.getByRole('button', { name: /Executar Ações/ })).toBeVisible();
    await expect(page.getByText('2 selecionados', { exact: true })).toHaveCount(0);
    // O único Marcar Todos é o controle da grade, fora da barra inferior.
    await expect(page.getByRole('button', { name: 'Marcar Todos', exact: true })).toHaveCount(0);
  });
}

for (const [tab, label] of [
  ['Pesquisa', 'Buscar no resumo dos pacotes'],
  ['Pesquisa', 'Buscar na descrição detalhada'],
  ['Pesquisa', 'Limitar busca à categoria selecionada'],
  ['Flatpaks', 'Busca online ao vivo no Flathub'],
  ['Flatpaks', 'Incluir resultados online não verificados'],
  ['Operações & Lote', 'Confirmar operações em lote']
]) {
  test(`persiste ${label} ao fechar, reabrir e recarregar`, async ({ page }) => {
    await page.goto('/');
    await openSettings(page, tab);
    const input = page.getByRole('checkbox', { name: new RegExp(label) });
    const initial = await input.isChecked();
    await input.setChecked(!initial);
    await page.getByRole('button', { name: 'Fechar', exact: true }).click();
    await openSettings(page, tab);
    expect(await input.isChecked()).toBe(!initial);
    await page.reload();
    await openSettings(page, tab);
    expect(await input.isChecked()).toBe(!initial);
    await input.setChecked(initial);
  });
}

for (const value of ['apt', 'flatpak', 'all']) {
  test(`persiste preferência de formato ${value}`, async ({ page }) => {
    await page.goto('/');
    await openSettings(page, 'Flatpaks');
    await page.getByRole('combobox').selectOption(value);
    await page.reload();
    await openSettings(page, 'Flatpaks');
    await expect(page.getByRole('combobox')).toHaveValue(value);
  });
}

for (const text of ['{', 'null', '[]', '42']) {
  test(`preferências salvas inválidas não impedem abertura: ${text}`, async ({ page }) => {
    await page.addInitScript(value => localStorage.setItem('mint_settings_v1', value), text);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('/');
    await openSettings(page);
    await expect(page.getByRole('checkbox', { name: /Buscar no resumo/ })).toBeChecked();
    expect(errors).toEqual([]);
  });
}

test('Escape fecha preferências em qualquer aba e Ctrl+F seleciona o texto da pesquisa', async ({ page }) => {
  await page.goto('/');
  for (const tab of ['Pesquisa', 'Flatpaks', 'Operações & Lote']) {
    await openSettings(page, tab);
    await page.keyboard.press('Escape');
    await expect(page.getByText('Preferências do Gerenciador', { exact: true })).toHaveCount(0);
  }
  const input = page.getByRole('textbox', { name: 'Pesquisar aplicativos' });
  await input.fill('VLC');
  await page.getByTitle('Menu do aplicativo').focus();
  await page.keyboard.press('Control+f');
  await expect(input).toBeFocused();
  expect(await input.evaluate(element => [element.selectionStart, element.selectionEnd])).toEqual([0, 3]);
  await page.keyboard.type('Grep');
  await expect(input).toHaveValue('Grep');
  await expect(page.locator('.gtk-card')).toHaveCount(1);
});

test('exporta backup real somente dos instalados e cache mantém preferências', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Consultando os pacotes instalados...', { exact: true })).toHaveCount(0);
  await openSettings(page, 'Operações & Lote');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar', exact: true }).click();
  const download = await downloadPromise;
  expect(JSON.parse(await readFile(await download.path(), 'utf8'))).toEqual({ vlc: true, grep: true });
  await page.getByRole('checkbox', { name: /Confirmar operações/ }).uncheck();
  await page.getByRole('button', { name: 'Limpar Cache', exact: true }).click();
  await expect(page.getByText('Preferências do Gerenciador', { exact: true })).toHaveCount(0);
  await openSettings(page, 'Operações & Lote');
  await expect(page.getByRole('checkbox', { name: /Confirmar operações/ })).not.toBeChecked();
});

test('importar backup seleciona somente não instalados conhecidos e não executa comandos', async ({ page }) => {
  let mutations = 0;
  await page.route('**/api/batch', route => { mutations++; return route.fulfill({ status: 503, json: {} }); });
  await page.goto('/');
  await openSettings(page, 'Operações & Lote');
  await page.locator('input[type="file"]').setInputFiles({
    name: 'backup.json', mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({ vlc: true, grep: true, gimp: true, unknown: true, wrong: 'true' }))
  });
  await expect(page.getByText('Preferências do Gerenciador', { exact: true })).toHaveCount(0);
  await expect(page.getByText('1 para instalar', { exact: true })).toBeVisible();
  await expect(page.getByText('Desinstalar', { exact: true })).toHaveCount(0);
  await expect(page.locator('.gtk-card').filter({ hasText: catalog[1].name }).getByText('Instalar', { exact: true })).toBeVisible();
  expect(mutations).toBe(0);
});

test('backup inválido mostra erro e permite importar outro arquivo', async ({ page }) => {
  await page.goto('/');
  await openSettings(page, 'Operações & Lote');
  const upload = page.locator('input[type="file"]');
  await upload.setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from('null') });
  await expect(page.getByText('Arquivo inválido', { exact: true })).toBeVisible();
  await expect(page.getByText('Preferências do Gerenciador', { exact: true })).toBeVisible();
  await upload.setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from('{"gimp":true}') });
  await expect(page.getByText('1 para instalar', { exact: true })).toBeVisible();
});
