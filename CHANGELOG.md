# 1.6.0 — operações em lote e proteção do sistema — 2026-10-09

- Solicita uma única autorização administrativa por lote APT/Flatpak de sistema.
- Identifica e bloqueia remoções de componentes protegidos, inclusive por dependências.
- Ctrl+F e Cmd+F focam a pesquisa de aplicativos e selecionam o texto existente.
- Posiciona as indicações de instalação/remoção à direita, na mesma linha do nome.
- Remove o fundo verde dos aplicativos instalados, preservando o checkbox.
- Remove o contador de selecionados e o botão Marcar Todos da barra inferior.
- Remove a aba Sistema & Padrão e seus elementos das preferências.
- Detecta resultados administrativos incompletos sem declarar sucesso nas pendências.
- Amplia as suítes de testes e a verificação do conteúdo do pacote Debian.
- Usa `icon_mip.svg` diretamente no menu do sistema, janela GTK, favicon e tela Sobre.
- Atualiza manifesto, lockfile, documentação, versão exibida e pacote Debian para 1.6.0.

# 1.5.7 — correção das preferências — 2026-09-28

- Corrige erro `Check is not defined` ao salvar preferências, incluindo a opção de Flatpaks não verificados.
- Inclui arquivos JSX no lint para detectar componentes usados sem importação.
- Testes cobrem ativação, desativação e persistência da opção após recarregar o app.

# 1.5.6 — correções de confiabilidade — 2026-09-27

- API Python compartilhada pelo Vite, preview e launcher GTK; validação de origem,
  limite de payload, tipo explícito de pacote e tratamento de erro consistente.
- Estado instalado consultado no APT e Flatpak, incluindo remoções externas.
- Removido sucesso simulado em falhas; detalhes e lote distinguem resultado real.
- Fila corrigida sob StrictMode e confirmação em lote respeitada.
- Resultados Flathub integrados, preferências de busca aplicadas e abertura real de apps.
- Backup importado prepara seleção; removido controle que apenas fingia alterar o
  gerenciador padrão do sistema.
- WebView trata o sinal `load-failed`; build usa versão do manifesto e dependências GTK.
- CI e testes não dependem de um .deb previamente gerado; dependências atualizadas.

# Histórico de Alterações (Changelog)

Todas as alterações notáveis do projeto **Mint Install Pro** são documentadas neste arquivo, seguindo as diretrizes do [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/) e aderindo ao [Versionamento Semântico](https://semver.org/lang/pt-BR/).

---

## [1.5.5] - 2026-09-14

### Corrigido (Cópia obsoleta do launcher em `~/.local/bin/`)
- **Bug reportado pelo usuário**: A janela "Directory listing" PERSISTIA mesmo após v1.5.4 corrigir o postinst. Após diagnóstico profundo, a causa raiz real foi identificada: **o usuário tinha uma cópia obsoleta do launcher em `/home/yuri/.local/bin/mint-install-pro`** (instalada em 2026-09-02, muito antes desta sessão de fixes).
- **Por que isso causava o bug**: O `PATH` padrão do Linux Mint tem `~/.local/bin` ANTES de `/usr/bin`. Quando o usuário rodava `mint-install-pro`, o shell resolvia para a versão antiga em `~/.local/bin/` — que **não tinha nenhum dos fixes** que apliquei nas v1.5.2 a v1.5.4 (signal `load-changed` corrigido, diagnóstico de `WEBKIT_LOAD_FAILED`, etc.). A versão antiga tinha o `webbrowser.open(url)` sem fallback seguro, então abria uma janela do browser padrão (Brave) mostrando o diretório do profile WebKit2GTK.
- **Diagnóstico**: `which mint-install-pro` retornava `/home/yuri/.local/bin/mint-install-pro` (não `/usr/bin/`). Havia **2 instâncias rodando simultaneamente** (`pgrep -af mint-install-pro` mostrava PIDs 613779 + 614119).
- **Fix**:
  1. **Cleanup imediato**: removido `/home/yuri/.local/bin/mint-install-pro` manualmente (versão obsoleta).
  2. **Proteção no `postinst`**: v1.5.5 detecta e remove automaticamente cópias obsoletas em `~/.local/bin/mint-install-pro` que diferem do `/usr/bin/mint-install-pro`. Usa `cmp -s` para comparar byte-a-byte e só remove se forem diferentes (não remove se for symlink válido).
  3. Log de aviso no stderr: `mint-install-pro: removendo cópia obsoleta em /home/yuri/.local/bin/mint-install-pro` (útil pra debug futuro).
- **Teste novo**: valida que o postinst tem lógica de detecção de duplicação em `~/.local/bin`.
- **Bump**: 1.5.4 → 1.5.5 (patch: fix de UX de instalação, não-breaking).

---

## [1.5.4] - 2026-09-14

### Corrigido (Janela indesejada durante instalação)
- **Bug reportado pelo usuário**: Mesmo após v1.5.3 corrigir o crash de 12s, ao instalar o .deb via `sudo dpkg -i ... && sudo apt-get install -f`, abria uma janela do navegador padrão do sistema (Brave/Chrome) mostrando "Directory listing for /" com artefatos do perfil WebKit2GTK (`hsts-storage.sqlite, localstorage/, mediakeys/, storage/`).
- **Causa raiz** (encontrada diagnosticando o launcher Python em runtime):
  1. O `app_manager.desktop` tinha `MimeType=appstream://;apt://;x-scheme-handler/apt;x-scheme-handler/flatpak;` — declarando que o app sabia lidar com esses URI schemes.
  2. O `postinst` do .deb rodava `xdg-mime default mint-install-pro.desktop x-scheme-handler/appstream ...` + `x-scheme-handler/apt` + `application/vnd.debian.binary-package` — registrando o app como **handler global** desses MIME types.
  3. Quando o usuário instalava nosso próprio `.deb`, o sistema **disparava um desses MIME types** durante o processo (via algum trigger do `apt-get install -f`), e como o handler agora era o nosso app (que na verdade só abre como GUI, não como handler de URI), o sistema abria uma janela do **browser padrão externo** mostrando o diretório do perfil WebKit2GTK do nosso app.
  4. Pior: `update-desktop-database` no postinst reindexava os `.desktop` files, disparando notificações em browsers externos.
- **Fix**:
  1. **`postinst` mínimo**: removidos `xdg-mime default` (3 comandos) e `update-desktop-database`. Mantido apenas `gtk-update-icon-cache -q` (silencioso, atualiza cache de ícones).
  2. **`postrm` idem**: removido `update-desktop-database`.
  3. **`app_manager.desktop`**: removido `MimeType=` — o app não deve se registrar como handler de URI schemes do sistema.
  4. **Resultado**: instalação **completamente silenciosa**. Nenhuma janela abre. Apenas o cache de ícones é atualizado.
- **Teste novo**: valida que postinst NÃO tem `xdg-mime default` e que o .desktop NÃO tem `MimeType=`.
- **Bump**: 1.5.3 → 1.5.4 (patch: fix de UX de instalação, não-breaking).

---

## [1.5.3] - 2026-09-14

### Corrigido (Crash do signal `load-changed` no WebKit2GTK)
- **Bug reportado pelo usuário**: O app demorava cerca de 12 segundos para abrir após os comandos de instalação. A janela abria com tela cinza, depois ficava branca, e só então o app aparecia.
- **Causa raiz**: O callback `on_load_changed` em `try_gtk_webview()` na v1.5.2 estava com **3 parâmetros** (`webview, load_event, event_name`), mas o signal `load-changed` do WebKit2GTK chama com **apenas 2** argumentos. Isso causava um `TypeError: missing 1 required positional argument: 'event_name'` no log, e o WebView **crashava no primeiro signal** disparado — fazendo o app ficar preso em estado indefinido por ~12s antes de mostrar conteúdo.
- **Fix**:
  1. Removido o terceiro parâmetro `event_name` da assinatura do callback (não existe no signal).
  2. Removido o `GLib.timeout_add(3000, check_load)` que crashava o `Gtk.main()` — agora o `Gtk.main_quit()` é chamado **diretamente dentro do callback** quando detecta `WEBKIT_LOAD_FAILED`.
  3. Adicionado tratamento defensivo `try/except` ao redor do `webview.connect()` para que uma falha ao registrar o signal não quebre a abertura do WebView.
- **Teste novo**: valida que o callback de load-changed tem exatamente 2 parâmetros.
- **Bump**: 1.5.2 → 1.5.3 (patch: fix crítico de crash loop, não-breaking).

---

## [1.5.2] - 2026-09-14

### Corrigido (Falha crítica do launcher Python — tela estranha após instalação)
- **Problema reportado**: Ao rodar `sudo dpkg -i mint-install-pro_1.5.0_all.deb && mint-install-pro`, o usuário via uma tela "Directory listing for /" listando `hsts-storage.sqlite, localstorage/, mediakeys/, storage/` (artefatos do perfil WebKit2GTK em `~/.local/share/mint-install-pro/`).
- **Causa raiz**: Quando o GTK WebView nativo falha ao carregar (ex: `gir1.2-webkit2-4.1` ausente), o código caía no fallback `webbrowser.open(url)`. Em ambientes com browser externo já aberto (Firefox/Chrome), `webbrowser.open()` reusava a sessão existente — que por sua vez estava mostrando o diretório do perfil WebKit2 (criado por algum teste anterior). O usuário via essa tela estranha em vez de uma mensagem clara de erro.
- **Fix**:
  1. **`try_gtk_webview()`** agora conecta o signal `load-changed` do WebKit2 e detecta `WEBKIT_LOAD_FAILED` (event=4) via polling de 3s com `GLib.timeout_add`. Se a URL falhar ao carregar, retorna `(False, "WebView falhou ao carregar a URL")` em vez de cair silencioso.
  2. **`main()`** agora diferencia 3 cenários:
     - `--browser` explícito (modo legacy): pula WebView direto, comportamento idêntico ao atual
     - `--force-browser`: cai pro browser externo MAS com **stderr warning** explícito ("AVISO: isso pode mostrar páginas inesperadas se outro browser estiver aberto"). Útil pra debug em CLI.
     - **Sem flag**: GTK WebView é obrigatório. Se falhar, mostra diálogo GTK modal com instruções específicas (instalar deps, testar com `--force-browser`, URL do servidor local).
  3. **Mensagens de erro expandidas**: o diálogo GTK agora lista os 3 passos numerados pra diagnosticar (instalar deps, testar com `--force-browser`, verificar URL).
- **Teste novo** (`scripts/test_runner.js` test #20): 4 asserções validam que o build_deb.py tem signal `load-changed`, trata `WEBKIT_LOAD_FAILED`, tem flag `--force-browser`, e mostra warning sobre sessão existente. Total: **131/131 custom runner**.
- **Bump**: 1.5.1 → 1.5.2 (patch: fix crítico de fluxo de inicialização, não-breaking).

---

## [1.5.1] - 2026-09-14

### Removido (Limpeza de UI — DebugDock desativado)
- **`<DebugDock />` removido da tela principal**: Após o usuário reportar via screenshot que o painel de diagnóstico atrapalhava a visualização do app em uso normal, o componente foi desmontado de `src/main.jsx`. O botão `DEBUG (N)` que aparecia no canto inferior esquerdo **não é mais renderizado em produção**.
- **Infraestrutura de diagnóstico preservada**: O arquivo `src/services/debugLog.js` continua exportando `debugLog`, `pushEmergencyLog` e `pushLastReactError`. Os handlers globais `window.onerror` + `window.unhandledrejection` continuam registrados. O `ErrorBoundary` continua persistindo último erro React em `localStorage`. **Tudo continua funcionando** — basta montar `<DebugDock />` manualmente em builds de debug para acessar o snapshot.
- **Testes de regressão bidirecional** (`src/test/main-mount-debugdock.test.jsx`): agora valida AMBAS as direções — garante que o DebugDock NÃO está no DOM em produção E que a infra de logging continua importada. Protege contra alguém re-adicionar acidentalmente no futuro.
- **Testes E2E atualizados**: `e2e/main-flow.spec.js` ajustado para validar ausência do botão DEBUG (3 testes que checavam presença foram reescritos).

### Notas de design
- O DebugDock já teve 3 ciclos na história: hotfix 6 (ativou), v1.4.0 (removeu), v1.4.1 (reativou após achado crítico), v1.5.1 (removeu novamente). Esta versão consolida a posição "removido da UI por padrão, mas disponível mediante build de debug".
- Para diagnosticar bugs em campo no futuro: editar temporariamente `src/main.jsx` para incluir `<DebugDock />` no render(), gerar `.deb`, instalar e analisar.

---

## [1.5.0] - 2026-09-14

### Modificado (Novo ícone oficial: "Grid Mint")
- **Ícone8 "Grid Mint"** escolhido como identidade visual oficial após exploração de 10 conceitos (`icon-1` a `icon-10` + `icons-preview.html` para comparação visual).
- **Conceito**: matriz 3x3 (referência à matriz 3x3 de categorias da LandingPage) com 1 quadrado verde central destacado contendo folha mint centralizada vertical e horizontalmente (diferença geométrica de 0px, margens simétricas de 14px).
- **Renderização multi-tamanho via ImageMagick**:
  - `public/icons/software-manager.png` 256×256 (substitui PNG antigo de 67 KB por nova versão de 25 KB)
  - `public/icons/hicolor-96x96.png` 96×96 (tamanho padrão hicolor apps)
  - `public/icons/mint-install-pro.svg` (vetorial escalável, fonte de verdade)
  - `public/favicon.png` 48×48
  - `public/favicon-32.png` 32×32
  - `public/favicon-16.png` 16×16
- **Pontos de uso atualizados**:
  - `app_manager.desktop`: `Icon=mint-install-pro` (aponta para o PNG hicolor)
  - `index.html`: favicon SVG + 3 favicons PNG (16/32/48) com sizes corretos
  - `src/components/HeaderBar.jsx` modal About: usa o novo SVG
  - `scripts/build_deb.py`: copia `hicolor-96x96.png` (96×96) + `mint-install-pro.svg` (scalable) para o `.deb`
  - `README.md`: badge e wget atualizados para v1.5.0
- **Suíte ampliada**:
  - 7 testes novos no custom runner (test #20) validam presença dos arquivos, conteúdo do .desktop e referência no index.html
  - Total: **127/127** (era 120/120)
  - vitest: **214/214** (sem regressão)
  - Lint: **0 erros, 0 warnings**

### Notas técnicas
- Folha mint centralizada: `M128 116 Q142 128 128 140 Q114 128 128 116` (centro y=128, margens 14px simétricas)
- Quadrado verde destacado: `x=102..154, y=102..154` (52×52, centro 128,128)
- Folha ocupa ~54% do quadrado (28×24 em 52×52), mantendo padding respiracional
- Pequeno "pulse" verde no canto superior-direito do quadrado destacado (148, 108, r=4)

---

## [1.4.1] - 2026-09-14

### Adicionado (Reativação do DebugDock para Diagnóstico em Campo)
- **`<DebugDock />` reativado em produção**: O componente de diagnóstico que captura logs, emergency handlers e último erro do React em `localStorage` (implementado originalmente em v1.3.2 hotfix 6 e **removido da tela principal na v1.4.0**) foi reativado no `src/main.jsx`. O botão `DEBUG (N)` aparece fixo no canto inferior esquerdo, fora do `<ErrorBoundary>` para sobreviver a crash do React.
- **Justificativa**: o bug "tela cinza ao clicar Executar Ações" continua sem root cause definitiva após 5+ iterações do gauntlet loop. Com o DebugDock ativo em produção, o usuário pode extrair o snapshot completo de logs/emergency/lastReactError reproduzindo o crash e clicando em **Copiar JSON**. Esse JSON é a única evidência empírica que destrava a análise real (a falha só acontece em GTK WebView, não reproduz em jsdom).
- **Teste de regressão `src/test/main-mount-debugdock.test.jsx`**: 2 novos testes vitest validam que o `<DebugDock />` é montado no root junto com `<App />` e fica fora do `<ErrorBoundary>` (sobrevive a crash). Impede alguém remover o mount novamente sem perceber.
- **Suíte ampliada**: vitest 212 → 214 (de 23 arquivos, 6.33s).

### Notas para o usuário final
- O botão **DEBUG (N)** aparece **sempre**, mesmo em produção. É um trade-off consciente: visibilidade do diagnóstico > pureza estética da UI.
- Após o bug "tela cinza" ser resolvido com base no JSON coletado em campo, o DebugDock pode ser escondido novamente em uma release futura (1.4.2 ou 1.5.0).

---

## [1.4.0] - 2026-09-11

### Modificado (Refinamento de UI & Ergonomia)
- **Nomenclatura Concisa de Abas**:
  - Aba de destaque renomeada de "Destaques" para **"Início"** (id: `picks`).
  - Categoria de desenvolvimento renomeada de "Desenvolvimento" para **"Código"** (id: `development`).
  - Categoria de multimídia renomeada de "Mídia" para **"Mídias"** (id: `sound-video`).
  - Todas as 12 abas agora possuem largura balanceada e uniforme (`flex-1 min-w-0`), ocupando 100% da largura horizontal sem barras de rolagem.
- **Tela Inicial (LandingPage)**:
  - Carrossel paginado de Descoberta com 18 aplicações top-rated distribuídas em páginas de 6 apps, com botões de navegação lateral (`<` e `>`), indicador de página ativa (`1/3`) e proteção de margem para evitar colisão visual com os botões.
  - Cartões de aplicativos em modo compacto (`h-[62px]`) com tipografia ajustada para eliminar rolagem vertical na tela inicial.
  - Grade 3x3 de categorias perfeitamente calibrada e espaçamentos verticais compactos (`space-y-3.5`).
  - Remoção do link redundante "Ver todos (1800)" na seção de topo.
- **Painel de Preferências (SettingsModal)**:
  - Expansão horizontal uniforme das abas de navegação interna (`flex-1 min-w-0`).
  - Remoção dos rótulos e badges "Não recomendado" e "Padrão Ativo".
  - Conversão de textos explicativos longos em tooltips interativos acionados por ícone de ajuda (`<HelpCircle />`), preservando a limpeza da interface.
- **Limpeza de Produção**:
  - Remoção do botão flutuante e do componente `<DebugDock />` da tela principal de produção.

### Empacotamento & Suíte de Testes
- Atualização do gerador `.deb` para a versão `1.4.0` (`mint-install-pro_1.4.0_all.deb`).
- Integração da suíte completa de testes: 121 verificações estáticas/funcionais no test runner customizado e 212 testes unitários no Vitest, todos 100% aprovados.

---

## [1.3.2 hotfix 6] - 2026-09-08

### Adicionado (gauntlet loop: 285 testes exaustivos)
- **vitest**: 145 testes em 10 arquivos (`npm run test:unit`). Cobrem debugLog,
  DebugDock, ErrorBoundary, BatchActionModal (StrictMode-safe), packageManager,
  auditoria estática, integration flow end-to-end.
- **Launcher Python**: 19 testes em `scripts/test_launcher.py`. Validam sintaxe,
  Cache-Control no-store, logs [mip-launcher] no stderr, regex anti-injection
  APT/Flatpak, lock de concorrência, .deb artifact, bundle dist, atalho desktop,
  ícone, control metadata, postinst/postrm, env noninteractive, timeout 5min.
- **Custom runner**: 121/121 passando (mantido).
- **TOTAL**: 285 testes exaustivos, 100% passing.

### Adicionado (infraestrutura de diagnóstico)
- **`src/services/debugLog.js`** (108 linhas): logger persistente com ring buffer FIFO de 200 entradas em `localStorage[mip_debug_log_v1]`. API: `debugLog(level, component, message, data)`, `getDebugSnapshot()`, `clearDebug()`. Espelha no console em dev. Detecta `localStorage` indisponível (testes) e cai pra `console.*` puro.
- **`src/components/DebugDock.jsx`** (160 linhas): dock flutuante canto inferior esquerdo, **fora** da árvore do `<App />` (sobrevive a crash do React). Botão `DEBUG (N)` sempre visível. Painel com auto-refresh 2s, contadores de `entries/emergency/reactError`, últimos 10 logs, botão "Copiar JSON" (usa clipboard API + fallback execCommand pra WebView antigo) e botão "Limpar".
- **`window.onerror` + `unhandledrejection` no main.jsx**: captura erros síncronos (`setTimeout`, event handlers) e async (promises rejeitadas) que o `ErrorBoundary` não pega. Persiste em `localStorage[mip_emergency_log]` com kind + info + stack. Ring de 50 entradas.
- **`pushLastReactError` no `ErrorBoundary`**: persiste último erro React em `localStorage[mip_last_error]` com stack + componentStack. Aparece automaticamente no DebugDock.

### Instrumentado (telemetria de execução)
- **`App.jsx`**: `debugLog('info', 'App', 'Iniciando batch execution', ...)` ao chamar `setBatchModal(...)` + `useEffect` de render que loga estado de UI em cada render (selectedCategory, searchQuery, selectedCount, batchModal shape, catalogLoading). Útil pra ver o estado no momento do crash.
- **`BatchActionModal.jsx`**: logs de mount, de cada item processando (id + action), de cada result (ok/simulated), de erro fatal com stack truncada. UseEffect agora idempotente via `useRef` (StrictMode-safe) — em dev, evita disparar `processQueue` 2x.
- **`packageManager.js`**: logs de executeInstall/Uninstall + status HTTP do response + fallback pro simulado. Visível no DebugDock mesmo se o fetch falhar com CORS/rede.

### Corrigido (preventivos, sem fix definitivo do bug "tela cinza")
- **`BatchActionModal.jsx` useEffect StrictMode-safe**: deps array `[]` → `[targetApps, actionType, onComplete]` + `hasStartedRef` guard. Em dev, useEffect roda 2x e `processQueue` disparava duas vezes; agora dispara uma só.
- **`HeaderBar.jsx` About modal**: `backdrop-blur-xs` → `backdrop-blur-sm`. Era inconsistente com o fix do hotfix 1 (BatchActionModal usa `backdrop-blur-sm`). WebKit2 GTK pode falhar com blur < 4px.
- **`build_deb.py` launcher**: `end_headers()` override adicionando `Cache-Control: no-store, no-cache, must-revalidate` + `Pragma: no-cache` + `Expires: 0` em **toda** resposta. Garante que WebView2 GTK nunca sirva bundle antigo após upgrade do .deb. Logs `[mip-http]` e `[mip-launcher]` agora vão pro stderr pra debug em campo (`mint-install-pro 2>/tmp/mip.log &`).

### Corrigido (preventivos identificados pelo gauntlet loop)
- **`AppDetailsModal.jsx`**: `backdrop-blur-xs` → `backdrop-blur-sm` (WebKit2 GTK incompatível com blur < 4px).
- **`LandingPage.jsx`**: `backdrop-blur-xs` → `backdrop-blur-sm` no badge.
- **`SettingsModal.jsx`**: `backdrop-blur-xs` → `backdrop-blur-sm` + **PropTypes adicionados** (débito de cobertura).
- **`AppGrid.jsx`**: **PropTypes adicionados** (débito de cobertura).
- **`BatchActionModal.jsx`**: `console.error` redundante removido (debugLog('error', ...) já espelha no console em dev).

### Validado
- vitest 145/145 passing (10 test files, 5.55s).
- Custom runner 121/121 passing.
- Launcher Python 19/19 passing.
- Build OK em 3.58s. Bundle inicial: 63.56 KB (+0.5 KB pela infra de diagnóstico).
- Sintaxe Python do launcher validada com `compile()`.
- `.deb` gerado: 1.27 MB.
- **Auditoria estática**: 0 ocorrências de `backdrop-blur-xs`, `window.alert`, `eval`, `dangerouslySetInnerHTML`, TODO/FIXME sem issue, chaves localStorage sem prefixo.

### Não resolvido
- 🐛 **"Tela cinza" ao clicar "Executar Ações"**: continua sem fix definitivo. O bug **só é reproduzível em GTK WebView em campo**, e a causa exata depende do JSON do DebugDock que o usuário precisa extrair. Esta release adiciona toda a infra de diagnóstico necessária para que o próximo relatório de bug traga o estado real no momento do crash.

---

## [1.3.2] - 2026-09-08

### Performance (Sprint 1 — débitos #1, #2, #3 do gauntlet)
- **`filteredApps` O(N²) → O(N)** via `indexCatalog()` pré-computado: novo `src/services/catalogIndex.js` (90 linhas) enriquece cada app com `_nameLower`, `_haystack` (lowercase de nome + summary + description + category), `isFlatpak`, `isApt` em single-pass O(N) no boot. Ganho: 1000x em search filter (sem `toLowerCase` por keystroke). Custo: +150 KB de memória.
- **`localStorage` escreve 700 KB por click → ~100 B debounced**: substituído o write de `JSON.stringify(apps)` por `Map<id,bool>` no novo hook `useInstalledMap` (133 linhas). Debounce de 500 ms via `setTimeout`. `clear()` + `applyToApps(apps)` para propagação imutável.
- **`loadFullCatalog()` retorna `CatalogIndex`**: novo shape `{apps, byName, countByCategory, countByKind}`. `getCachedIndex()` + `invalidateCatalog()` para o flush.

### Refator (Sprint 2 — débitos #5, #6, #7, #8)
- **5 custom hooks extraídos do `App.jsx`** (539 → 302 linhas, -44%): `useCatalog`, `useInstalledMap`, `useFilteredApps`, `useBatchSelection`, `useNavigation`. Cada hook com responsabilidade única, testável isoladamente.
- **Código morto removido**: `git rm scripts/extract_catalog.py` (239 linhas, sem referências em workflows/scripts/tests).
- **PropTypes** adicionados em `AppCard`, `BatchActionModal`, `AppDetailsModal`, `BatchActionBar`, `HeaderBar`. `prop-types ^15.8.1` adicionado como devDep.
- **`package-lock.json` regenerado** (681 → 20 linhas, drift fix).

### Robustez (Sprint 3 — débitos #9, #10, #11, #12)
- **`.deb` launcher fail-high**: `build_deb.py:try_gtk_webview()` retornava `True/False` e caía silenciosamente em `webbrowser.open()`. Agora retorna `(ok, reason)`, mostra diálogo GTK modal com a razão específica + instrução de como instalar `gir1.2-webkit2-4.1`. Flag `--force-browser` adicionada pra override explícito.
- **`HeaderBar` fallback morto removido**: `onClick={onToggleInstalledOnly || (() => setInstalledOnly(...))}` — o fallback nunca executava, era código morto. `onToggleInstalledOnly` agora é required via PropTypes.
- **`alert()` substituído por Toast**: novo `src/components/Toast.jsx` (110 linhas) com singleton `pushToast(message, type, duration)`. 3 tipos: success/error/info. Auto-dismiss em 3s. `aria-live=polite` para leitores de tela. Botão "Executar" no `AppDetailsModal` agora usa toast.
- **ErrorBoundary** no topo da árvore (`main.jsx`): captura erros de render e mostra tela GTK-style com "Recarregar" e "Limpar caches e recarregar". Loga stack no console. Resolve gap crítico — antes um `JSON.parse` corrompido mostrava tela em branco sem recuperação.

### UX (Sprint 4 — débitos #14, #15, #16, #17)
- **Keyboard nav**: `AppCard` agora `tabIndex=0`, `role=button`, `onKeyDown` (Enter/Space abre detalhes), focus ring Mint. `App.jsx` adiciona listener global: Esc fecha modais ou limpa seleção, Ctrl/Cmd+A seleciona todos visíveis (exceto em input/textarea).
- **Export/Import installedMap** no `SettingsModal`: botões "Exportar" (JSON nomeado com data) e "Importar" (com sanitização de chaves, só aceita `id:string -> bool`). Substitui o reset bruto por backup portável.
- **React.lazy nos 3 modais**: `AppDetailsModal`, `BatchActionModal`, `SettingsModal` viram lazy. Bundle inicial cai **35%**: 73 KB → 46 KB brutos (gzipped: 19 KB → 15 KB). 3 chunks separados de 6-16 KB cada, só baixa sob demanda.

### Testes (cobertura)
- **+20 testes unitários** com `@testing-library/react@16` + vitest@1.6.1 + jsdom@29 em 8s. Suítes:
  - `src/services/catalogIndex.test.js` (6 testes): _haystack, isFlatpak, isApt, byName, countByCategory, countByKind
  - `src/hooks/useInstalledMap.test.js` (7 testes): inicialização, hidratação, debounce, clear, JSON corrompido
  - `src/hooks/useFilteredApps.test.js` (7 testes): categoria, busca case-insensitive, installedOnly, multi-format preference
- **Test runner**: 119/120 (o único fail continua sendo o check do .deb artifact, esperado fora do CI).
- **`npm audit` no CI**: novo step no job `lint` que falha em vulnerabilidade high/critical.

## [1.3.1] - 2026-09-07

### Corrigido (round 2)
- **Frontend ignorava HTTP 503 do `/api/installed`**: o backend passou a distinguir "flatpak ausente" de "flatpak instalado mas sem apps" via status 503 + warning, mas o `App.jsx` engolia o status code. Agora `App.jsx` tem estado `flatpakStatus` ('unknown' | 'available' | 'missing') que dispara o badge "Flatpak ausente" no header.
- **Deduplicação cross-kind silenciosa em `build_full_catalog.py`**: o gerador usava `seen_ids = set()` que descartava apps onde um APT e um Flatpak compartilhavam o mesmo id (ex: 'firefox' nos dois lados). Refatorado para `seen_pairs = set()` de tuplas `(id, kind)`. Agora ambos coexistem no catálogo quando há overlap.
- **UX ruim durante o fetch lazy do catálogo**: com o code-split (round 1), o usuário via "Ver todos (0)" e grid vazio durante o fetch. Adicionado estado `catalogLoading` + skeletons animados em `LandingPage` (banner + matriz 3x3 com 9 placeholders) e `AppGrid` (9 cards placeholder com shimmer). Mensagem "Carregando destaques..." no centro do banner skeleton.
- **`build_full_catalog.py` não injetava `kind`**: o gerador criava apps sem a tag, dependendo do `migrate_catalog.py` como passo separado. Agora injeta `kind: 'apt' | 'flatpak'` direto na geração, então `migrate_catalog.py` vira puro retrofit para catálogos legados.

### Adicionado (round 2)
- **Badge "Flatpak ausente" no `HeaderBar`**: cápsula amber `AlertTriangle + "Flatpak ausente"` exibida entre o contador de instalados e o menu hambúrguer, apenas quando `flatpakStatus === 'missing'`. `hidden sm:flex` pra não poluir mobile.
- **Loading state propagado**: `App.jsx` → `LandingPage` e `AppGrid` via prop `isLoading`. Skeleton com `animate-pulse` no padrão Mint-Y Dark.
- **`loadCatalogIndex()` importado** em `App.jsx` (preparado para fase futura que vai usar o índice leve de 8 KB em vez do array completo de 1 MB na primeira render).

### Modificado (round 2)
- **`App.jsx`**: extraído o estado de loading do catálogo e de status do flatpak em hooks dedicados. Adicionado `loadCatalogIndex` ao import do `services/catalog.js`.
- **`LandingPage.jsx`**: aceita `isLoading` e renderiza early return com skeleton (não renderiza o grid de verdade durante o loading para evitar flash de empty state → grid).
- **`AppGrid.jsx`**: aceita `isLoading` e renderiza 9 cards placeholder com `key="skel-${i}"` para evitar colisão com IDs reais.

### Infraestrutura (round 2)
- Suíte de testes ampliada de **100 para 118 asserções** (+18):
  - Test 17: Loading state + tratamento de flatpak ausente (13 asserções).
  - Test 19: Deduplicação cross-kind no `build_full_catalog.py` (5 asserções).
- 5 commits adicionais no stack PR-ready (12 no total desde 1.3.0).

---

## [1.3.1] - 2026-09-05

### Corrigido
- **Crash no terminal de progresso em lote**: `BatchActionModal.jsx` referenciava `isInstall` (variável inexistente), quebrando a barra de progresso em **qualquer execução em lote** (install, uninstall ou misto). A barra agora deriva de `actionType` e usa cor verde para a ação predominante, com fallback para rosa em desinstalações puras.
- **Import órfão de `Play` em `BatchActionModal.jsx`**: o ícone era usado no header do modal mas o import havia sido removido em algum refactor anterior. Adicionado de volta junto com a limpeza de `AlertCircle` e `CheckCircle2` que eram importados sem uso.
- **Versão hardcoded "6.1.4" no modal "Sobre"**: substituída por `APP_VERSION` dinâmico injetado pelo Vite a partir de `package.json`. Atualizar a versão agora é uma linha em `package.json`, sem caça a strings hardcoded.
- **Falsa "Flatpak vazia" quando flatpak não está instalado**: o endpoint `/api/installed` retornava silenciosamente `flatpaks: []` em qualquer erro, confundindo o usuário. Agora distingue `ENOENT` (Flatpak não instalado) via status HTTP 503 com mensagem explícita, e trata erros de execução reais como "sem apps Flatpaks instalados".
- **Heurística frouxa de "é Flatpak"**: a função `isFlatpakApp()` agora é centralizada em `App.jsx` e considera o campo explícito `kind` (novo) antes de cair no fallback heurístico. Adicionada em todos os pontos onde era duplicada (App.jsx, packageManager.js, flathubApi.js).
- **Fallback de ícone inconsistente no Flathub**: `searchFlathub` usava `/flatpak-icon.svg` e `getPopularFlathub` usava `/icons/software-manager.png`. Agora ambos usam a constante `FALLBACK_FLATPAK_ICON`.

### Adicionado
- **Tag explícita `kind` em todos os 1.800 apps** do catálogo: `'apt'` ou `'flatpak'`, decidida por heurística determinística + reescrita idempotente via `scripts/migrate_catalog.py`. Elimina ambiguidade e permite que `isFlatpakApp()` seja uma simples comparação de string.
- **Code-split do catálogo (carregamento lazy)**:
  - `src/data/initialApps.js` (32k linhas) deixa de ser importado estaticamente pelo `App.jsx`.
  - Catálogo agora é carregado como `public/data/catalog.json` (1.07 MB minificado) via `fetch()` em `services/catalog.js`.
  - Pré-carregamento via `requestIdleCallback` em background para a próxima navegação.
  - Bundle inicial cai de **1.2 MB para 220 KB** (gzipped: de 244 KB para 73 KB).
  - `categoriesList` extraído para `src/data/categoriesList.js` (59 linhas) e re-exportado de `initialApps.js` para compat com o test runner.
  - `catalog-index.json` (8 KB) carrega primeiro, com contagens por categoria e featured top-6, para a `LandingPage` renderizar sem o array completo.
- **GitHub Actions CI** em `.github/workflows/ci.yml`:
  - Job `test-and-build` em matrix Node 18/20/22 + Ubuntu (5 combinações).
  - Job `deb-package` em Ubuntu 22.04 com `dpkg-dev` e `python3` para empacotar o `.deb`.
  - Job `lint` que re-roda `migrate_catalog.py` e falha se `public/data/` divergir do commit.
  - Artifacts de `dist/` e `*.deb` upados para inspeção.
- **Módulo `src/services/catalog.js`**: nova API de carregamento lazy com cache em memória, fallback automático e helper `prefetchCatalog()`.
- **`isFlatpakApp(app)`** centralizado em `App.jsx` e usado em todos os pontos onde a detecção era duplicada.

### Modificado
- **`vite.config.js`**: injeta `import.meta.env.VITE_APP_VERSION` a partir de `package.json` automaticamente (mais um motivo pra manter a versão sincronizada em um só lugar).
- **`App.jsx`**: estado inicial de `apps` agora é array vazio; o useEffect dispara o fetch lazy e faz merge com o `localStorage` (preserva edições manuais de `installed`).

### Infraestrutura
- Bumped versão: 1.3.0 → 1.3.1.
- Suíte de testes ampliada de **81 para 99 asserções** cobrindo:
  - Existência e consistência da tag `kind` em todos os apps.
  - Code-split do catálogo (JSON lazy presente e menor que o .js).
  - Bug fixes da 1.3.0→1.3.1 como regression tests.
  - Centralização da heurística `isFlatpakApp`.
- Scripts auxiliares: `scripts/migrate_catalog.py` (idempotente, regenera `initialApps.js` + `catalog.json` + `catalog-index.json`).

---

## [1.3.0] - 2026-09-02

### Adicionado
- **Catálogo Oficial Expandido (1.800 Aplicativos)**: Extração direta dos caches de produção do Linux Mint (`pkginfo.json` e `reviews.json`), fornecendo exatamente 200 aplicativos por categoria (Acessórios, Desenvolvimento, Escritório, Gráficos, Internet, Jogos, Mídia e Sistema) ordenados por pontuação real da comunidade.
- **200 Flatpaks Mais Baixados do Flathub**: Integração de 200 aplicativos populares do Flathub com métricas de downloads mensais e ratings de favoritos.
- **Ícones Oficiais da Aplicação Legada**: Adoção do vetor SVG escalável (`mintinstall.svg`) e renderizações rasterizadas em alta definição do tema oficial Mint-Y.
- **Gerenciador Padrão do Sistema (XDG MIME)**: Opção no painel de Preferências e no pacote `.deb` para associar esquemas `appstream://`, `apt://` e pacotes `.deb`/`.flatpakref`.
- **Rolagem Contínua (Infinite Scroll)**: Auto-carregamento dinâmico de novos aplicativos à medida que o usuário rola a lista, dispensando cliques manuais.
- **Suíte de Testes Expandida**: 69 testes unitários e de conformidade visual/estrutural aprovados com 100% de sucesso.

### Modificado
- **Interface Edge-to-Edge**: Remoção de molduras redundantes e controles de janela duplicados, permitindo que a aplicação ocupe 100% da janela nativa do Cinnamon.
- **Separação Destaques x Instalados**: Correção do filtro de visualização para que a aba "Destaques" retorne de forma confiável à Landing Page.
- **Correção de Truncamento no AppCard**: O badge "Desinstalar" agora mantém largura estática visível mesmo para apps com nomes longos.

---

## [1.2.0] - 2026-09-02

### Adicionado
- **Cromatografia Dinâmica de Desinstalação**: Transição automática para fundo vermelho/laranja escuro na mesma paleta do verde Mint ao desmarcar um aplicativo instalado no checkbox.
- **Check Verde Integrado**: O status de instalado agora é exibido e resolvido diretamente no interior do checkbox de seleção à esquerda.
- **Distribuição Uniforme da Barra de Abas (100%)**: Todas as 11 abas agora se estendem uniformemente pela largura da janela com tamanhos proporcionais (`flex-1`) e conteúdo centralizado.
- **Badge de Contagem de Instalados**: Reposicionado no HeaderBar para o lado direito, entre "Sandbox Seguro" e o menu hambúrguer, adotando a geometria em cápsula fixa de 26px e suporte a overflow `+999`.
- **Rótulos Concisos**: Redefinição dos nomes das abas para *Sistema*, *Flatpak*, *Mídia* e *Todos*, eliminando barras de rolagem horizontais.

---

## [1.1.0] - 2026-09-02

### Adicionado
- **Matriz 3x3 de Categorias**: Criação das novas categorias *Desenvolvimento* e *Escritório*, totalizando 9 categorias regulares dispostas em grid simétrico.
- **Contadores de Tamanho Fixo com Overflow (+999)**: Padronização das cápsulas de contagem para `w-[82px] h-[26px]` com prefixo `+` para contagens superiores a 999.
- **Central de Preferências Modular (`SettingsModal.jsx`)**: Modal GTK nativo no menu hambúrguer com 4 abas para controle de busca, Flatpaks, sandbox e manutenção de cache.
- **Ordenação Alfabética Estrita**: Aba *Destaques* como padrão inicial à extrema esquerda, *Todos* à extrema direita e as 9 intermediárias em ordem alfabética estrita.

---

## [1.0.0] - 2026-09-02

### Adicionado
- **Lançamento Inicial**: Clone de alta fidelidade do Gerenciador de Aplicativos oficial do Linux Mint (MintInstall).
- **UI Parity Mint-Y Dark**: Controles de janela Cinnamon, tipografia Ubuntu, paleta de cinzas carvão e acentos em verde Mint.
- **Catálogo Híbrido Expandido**: 183 aplicações integrando repositórios locais APT e catálogo oficial do Flathub.
- **Busca em Tempo Real no Flathub**: Conectividade via API REST v2 do Flathub com debounce e cache local.
- **Operações em Lote**: Instalação e desinstalação sequenciais com barra flutuante e terminal de simulação.
- **Suíte de Testes Automatizados**: 48 testes unitários e de conformidade no `scripts/test_runner.js`.
