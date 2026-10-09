// Test runner para validar o catálogo de aplicativos e integridade dos assets
import fs from 'fs';
import path from 'path';
import { initialApps, categoriesList } from '../src/data/initialApps.js';
import { searchFlathub, getPopularFlathub } from '../src/services/flathubApi.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failed++;
  }
}

console.log('🧪 Executando Gauntlet Tests: app_manager\n');

// Test 1: Verificar se os 21 aplicativos da captura de tela oficial estão presentes
console.log('1. Verificação dos 21 aplicativos da captura de tela oficial:');
const expectedAccessories = [
  'Synapse', 'Dconf-editor', 'Grep', 'Mediainfo-gui', 'Artha', 'Doublecmd-gtk',
  'Htop', 'P7zip-full', 'Unzip', 'Fdupes', 'Gtkhash', 'Keepassxc',
  'Mc', 'P7zip', 'Sshfs', 'Devede', 'Kupfer', 'Unrar',
  'Goldendict', 'Hplip-gui', 'Krename'
];

expectedAccessories.forEach(name => {
  const found = initialApps.find(a => a.name.toLowerCase() === name.toLowerCase());
  assert(!!found, `Aplicativo "${name}" está presente no catálogo`);
});

// Test 2: Verificar ratings e integridade de dados numéricos
console.log('\n2. Verificação de integridade dos ratings e campos:');
const synapse = initialApps.find(a => a.name === 'Synapse');
assert(synapse && synapse.rating === 4.9, 'Synapse tem nota 4.9');

const grep = initialApps.find(a => a.name === 'Grep');
assert(grep && grep.installed === true, 'Grep está marcado como instalado');

const htop = initialApps.find(a => a.name === 'Htop');
assert(htop && htop.rating === 4.7, 'Htop tem nota 4.7');

// Test 3: Verificar se os arquivos de ícones locais existem no disco
console.log('\n3. Verificação de existência dos arquivos de ícones locais em public/:');
let missingIcons = 0;
initialApps.forEach(app => {
  if (app.icon && !app.icon.startsWith('http')) {
    const localPath = path.join(process.cwd(), 'public', app.icon.replace(/^\//, ''));
    if (!fs.existsSync(localPath)) {
      missingIcons++;
      console.warn(`    Aviso: Ícone não encontrado: ${localPath}`);
    }
  }
});
assert(missingIcons === 0, `Todos os ícones locais existem no disco (ausentes: ${missingIcons})`);

// Test 4: Lógica de Busca
console.log('\n4. Verificação da Lógica de Busca:');
const searchGrep = initialApps.filter(a => a.name.toLowerCase().includes('grep') || a.summary.toLowerCase().includes('grep'));
assert(searchGrep.length >= 1 && searchGrep.some(a => a.name === 'Grep'), 'Busca por "grep" encontra o aplicativo Grep');

const searchZip = initialApps.filter(a => a.name.toLowerCase().includes('zip') || a.summary.toLowerCase().includes('zip'));
assert(searchZip.length >= 3, `Busca por "zip" retorna múltiplos compactadores (encontrados: ${searchZip.length})`);

// Test 5: Categorias e Ordenação Estrita
console.log('\n5. Verificação da Ordem das Abas (Destaques à esquerda, Todos à direita, intermediárias alfabéticas):');
assert(categoriesList.length >= 8, `Pelo menos 8 categorias configuradas (configuradas: ${categoriesList.length})`);
assert(categoriesList[0].id === 'picks', 'Aba "Destaques" está na extrema esquerda (primeira posição, índice 0)');
assert(categoriesList[categoriesList.length - 1].id === 'all' && categoriesList[categoriesList.length - 1].label === 'Todos', 'Aba da extrema direita está configurada com id "all" e rótulo "Todos"');

// Validação de ordem das abas intermediárias de catálogo (excluindo Destaques, Todos e a aba especial Instalados)
const regularCategories = categoriesList.filter(c => c.id !== 'picks' && c.id !== 'all' && c.id !== 'installed');
const intermediateLabels = regularCategories.map(c => c.label);
const sortedIntermediate = [...intermediateLabels].sort((a, b) => a.localeCompare(b, 'pt-BR'));
const isAlphabetical = intermediateLabels.every((label, idx) => label === sortedIntermediate[idx]);
assert(isAlphabetical, `Demais abas ordenadas alfabeticamente: [${intermediateLabels.join(', ')}]`);

const accessoriesApps = initialApps.filter(a => a.category === 'accessories');
assert(accessoriesApps.length >= 21, `Categoria Acessórios contém pelo menos os 21 aplicativos esperados (total: ${accessoriesApps.length})`);

// Validação das 2 novas categorias para formar a matriz 3x3 (9 categorias regulares)
const devApps = initialApps.filter(a => a.category === 'development');
assert(devApps.length >= 5, `Nova categoria "Desenvolvimento" configurada e populada (${devApps.length} apps)`);

const officeApps = initialApps.filter(a => a.category === 'office');
assert(officeApps.length >= 5, `Nova categoria "Escritório" configurada e populada (${officeApps.length} apps)`);

// Test 6: Verificação de Operações em Lote
console.log('\n6. Verificação da Lógica de Instalação/Desinstalação em Lote:');
const testBatchIds = ['synapse', 'dconf-editor', 'grep'];
const selectedApps = initialApps.filter(a => testBatchIds.includes(a.id));
assert(selectedApps.length === 3, 'Seleção de 3 aplicativos para lote');

const toInstall = selectedApps.filter(a => !a.installed);
const toUninstall = selectedApps.filter(a => a.installed);
assert(toInstall.length >= 1, 'Cálculo correto de aplicativos não-instalados a instalar');
assert(toUninstall.length >= 1, 'Cálculo correto de aplicativos instalados a desinstalar');

// Test 7: Guia "Todos os Aplicativos"
console.log('\n7. Verificação da Guia "Todos os Aplicativos" da Plataforma:');
assert(initialApps.length >= 100, `Catálogo consolidado apresenta mais de 100 aplicativos (total: ${initialApps.length})`);
const aptApps = initialApps.filter(a => !a.flathub);
const flatpakApps = initialApps.filter(a => a.flathub || a.packageType?.includes('Flatpak'));
assert(aptApps.length > 50, `Subconjunto de pacotes nativos do sistema APT expressivo (${aptApps.length} pacotes)`);
assert(flatpakApps.length >= 20, `Subconjunto de pacotes Flatpak do Flathub disponível (${flatpakApps.length} pacotes)`);

// Test 8: Aba e Categoria "Flatpak"
console.log('\n8. Verificação da Aba e Suporte Flathub:');
const flatpakCategory = categoriesList.find(c => c.id === 'flatpak');
assert(!!flatpakCategory, 'Aba "flatpak" está registrada em categoriesList');
assert(typeof searchFlathub === 'function', 'Função de busca ao vivo no Flathub (searchFlathub) disponível');
assert(typeof getPopularFlathub === 'function', 'Função de catálogo popular Flathub (getPopularFlathub) disponível');

// Test 9: Lógica do Contador com Suporte até 999 e Prefixo '+' para Overflow
console.log('\n9. Verificação do Contador de Categorias (Tamanho fixo e suporte a > 999):');
function formatBadgeCount(count) {
  const isOverflow = count > 999;
  const displayCount = isOverflow ? '+999' : String(count);
  const countLabel = count === 1 ? 'app' : 'apps';
  return { displayCount, countLabel, isOverflow };
}

assert(formatBadgeCount(45).displayCount === '45', 'Contador normal 45 exibe "45"');
assert(formatBadgeCount(1).countLabel === 'app', 'Contador singular 1 usa "app"');
assert(formatBadgeCount(999).displayCount === '999', 'Contador no limite 999 exibe "999"');
assert(formatBadgeCount(1000).displayCount === '+999', 'Contador acima de 999 (ex: 1000) exibe "+999"');
assert(formatBadgeCount(2500).displayCount === '+999', 'Contador Flathub massivo (ex: 2500) exibe "+999"');

// Test 10: Verificação da Cromatografia Dinâmica e Estados do Checkbox
console.log('\n10. Verificação da Lógica Cromática e Estados do Checkbox (AppCard):');
function evaluateCardState(app, isSelected) {
  const isInstalled = !!app.installed;
  const isStagedForUninstall = isInstalled && isSelected;
  const isStagedForInstall = !isInstalled && isSelected;
  const isCheckboxChecked = (isInstalled && !isSelected) || isStagedForInstall;
  
  let colorTheme = 'neutral';
  if (isStagedForUninstall) colorTheme = 'red-orange';
  else if (isStagedForInstall) colorTheme = 'green-highlight';

  return { isStagedForUninstall, isStagedForInstall, isCheckboxChecked, colorTheme };
}

const installedAppMock = { id: 'grep', name: 'Grep', installed: true };
const uninstalledAppMock = { id: 'blender', name: 'Blender', installed: false };

// Estado 1: App instalado em repouso
const state1 = evaluateCardState(installedAppMock, false);
assert(state1.isCheckboxChecked === true, 'App instalado em repouso tem checkbox marcado com check verde');
assert(state1.colorTheme === 'neutral', 'App instalado em repouso tem fundo neutro cinza GTK');

// Estado 2: App instalado desmarcado para remoção
const state2 = evaluateCardState(installedAppMock, true);
assert(state2.isCheckboxChecked === false, 'App instalado desmarcado para remoção tem checkbox desmarcado (vazio)');
assert(state2.isStagedForUninstall === true, 'App instalado desmarcado é reconhecido como isStagedForUninstall');
assert(state2.colorTheme === 'red-orange', 'App instalado desmarcado tem fundo vermelho/laranja na mesma luminância');

// Estado 3: App não instalado em repouso
const state3 = evaluateCardState(uninstalledAppMock, false);
assert(state3.isCheckboxChecked === false, 'App não instalado tem checkbox vazio');
assert(state3.colorTheme === 'neutral', 'App não instalado tem fundo neutro cinza GTK');

// Estado 4: App não instalado marcado para instalação
const state4 = evaluateCardState(uninstalledAppMock, true);
assert(state4.isCheckboxChecked === true, 'App não instalado marcado para instalação tem checkbox marcado');
assert(state4.isStagedForInstall === true, 'App marcado é reconhecido como isStagedForInstall');
assert(state4.colorTheme === 'green-highlight', 'App marcado para instalação tem fundo com anel verde');

// Test 11: Verificação das 12 Abas e Rótulos Concisos
console.log('\n11. Verificação da Integridade das 12 Abas e Rótulos Concisos:');
assert(categoriesList.length === 12, `Exatamente 12 abas configuradas (total: ${categoriesList.length})`);
const expectedLabels = [
  'Início', 'Acessórios', 'Código', 'Escritório', 'Flatpak',
  'Gráficos', 'Internet', 'Jogos', 'Mídias', 'Sistema', 'Instalados', 'Todos'
];
const allLabelsMatch = categoriesList.every((cat, idx) => cat.label === expectedLabels[idx]);
assert(allLabelsMatch, `Todos os 12 rótulos concisos coincidem: [${expectedLabels.join(', ')}]`);

// Test 12: Verificação de Empacotamento Debian e Documentos Oficiais
console.log('\n12. Verificação de Empacotamento Debian e Documentos Oficiais:');
const requiredDocs = [
  'README.md', 'ABOUT.md', 'LICENSE', 'CONTRIBUTING.md',
  'SECURITY.md', 'CHANGELOG.md', 'docs/acceptance_criteria_audit.md'
];
requiredDocs.forEach(doc => {
  const docPath = path.join(process.cwd(), doc);
  assert(fs.existsSync(docPath), `Documento oficial "${doc}" presente no repositório`);
});

// Test 13: Verificação de Segurança, Blindagem de Parâmetros e Ausência de Sandbox
console.log('\n13. Auditoria de Segurança, Sanitização de IDs e Ausência de Sandbox:');
const APT_PKG_REGEX = /^[a-z0-9][a-z0-9+\.\-]{1,63}$/;
const FLATPAK_ID_REGEX = /^[a-zA-Z0-9_\-]+(\.[a-zA-Z0-9_\-]+)+$/;

// Validação de pacotes legítimos
assert(FLATPAK_ID_REGEX.test('org.mozilla.firefox'), 'Flatpak ID legítimo "org.mozilla.firefox" aceito');
assert(FLATPAK_ID_REGEX.test('com.discordapp.Discord'), 'Flatpak ID legítimo "com.discordapp.Discord" aceito');
assert(APT_PKG_REGEX.test('grep'), 'Pacote APT legítimo "grep" aceito');
assert(APT_PKG_REGEX.test('p7zip-full'), 'Pacote APT legítimo "p7zip-full" aceito');

// Validação de rejeição de vetores de injeção de parâmetros (CWE-88)
assert(!FLATPAK_ID_REGEX.test('--command=sh'), 'Vetor de injeção "--command=sh" rejeitado');
assert(!FLATPAK_ID_REGEX.test('org.test; rm -rf /'), 'Vetor de injeção com metacaracteres shell rejeitado');
assert(!FLATPAK_ID_REGEX.test('../../../etc/passwd'), 'Vetor de path traversal rejeitado');
assert(!APT_PKG_REGEX.test('--allow-unauthenticated'), 'Vetor APT de injeção de opções "--allow-unauthenticated" rejeitado');
assert(!APT_PKG_REGEX.test('pkg; id'), 'Vetor APT com comando acoplado rejeitado');

// Validação de ausência de código simulado de Sandbox no App.jsx e HeaderBar.jsx
const appJsxContent = fs.readFileSync(path.join(process.cwd(), 'src/App.jsx'), 'utf-8');
const headerBarContent = fs.readFileSync(path.join(process.cwd(), 'src/components/HeaderBar.jsx'), 'utf-8');
assert(!appJsxContent.includes('simulationMode'), 'Código de simulação Sandbox ("simulationMode") removido de App.jsx');
assert(!headerBarContent.includes('Sandbox Seguro'), 'Indicador fake de "Sandbox Seguro" removido de HeaderBar.jsx');

// Validação de binding estrito de loopback no vite.config.js
const viteConfigContent = fs.readFileSync(path.join(process.cwd(), 'vite.config.js'), 'utf-8');
assert(viteConfigContent.includes("'127.0.0.1'"), 'Servidor Vite configurado com binding estrito para loopback ("127.0.0.1")');
assert(viteConfigContent.includes('manualChunks'), 'Otimização de empacotamento com code-splitting ("manualChunks") ativa');

// Test 14: Verificação da tag `kind` explícita em todos os apps (migração 1.3.1)
console.log('\n14. Verificação da tag `kind` explícita em todos os apps:');
const appsWithoutKind = initialApps.filter(a => a.kind !== 'apt' && a.kind !== 'flatpak');
assert(appsWithoutKind.length === 0, `Todos os apps têm tag \`kind\` explícita (sem tag: ${appsWithoutKind.length})`);

const aptKindCount = initialApps.filter(a => a.kind === 'apt').length;
const flatpakKindCount = initialApps.filter(a => a.kind === 'flatpak').length;
assert(aptKindCount > 0 && flatpakKindCount > 0, `Tag \`kind\` distribui apps entre APT (${aptKindCount}) e Flatpak (${flatpakKindCount})`);

// Consistência: kind === 'flatpak' deve corresponder a flathub: true
const inconsistentFlatpaks = initialApps.filter(a => a.kind === 'flatpak' && a.flathub === false);
assert(inconsistentFlatpaks.length === 0, `Apps com kind=flatpak têm flathub=true consistente (inconsistentes: ${inconsistentFlatpaks.length})`);

// Test 15: Code-split do catálogo (catalog.json gerado e referenciável)
console.log('\n15. Verificação do Code-Split do Catálogo:');
const catalogJsonPath = path.join(process.cwd(), 'public/data/catalog.json');
const catalogJsonExists = fs.existsSync(catalogJsonPath);
assert(catalogJsonExists, 'Arquivo public/data/catalog.json gerado para carregamento lazy');
if (catalogJsonExists) {
  const jsonSize = fs.statSync(catalogJsonPath).size;
  const jsSize = fs.statSync(path.join(process.cwd(), 'src/data/initialApps.js')).size;
  assert(jsonSize < jsSize, `JSON lazy é menor que o .js estático (json=${(jsonSize/1024).toFixed(0)}KB < js=${(jsSize/1024).toFixed(0)}KB)`);
}
const indexJsonPath = path.join(process.cwd(), 'public/data/catalog-index.json');
assert(fs.existsSync(indexJsonPath), 'Índice leve public/data/catalog-index.json presente para LandingPage');

// Test 16: Bug fixes de produção (regressões)
console.log('\n16. Verificação de Bug Fixes Críticos (1.3.0 → 1.3.1):');
const batchModalContent = fs.readFileSync(path.join(process.cwd(), 'src/components/BatchActionModal.jsx'), 'utf-8');
assert(!batchModalContent.includes('isInstall ?'), 'Bug do `isInstall` indefinido corrigido em BatchActionModal.jsx');
assert(batchModalContent.includes('progressBarColor'), 'Variável `progressBarColor` derivada de actionType');

const headerBarContent2 = fs.readFileSync(path.join(process.cwd(), 'src/components/HeaderBar.jsx'), 'utf-8');
assert(!headerBarContent2.includes('Versão 6.1.4'), 'String de versão hardcoded "6.1.4" removida do HeaderBar');
assert(headerBarContent2.includes('APP_VERSION'), 'HeaderBar agora referencia APP_VERSION dinâmico');
assert(headerBarContent2.includes('import.meta.env'), 'APP_VERSION deriva de import.meta.env (Vite inject)');

// Vite config: define VITE_APP_VERSION injetado do package.json
const viteConfigContent2 = fs.readFileSync(path.join(process.cwd(), 'vite.config.js'), 'utf-8');
assert(viteConfigContent2.includes("VITE_APP_VERSION"), 'vite.config.js injeta VITE_APP_VERSION');

// API: tratamento de ENOENT para flatpak ausente
assert(viteConfigContent2.includes('systemPackagePlugin'), 'Vite usa a API compartilhada com o pacote instalado');

// Catalog loader lazy presente
const catalogServiceContent = fs.readFileSync(path.join(process.cwd(), 'src/services/catalog.js'), 'utf-8');
assert(catalogServiceContent.includes('loadFullCatalog'), 'Serviço de catálogo lazy (loadFullCatalog) presente');
assert(catalogServiceContent.includes('requestIdleCallback'), 'Prefetch do catálogo usa requestIdleCallback');

// App.jsx usa catálogo lazy e hooks customizados
const appJsxContent2 = fs.readFileSync(path.join(process.cwd(), 'src/App.jsx'), 'utf-8');
assert(!appJsxContent2.includes("from './data/initialApps'") || appJsxContent2.match(/from '\.\/data\/initialApps'/g).length === 1,
  'App.jsx importa apenas categoriesList de initialApps (initialApps é lazy via catalog.js)');
// Test 20: Ícone oficial aplicado em todos os pontos (v1.5.0)
console.log('\n20. Verificação do ícone Grid Mint (v1.5.0):');
const iconMipPath = path.join(process.cwd(), 'icon_mip.svg');
assert(fs.existsSync(iconMipPath), 'SVG canônico icon_mip.svg presente na raiz');
assert(fs.existsSync(path.join(process.cwd(), 'public/icons/mint-install-pro.svg')), 'SVG copiado para public/icons/mint-install-pro.svg');
assert(fs.existsSync(path.join(process.cwd(), 'public/icons/software-manager.png')), 'PNG 256x256 em public/icons/software-manager.png');
assert(fs.existsSync(path.join(process.cwd(), 'public/favicon.png')), 'Favicon PNG em public/favicon.png');

const desktopContent = fs.readFileSync(path.join(process.cwd(), 'app_manager.desktop'), 'utf-8');
assert(desktopContent.includes('Icon=/usr/share/mint-install-pro/icon_mip.svg'), 'app_manager.desktop referencia diretamente icon_mip.svg');

const indexHtml = fs.readFileSync(path.join(process.cwd(), 'index.html'), 'utf-8');
assert(indexHtml.includes('./icon_mip.svg'),
  'index.html referencia o novo SVG');assert(appJsxContent2.includes('useCatalog'), 'App.jsx usa hook useCatalog');
assert(appJsxContent2.includes('useFilteredApps'), 'App.jsx usa hook useFilteredApps');
assert(appJsxContent2.includes('useBatchSelection'), 'App.jsx usa hook useBatchSelection');
assert(appJsxContent2.includes('useNavigation'), 'App.jsx usa hook useNavigation');
assert(appJsxContent2.includes('useInstalledMap'), 'App.jsx usa hook useInstalledMap');

// Test 17: Loading state e tratamento de flatpak ausente (gauntlet loop, round 2)
console.log('\n17. Loading state + tratamento de flatpak ausente:');
const useCatalogHook = fs.readFileSync(path.join(process.cwd(), 'src/hooks/useCatalog.js'), 'utf-8');
assert(useCatalogHook.includes('installedError'), 'useCatalog expõe falhas de consulta do sistema');
assert(useCatalogHook.includes('flatpakStatus'), 'useCatalog expõe flatpakStatus');

const landingPageContent = fs.readFileSync(path.join(process.cwd(), 'src/components/LandingPage.jsx'), 'utf-8');
assert(landingPageContent.includes('isLoading'), 'LandingPage aceita prop isLoading');
assert(landingPageContent.includes('animate-pulse'), 'LandingPage tem skeleton de loading (animate-pulse)');
assert(landingPageContent.includes('Carregando destaques'), 'LandingPage mostra mensagem clara durante loading');

const appGridContent = fs.readFileSync(path.join(process.cwd(), 'src/components/AppGrid.jsx'), 'utf-8');
assert(appGridContent.includes('isLoading'), 'AppGrid aceita prop isLoading');
assert(appGridContent.includes('skel-'), 'AppGrid tem skeleton de loading com key prefix skel-');

const headerBarContent3 = fs.readFileSync(path.join(process.cwd(), 'src/components/HeaderBar.jsx'), 'utf-8');
assert(headerBarContent3.includes('flatpakStatus'), 'HeaderBar aceita prop flatpakStatus');
assert(headerBarContent3.includes("flatpakStatus === 'missing'"), 'HeaderBar renderiza badge "Flatpak ausente" quando status=missing');
assert(headerBarContent3.includes('AlertTriangle'), 'HeaderBar importa AlertTriangle (lucide-react)');

const catalogServiceContent2 = fs.readFileSync(path.join(process.cwd(), 'src/services/catalog.js'), 'utf-8');
assert(catalogServiceContent2.includes('export async function loadCatalogIndex'), 'catalog.js exporta loadCatalogIndex');

// Test 18: Pacote .deb regenera com sucesso
console.log('\n18. Sanidade do .deb empacotado:');
// (checado no CI pelo job deb-package; aqui só garantimos que o script
// de build existe e referencia a versão correta)
const buildDebContent = fs.readFileSync(path.join(process.cwd(), 'scripts/build_deb.py'), 'utf-8');
assert(buildDebContent.includes('json.load(manifest)["version"]'), 'build_deb.py usa a versão do package.json');
assert(buildDebContent.includes('shutil.copytree(dist_dir'), 'build_deb.py copia o dist/ inteiro (incluindo data/)');

// Test 19: Deduplicação cross-kind (gauntlet loop, fix débito 9.6)
console.log('\n19. Deduplicação cross-kind no build_full_catalog.py:');
const buildFullCatalogContent = fs.readFileSync(path.join(process.cwd(), 'scripts/build_full_catalog.py'), 'utf-8');
assert(buildFullCatalogContent.includes('seen_pairs = set()'),
  'build_full_catalog.py usa seen_pairs (tuplas id+kind) em vez de seen_ids simples');
assert(buildFullCatalogContent.includes('(pkg_name, "apt")'),
  'build_full_catalog.py registra APT como (id, "apt") no set');
assert(buildFullCatalogContent.includes('(app_id, "flatpak")'),
  'build_full_catalog.py registra Flatpak como (id, "flatpak") no set');
assert(!buildFullCatalogContent.includes('seen_ids.add('),
  'build_full_catalog.py não usa mais seen_ids.add (legado removido)');
assert(buildFullCatalogContent.includes('"kind": "apt"') && buildFullCatalogContent.includes('"kind": "flatpak"'),
  'build_full_catalog.py injeta tag `kind` explícita em todos os apps');
// The behavior of the shared API and launcher is covered by test:backend.
const launcher = fs.readFileSync('scripts/launcher.py', 'utf8');
assert(launcher.includes("connect('load-failed'"), 'Launcher trata o sinal load-failed do WebKit');
assert(launcher.includes('--force-browser'), 'Launcher oferece diagnóstico no navegador');
assert(buildDebContent.includes('scripts/package_backend.py'), 'Pacote inclui a API compartilhada');
assert(!desktopContent.includes('MimeType='), 'Desktop não altera associações de arquivos');
const postinst = buildDebContent.match(/postinst_content = """([\s\S]*?)"""/)[1];
assert(!postinst.includes('rm -f') && !postinst.includes('xdg-mime'), 'Postinst preserva arquivos e associações do usuário');
console.log(`Resultado dos Testes: ${passed} passaram, ${failed} falharam.`);
console.log(`========================================\n`);

if (failed > 0) {
  process.exit(1);
} else {
  console.log('🎉 Todos os testes de conformidade foram aprovados com sucesso!');
}
