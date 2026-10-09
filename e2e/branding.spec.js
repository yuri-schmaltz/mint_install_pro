import { readFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';

const version = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;
const icon = readFileSync(new URL('../icon_mip.svg', import.meta.url), 'utf8');

test('Sobre exibe a versão do manifesto e usa o SVG canônico também no favicon', async ({ page }) => {
  await page.route('**/api/**', route => route.fulfill({
    json: { apt: [], flatpaks: [], aptStatus: 'available', flatpakStatus: 'available' }
  }));
  await page.goto('/');
  const favicon = page.locator('link[rel="icon"][type="image/svg+xml"]');
  expect(await favicon.evaluate(async element => (await fetch(element.href)).text())).toBe(icon);
  await page.getByTitle('Menu do aplicativo').click();
  await page.getByText('Sobre o Gerenciador', { exact: true }).click();
  await expect(page.getByText(`Versão ${version} (Clone Mint-Y Dark)`, { exact: true })).toBeVisible();
  const image = page.getByRole('img', { name: 'Mint Install Pro', exact: true });
  await expect(image).toBeVisible();
  await expect.poll(() => image.evaluate(element => element.complete && element.naturalWidth > 0)).toBe(true);
  const trees = await image.evaluate(async (element, source) => {
    // Vite can inline/minify SVGs. Compare their element trees so whitespace
    // and comment formatting do not obscure a different icon or geometry.
    const parse = text => {
      const tree = new DOMParser().parseFromString(text, 'image/svg+xml');
      const normalize = node => ({
        tag: node.tagName,
        attributes: [...node.attributes].map(attribute => [attribute.name, attribute.value]).sort(),
        children: [...node.children].map(normalize)
      });
      return normalize(tree.documentElement);
    };
    return { actual: parse(await (await fetch(element.currentSrc)).text()), expected: parse(source) };
  }, icon);
  expect(trees.actual).toEqual(trees.expected);
});
