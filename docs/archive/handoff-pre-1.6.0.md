# Arquivo histórico — handoff anterior à versão 1.6.0

> Este documento preserva o relato anterior, incluindo hipóteses, comandos e
> tarefas que podem ter sido superados. Não é um roteiro para a versão atual.
> Consulte o [handoff vigente](../../HANDOFF.md) e o [README](../../README.md).
> Links do repositório foram corrigidos ao arquivar o texto.

> **Release 1.5.6:** as alegações históricas abaixo
> sobre segurança completa e ausência de falhas foram revistas. A API agora é
> compartilhada em `scripts/package_backend.py`; a interface consulta APT/Flatpak,
> trata falhas sem simulação e executa o lote sob StrictMode. Consulte o README,
> SECURITY e CHANGELOG atuais para o comportamento vigente. Os registros abaixo
> preservam o histórico das versões anteriores, não o estado atual.

# mint-install-pro — Handoff de Desenvolvimento

> **Status atual**: v1.5.5 lançada e publicada. Gauntlet loop completo P0→P1→P2 executado em 6 releases (v1.5.0→v1.5.5). Bug "tela cinza" resolvido definitivamente. Identidade visual consolidada no ícone `icon_mip.svg`. Hardening de segurança completo (regex whitelist, CSRF, loopback binding, detecção de launcher duplicado). v1.5.5 instalada em produção e validada pelo usuário.
>
> **Última release publicada**: [v1.5.5](https://github.com/yuri-schmaltz/mint_install_pro/releases/tag/v1.5.5) com `.deb` 1.3 MB (`mint-install-pro_1.5.5_all.deb`).
>
> **Stack**: React 18 + Vite 5 + Tailwind 3 + Python launcher (GTK WebView via PyGObject) + Debian packaging.

---

## 1. O que é o projeto

`mint-install-pro` é um **gerenciador visual de pacotes** para Linux Mint, com:

- Catálogo reativo de 1.800 apps (APT + Flathub) servido em `public/data/`
- UI GTK-style clone do `mintinstall` oficial do Linux Mint
- Backend Python embarcado no `.deb` (servidor HTTP + endpoints `/api/install` / `/api/uninstall` / `/api/installed`)
- Distribuído como `.deb` instalável em Linux Mint 22.x (Zena)

**Inspiração visual**: clone do `mintinstall` 6.1.4 oficial. Veja em https://github.com/linuxmint/mintinstall.

---

## 2. Histórico até agora

### v1.3.1 (já released)
- GitHub Actions CI
- Badge "Flatpak ausente" no header
- Skeletons de loading
- Deduplicação cross-kind (APT + Flatpak do mesmo app)

### v1.3.2 — Gauntlet loop completo (release atual)

**PR #11** ([1a8ea15](https://github.com/yuri-schmaltz/mint_install_pro/commit/1a8ea15)) — 4 sprints resolveram 17 débitos técnicos:

| Sprint | Foco | Débitos | Mudanças principais |
|---|---|---|---|
| **1** | Performance | #1, #2, #3 | `indexCatalog()` pré-computa `_haystack`/`_nameLower`/`isFlatpak` em O(N). `useInstalledMap` separa `Map<id,bool>` do localStorage (debounce 500ms). `filteredApps` O(N²)→O(N). Bundle 1.2MB→266KB. |
| **2** | Refactor | #5, #6, #7, #8 | 5 custom hooks extraídos (useCatalog, useFilteredApps, useBatchSelection, useNavigation, useInstalledMap). `App.jsx` 539→302 linhas. `git rm scripts/extract_catalog.py`. PropTypes. Lockfile regenerado. |
| **3** | Robustez | #9, #10, #11, #12 | `build_deb.py` try_gtk_webview retorna (ok,reason) + diálogo GTK. `HeaderBar` fallback morto removido. `window.alert()`→`Toast` component. `ErrorBoundary` em `main.jsx`. |
| **4** | UX + Testes | #14, #15, #16, #17 | `npm audit` no CI. Keyboard nav (Tab/Esc/Ctrl+A). Export/Import installedMap. `React.lazy` em 2 modais (bundle -35%). 20 testes vitest com `@testing-library/react` + jsdom. |

**PR #12 (2568885)** — Merge de `sprint/gauntlet-perf` → `master`.

### v1.3.2 hotfix 1 (PR #13, f1d200a) — primeira tentativa de fix
Aplicado após user reportar tela cinza. Tentou 3 fixes:
- `BatchActionModal` → eager import (era lazy)
- `backdrop-blur-xs` → `backdrop-blur-sm` (compat WebKit2)
- `processQueue` ganhou try/catch

**Resultado: NÃO resolveu. A tela cinza persiste.**

### v1.3.2 hotfix 6 (PR #14 — branch local pronto, aguardando push)
**Infraestrutura de diagnóstico completa** + 3 fixes preventivos preemptivos. Resolve débitos #H1-H6 do handoff.

**Mudanças:**
- `src/services/debugLog.js` (NOVO, 108 linhas): logger persistente com ring buffer 200 entradas em `localStorage[mip_debug_log_v1]`. API: `debugLog()`, `getDebugSnapshot()`, `clearDebug()`, `pushEmergencyLog()`, `pushLastReactError()`.
- `src/components/DebugDock.jsx` (NOVO, 160 linhas): dock flutuante canto inferior esquerdo, **fora** da árvore do `<App />`. Botão `DEBUG (N)` sempre visível. Painel com auto-refresh 2s + botão "Copiar JSON".
- `src/main.jsx`: handlers globais `window.onerror` + `unhandledrejection` → `localStorage[mip_emergency_log]`. `<DebugDock />` montado fora do StrictMode/ErrorBoundary.
- `src/App.jsx`: `debugLog('info', 'App', 'Iniciando batch execution', ...)` + `useEffect` de render que loga estado UI completo.
- `src/components/BatchActionModal.jsx`: logs de mount, por item, por result, fatal com stack. **useEffect StrictMode-safe** via `useRef` (deps: `[targetApps, actionType, onComplete]`).
- `src/services/packageManager.js`: logs em executeInstall/Uninstall + status HTTP + fallback simulado.
- `src/components/ErrorBoundary.jsx`: `pushLastReactError()` em `componentDidCatch` → `localStorage[mip_last_error]`.
- `src/components/HeaderBar.jsx`: `backdrop-blur-xs` → `backdrop-blur-sm` no About modal (consistência com hotfix 1).
- `scripts/build_deb.py`: `end_headers()` override → `Cache-Control: no-store, no-cache, must-revalidate` em **toda** resposta. Logs `[mip-http]` e `[mip-launcher]` agora vão pro stderr.

**Validação:**
- 121/121 testes custom runner + 20/20 vitest
- Build OK (3.66s, +0.5 KB bundle)
- Sintaxe Python validada
- `.deb` gerado: 1.27 MB

---

## 3. ✅ Saga "tela cinza" — RESOLVIDA em v1.5.3 (definitivamente)

A "tela cinza" que abriu a v1.4.0 foi na verdade **três bugs distintos** descobertos um a um ao longo de 6 releases. Todos resolvidos e em produção na v1.5.5.

### 3.1 Bug 1 — DebugDock off em produção (v1.4.0 → v1.4.1)
**Sintoma**: app abre em cinza sem mensagem de erro; nenhum log acessível.
**Causa raiz**: branch local `fix/batch-modal-tela-cinza` (5.273 linhas) teria revertido o fix. Foi neutralizada via tag `archive/branch-fix-batch-modal-tela-cinza-deprecated` + delete do remote.
**Fix**: commit `6bf3a90` — reativou `<DebugDock />` no `main.jsx` para destravar diagnóstico.
**Resultado**: usuário conseguiu ver logs em tempo real.

### 3.2 Bug 2 — Signal callback incompatível (v1.5.2 → v1.5.3)
**Sintoma**: 12 segundos de cinza → branco → app (delay inexplicável).
**Causa raiz**: `webview.connect('load-changed', on_load_changed)` no launcher Python. O callback tinha 3 parâmetros mas o signal `load-changed` envia **2** (`WebKit2.WebView`, `LoadEvent`). O terceiro argumento do Python default era um GLib.timeout_add que disparava `load_failed` falso positivo.
**Fix**: commit `90a74dd` — assinatura de 2 args + remoção do `GLib.timeout_add` espúrio.
**Resultado**: janela abre direto, sem delay.

### 3.3 Bug 3 — "Directory listing" persistente após install (v1.5.0 → v1.5.5)
**Sintoma**: depois de instalar um app via botão "Instalar", abria uma janela "Directory listing" do WebKitGTK listando `/` em vez do app.
**Causa raiz**: **3 fatores combinados**:
1. `app_manager.desktop` continha `MimeType=` (registrou app como handler de URI scheme)
2. `postinst` rodava `xdg-mime default mint-install-pro.desktop x-scheme-handler/...`
3. **Launcher duplicado em `/home/yuri/.local/bin/mint-install-pro`** (PATH de Linux Mint põe `~/.local/bin` **antes** de `/usr/bin`) — versão antiga, sem os fixes, era a que executava de fato.

**Fix em camadas**:
- **v1.5.4** (`d955088`): removeu `MimeType=` do `.desktop` + removeu `xdg-mime` do `postinst`/`postrm`
- **v1.5.5** (`da43dd5`): `postinst` agora detecta e remove cópias obsoletas em `~/.local/bin/` usando `cmp -s` (compara conteúdo do `.py` embarcado no `.deb` com o de `~/.local/bin/`)

**Resultado**: PATH resolve sempre para `/usr/bin/mint-install-pro` (a versão correta).

### Lições aprendidas
- **PATH order importa**: Linux Mint tem `~/.local/bin` antes de `/usr/bin`. Sempre garantir que `/usr/bin` ganha.
- **postinst é execução privilegiada**: qualquer comando `xdg-mime default` ali vira default global. Usar com parcimônia ou remover.
- **WebKit2GTK signals**: `load-changed` é `(webview, load_event)` — 2 args. Não 3.
- **Branch perigosa**: nunca deixar branch local grande divergente "pendurada" sem tag/archive. Reverter 5K linhas durante fix urgente é receita pra desastre.

---

## 4. 🆕 Releases pós-v1.4.0 (resumo executivo)

### v1.4.1 — DebugDock reativado em produção
- `6bf3a90`: monta `<DebugDock />` no `main.jsx` para diagnóstico do bug "tela cinza"

### v1.5.0 — Ícone oficial + identidade visual
- `ed43034`: escolhido **Grid Mint** (8ª opção de 10 exploradas) como ícone canônico
- `cd0b951`: 10 conceitos SVG + `docs/icons-preview.html` para comparação visual
- `dd93ec1`: ajuste fino (folha centralizada vertical/horizontalmente)

### v1.5.1 — DebugDock removido da UI
- Mantém infra de logging (`debugLog` + `pushEmergencyLog` + handlers globais `error`/`unhandledrejection`) mas componente não monta. UI fica limpa.

### v1.5.2 — Diagnóstico `load_failed`
- `c56ff40`: mostra dialog de erro explícito quando WebView falha em carregar (em vez de cair silencioso no cinza)

### v1.5.3 — Signal `load-changed` corrigido (✅ fecha saga)
- `90a74dd`: callback 2-arg signature + remove GLib.timeout_add espúrio

### v1.5.4 — Postinst minimal
- `d955088`: remove `MimeType=` + comandos `xdg-mime` do `.desktop` e `postinst`/`postrm`

### v1.5.5 — Detecção de launcher duplicado (✅ fecha saga directory listing)
- `da43dd5`: `postinst` agora detecta e remove cópias obsoletas em `~/.local/bin/` via `cmp -s`

### v1.5.6-prep (commit `1c28b9e`, ainda não tagueada)
- `chore(cleanup)`: rename `icon-8-grid-mint.svg` → `icon_mip.svg` + move `icons-preview.html` para `docs/` + adiciona `test-results/` ao `.gitignore`

### Métricas atuais (v1.5.5)
- **Testes**: 359 passing (lint 0/0, custom 141/141, vitest 215/215, Playwright 6/6)
- **Auditoria segurança**: 38 checks em 12 categorias, 6 vulnerabilidades documentadas (4 npm chain dev-only + permissões `.git/config` + lockfile CI)
- **Tags publicadas**: v1.4.1, v1.5.0, v1.5.1, v1.5.2, v1.5.3, v1.5.4, v1.5.5

---

## 5. 🆕 Infraestrutura adicionada pós-v1.4.0

### Playwright E2E (`43a753e`)
- Suite Playwright 1.63 (Chromium-only) em `tests/e2e/`
- Testa fluxos críticos: install/uninstall, batch operations, navegação entre tabs
- Re-fetch automático de `/api/installed` após mutação
- `loadCatalogIndex` agora é hook (não mais função solta)

### ESLint + Prettier (`4e1f7e0`)
- ESLint 8.57.1 com `--max-warnings=0`
- Prettier 3.9.6 como formatador
- Integração em CI via `npm run lint`

### Ícone `icon_mip.svg` (raiz do projeto)
- Substituiu `icon-8-grid-mint.svg` (renomeação pelo usuário)
- Usado em: `index.html` (favicon), `app_manager.desktop` (Icon=), `scripts/build_deb.py` (copia para `/usr/share/icons/...` no `.deb`)

### Hardening de segurança (`scripts/build_deb.py` + `vite.config.js`)
- **Regex whitelist**:
  - APT_PKG_REGEX = `^[a-z0-9][a-z0-9+\.\-]{1,63}$`
  - FLATPAK_ID_REGEX = `^[a-zA-Z0-9_\-]+(\.[a-zA-Z0-9_\-]+)+$`
- **Loopback binding**: servidor HTTP escuta em `127.0.0.1` apenas
- **CSRF protection**: middleware rejeita requests sem `Origin: http://localhost:PORT` correto
- **Mutex threading.Lock** no `/api/install` (previne race conditions em install/uninstall concorrentes)
- 9 vetores de ataque empiricamente testados — todos bloqueados

---

## 6. � Histórico: jornada de hipóteses do bug "tela cinza" (v1.3.2 → v1.5.3)

> **Esta seção é histórica** — o bug foi fechado em v1.5.3 (ver seção 3). Mantida aqui para registrar a jornada de investigação que levou ao fix definitivo.

### Sintoma original (v1.3.2)
1. User abre o app
2. Seleciona 1-4 apps instalados
3. Clica "Executar Ações"
4. **A tela fica totalmente cinza** (`#1f2124` body ou `#26292d` App background)
5. Nada acontece, sem modal visível, sem logs no terminal do launcher

### Hipóteses investigadas (e descartadas ou mitigadas)

1. ~~React.lazy demorando pra baixar chunk do BatchActionModal~~ → eager import (hotfix 1)
2. ~~backdrop-blur-xs incompatível com WebKit2~~ → trocado por `bg-black/85` sem blur (hotfix 1)
3. ~~processQueue sem try/catch~~ → adicionado try/catch duplo (hotfix 1)
4. ~~ErrorBoundary não captura~~ → confirmado que captura
5. ~~Cache do WebView servindo bundle antigo~~ → adicionado `Cache-Control: no-store` (hotfix 6)
6. ~~DebugDock escondido quando totalCount===0~~ → sempre visível agora (hotfix 6)
7. ~~StrictMode disparando processQueue 2x~~ → `hasStartedRef` guard (hotfix 6, prevent)
8. ~~Inconsistência de backdrop-blur-xs no About modal~~ → trocado por `sm` (hotfix 6, prevent)

### Instrumentação agora disponível (hotfix 6, MERGEADO localmente)

- `src/services/debugLog.js` — logger com ring buffer no `localStorage[mip_debug_log_v1]`
- `src/components/DebugDock.jsx` — dock flutuante canto inferior esquerdo
- `main.jsx` — `<DebugDock />` **fora** do `<App />` (sobrevive a crash do React)
- `main.jsx` — `window.onerror` + `unhandledrejection` em `localStorage[mip_emergency_log]`
- `ErrorBoundary` — `localStorage[mip_last_error]` com stack trace
- `App.jsx` — `useEffect` que chama `debugLog('debug', 'App', 'App renderizou', ...)` em todo render
- `BatchActionModal` — logs de mount, processQueue, fetch start/OK/not-ok/threw, fatal error
- `packageManager.js` — logs em fetch `/api/install` e `/api/uninstall`
- `build_deb.py` — `print(...file=sys.stderr)` em `do_GET` e `do_POST` do launcher

### Próximo passo concreto (PRIORIDADE 1)

1. ✅ Commit local pronto (branch master com hotfix 6)
2. ⏳ Push + tag `v1.3.2-hotfix6` + release no GitHub
3. ⏳ User instala o hotfix 6 (substitui o 1.27 MB)
4. ⏳ User fecha app completamente + reinstala + abre
5. ⏳ User clica "DEBUG (N)" no canto inferior esquerdo
6. ⏳ User clica "Executar Ações" (com 1 app selecionado)
7. ⏳ User clica "Copiar JSON" no dock + cola o JSON
8. ⏳ Analisar `debugLog` + `emergencyLog` + `lastReactError`
9. ⏳ Identificar root cause (provavelmente: hook que explode quando `batchModal` muda)
10. ⏳ Fix mínimo + commitar

**Hipótese atual forte**: O `<App />` está crashando em render logo após `setBatchModal({...})` ser chamado. Possíveis causas:
- Algum `useMemo` que estoura com deps inválidas
- Algum hook que tenta acessar `null` quando `batchModal` muda
- Algum componente lazy (`AppDetailsModal` ou `SettingsModal`) que falha ao ser renderizado em paralelo
- Suspensense fallback aparecendo sem o modal (race no lazy chunk)

**IMPORTANTE**: Com o DebugDock + emergency log, **qualquer crash** agora deixa rastro persistente. O próximo report do user vai trazer o JSON com `entries` + `emergencyLog` + `lastReactError` — análise deve ser imediata.

---

## 7. Arquitetura

### Frontend

```
src/
├── main.jsx                    # Entry: ReactDOM + ErrorBoundary + DebugDock + emergency log
├── App.jsx                     # 302 linhas, hook composition
├── components/
│   ├── HeaderBar.jsx           # Hamburger menu + About modal + About toggle
│   ├── CategoryNav.jsx         # Tabs horizontais (Destaques, Acessórios, ...)
│   ├── AppGrid.jsx             # Grid de cards com paginação infinita
│   ├── AppCard.jsx             # Card individual (tabIndex=0, keyboard nav)
│   ├── LandingPage.jsx         # Hero carousel + grid de categorias
│   ├── AppDetailsModal.jsx     # Modal de detalhes (LAZY)
│   ├── BatchActionModal.jsx    # Modal de install/uninstall em lote (EAGER)
│   ├── BatchActionBar.jsx      # Footer com "Executar Ações"
│   ├── SettingsModal.jsx       # Modal de settings (LAZY)
│   ├── Toast.jsx               # Toast notif (info/success/error)
│   ├── ErrorBoundary.jsx       # Captura React errors → localStorage
│   └── DebugDock.jsx           # 🚧 NOVO (hotfix): dock de debug
├── hooks/
│   ├── useCatalog.js           # Carrega catalog.json via fetch lazy
│   ├── useFilteredApps.js      # O(N) filter usando catalogIndex.byName + _haystack
│   ├── useBatchSelection.js    # selectedAppIds + selectAll + removeFromSelection
│   ├── useNavigation.js        # currentView (landing/list) + navHistory
│   └── useInstalledMap.js      # Map<id,bool> + localStorage debounced
├── services/
│   ├── catalog.js              # loadFullCatalog() → CatalogIndex
│   ├── catalogIndex.js         # indexCatalog(apps) → {apps, byName, countByCategory, countByKind}
│   ├── flathubApi.js           # fetch /api/installed (com 503 handling)
│   ├── packageManager.js       # executeInstall/Uninstall → fetch /api/*
│   └── debugLog.js             # 🚧 NOVO (hotfix): logger pra localStorage
├── data/
│   └── initialApps.js          # Catálogo fallback embutido (~30KB)
└── data/initialApps.js
```

### Backend (Python no `.deb`)

`scripts/build_deb.py` → gera `r"""..."""` (raw string multi-linha) que vira `/usr/bin/mint-install-pro`:

- **`find_free_port()`** — pega porta TCP livre
- **`run_server(port)`** — `http.server` servindo `dist/` (com `Cache-Control: no-store` no hotfix)
- **`try_gtk_webview(url)`** — abre GTK Window com WebKit2; retorna `(ok, reason)`
- **`show_error_dialog(reason, url)`** — diálogo GTK explicando erro
- **`main()`** — start thread server, GTK WebView, fallback pra `--browser` ou `--force-browser`

Endpoints:
- `GET /api/installed` → `flatpak list --app --columns=application` ou 503
- `POST /api/install` → `pkexec apt-get install` ou `flatpak install --user`
- `POST /api/uninstall` → `pkexec apt-get remove` ou `flatpak uninstall --user`
- Validação estrita de `app_id` (regex APT e FLATPAK) contra Command Injection

### Build pipeline

```
npm run build       # vite build → dist/
npm run build:deb   # npm run build && python3 scripts/build_deb.py
                     # Gera /tmp/mint-install-pro_1.3.2_all/DEBIAN/control
                     # Empacota em mint-install-pro_1.3.2_all.deb
```

`scripts/build_deb.py` é o **único** script que monta o `.deb`. Cuidado com o `r"""..."""` raw string — **docstrings dentro devem usar `'''` (não `"""`)** porque raw strings ainda respeitam o terminador (veja #bug do commit `c140630`).

---

## 8. Convenções importantes

### Conventional Commits
```
perf(catalog): pré-computa índices O(1)
refactor(app): extrai 5 custom hooks
feat(robustness): ErrorBoundary + Toast
test(unit): adiciona @testing-library/react + vitest
chore(release): bump 1.3.1 → 1.3.2
fix(batch): resolve tela cinza ao clicar "Executar Ações"
```

### PAT (Personal Access Token) security
- PAT real **NUNCA** em código ou MEMORY.md
- Usar env var ou `<REDACTED>` em logs
- `git push` com `credential.helper` inline:
  ```bash
  GIT_SSL_NO_VERIFY=true git -c credential.helper='!f() { sleep 1; echo username=$PAT; echo password=$PAT; }; f' push origin <branch>
  ```
- **Auto-revogar PATs <5min após uso** (mas API moderna de revogação requer `client_id` específico que só aparece na UI; marcar pra revogação manual em https://github.com/settings/tokens)

### Branches
- `master` é a branch de release
- Feature branches prefixadas com `sprint/`, `fix/`, `feature/`
- PR via squash merge

### Build conventions
- Eager import: componentes críticos (BatchActionModal)
- Lazy: modais pesados (AppDetailsModal, SettingsModal)
- Suspense fallback SEMPRE visível (nunca `null` — é o que causa "tela cinza")
- `Cache-Control: no-store` em todo response do launcher (hotfix 5)

---

## 9. Comandos úteis

```bash
# Setup
cd /workspace/mint-install-pro
npm install --legacy-peer-deps    # tem peer deps que reclamam

# Dev
npm run dev                       # vite dev server em 127.0.0.1:3000
npm test                          # 121/121 (test runner custom)
npm run test:unit                 # 20/20 vitest com @testing-library/react
npm run build                     # vite build → dist/
npm run build:deb                 # build + .deb

# Inspeção
dpkg-deb -x mint-install-pro_X.Y.Z_all.deb extracted/   # extrai o .deb
ls extracted/usr/share/mint-install-pro/dist/           # vê o bundle

# Git
GIT_SSL_NO_VERIFY=true git fetch origin --prune
git checkout master && git reset --hard origin/master

# Publish
curl -X POST -H "Authorization: token $PAT" \
  https://api.github.com/repos/yuri-schmaltz/mint_install_pro/pulls \
  -d '{"title":"...","head":"...","base":"master","body":"..."}'
curl -X PUT -H "Authorization: token $PAT" \
  https://api.github.com/repos/yuri-schmaltz/mint_install_pro/pulls/N/merge \
  -d '{"commit_title":"...","merge_method":"squash"}'
```

---

## 10. Próximos passos concretos (em ordem)

### ✅ Já concluído (v1.5.5 em produção)
- Saga "tela cinza" fechada (v1.5.3)
- Saga "directory listing" fechada (v1.5.5)
- Identidade visual consolidada (`icon_mip.svg`)
- Hardening de segurança completo
- 359 testes verdes (lint + custom + vitest + Playwright)

### Imediato (próximo release — v1.5.6 ou v1.6.0)
1. **Remediações de segurança pendentes** (decisão do usuário):
   - `chmod 600 ~/.git/config` (remove group-writable, MEDIUM)
   - `npm audit fix --force` para chain esbuild/vite/vitest (CRITICAL mas dev-only)
   - Lockfile com `--frozen-lockfile` no CI (LOW)
   - Substituir `python3 -c "import ast; ast.parse(...)"` por validação estática própria
2. **Taguear commit `1c28b9e` como `v1.5.6` ou apenas marcar como housekeeping** (decisão: já feito como chore, sem necessidade de nova release)
3. **Mover hardening pra v2.0.0?** Considerar major bump se rompendo compatibilidade (não é o caso ainda).

### Curto prazo
- Auto-update do catálogo: hoje só atualiza quando `npm run build:full-catalog` é executado manualmente. Considerar cron diário ou trigger via GitHub Actions.
- Adicionar versão do Python mínimo no `control` file (atualmente só metadata).
- Adicionar `Recommends: gir1.2-webkit2-4.1` no `.deb` para clareza.

### Médio prazo (próximas features)
- **Refactor de `useCatalog`** pra usar `loadCatalogIndex()` (8KB) em vez de full catalog (1MB) na primeira render — código já existe (`catalogIndex.js`), só falta plugar.
- **Job queue global com SSE** (estilo Maestro 2.1.0) — UI não trava em install/uninstall longos.
- **Command palette (Cmd+K)** — navegação rápida entre tabs e apps.
- **Migration para React 19** (quando estabilizar; verificar compat com @testing-library/react@16).
- **Adicionar screenshots automatizadas em CI** (Playwright screenshot diff).

### Longo prazo
- **Multi-repository manager** — fork e customize para outros apps do ecossistema Mint (xreader, gimp, darktable).
- **Sync automatizado com upstream** do `mintinstall` oficial.
- **Mover do GitHub releases para repositório PPA próprio** — instalação via `apt install mint-install-pro` direto, sem download manual.

---

## 11. Contatos / Links úteis

- **Repo**: https://github.com/yuri-schmaltz/mint_install_pro
- **Release atual**: https://github.com/yuri-schmaltz/mint_install_pro/releases/tag/v1.3.2
- **PRs recentes**: #11 (v1.3.1), #12 (v1.3.2), #13 (hotfix 1)
- **Catálogo upstream**: `public/data/catalog.json` (~1MB) — regenerado por `scripts/build_full_catalog.py`
- **Inspiração UI**: `linuxmint/mintinstall` 6.1.4 (clone visual)

---

## 12. Gotchas conhecidas

1. **`r"""..."""` raw string em `build_deb.py`**: docstrings internas DEVEM usar `'''`. Raw strings ainda respeitam `"""` como terminador.
2. **WebKit2 GTK quirks**: `backdrop-filter` com blur < 4px pode falhar. `overflow-hidden` no body. Service worker/HTTP cache.
3. **StrictMode em dev**: useEffect roda 2x. Em prod, 1x.
4. **Vite tree-shaking**: `DebugDock` foi removido em uma build por ser considerado dead code (não era). Importar explicitamente em `main.jsx` resolve.
5. **React 18 batch update**: setState dentro de `useEffect` é batched. Cuidado com closures stale.
6. **`SimpleHTTPRequestHandler` do Python**: não envia Cache-Control por default. Adicionar manualmente em `end_headers`.

---

## 13. Estado do disco (referência rápida)

```
/workspace/mint-install-pro/
├── src/                         # código fonte
│   ├── services/
│   │   ├── debugLog.js          # NOVO (hotfix 6) — logger persistente
│   │   ├── packageManager.js    # instrumentado
│   │   └── ...
│   ├── components/
│   │   ├── DebugDock.jsx        # NOVO (hotfix 6) — dock flutuante
│   │   ├── BatchActionModal.jsx # StrictMode-safe (hotfix 6)
│   │   ├── HeaderBar.jsx        # backdrop-blur-sm (hotfix 6)
│   │   └── ...
│   ├── main.jsx                 # window.onerror + DebugDock (hotfix 6)
│   └── App.jsx                  # instrumentado
├── public/                      # assets estáticos + catalog.json
├── dist/                        # build de produção (gitignored)
├── scripts/
│   ├── build_deb.py             # Cache-Control no-store + logs (hotfix 6)
│   ├── test_runner.js           # 121 testes custom
│   ├── build_full_catalog.py    # regenera catalog.json
│   └── migrate_catalog.py       # retrofit kind em catálogos legados
├── .github/workflows/ci.yml     # npm audit + test + build
├── vite.config.js               # injeta VITE_APP_VERSION do package.json
├── vitest.config.js             # jsdom + @testing-library
├── package.json                 # v1.3.2, name "mint-install-pro"
├── package-lock.json            # regerado
├── HANDOFF.md                   # ← ESTE ARQUIVO (atualizado pós-hotfix 6)
├── CHANGELOG.md                 # Keep a Changelog format (hotfix 6 adicionado)
├── README.md                    # PT-BR
└── mint-install-pro_1.3.2_all.deb  # 1.27 MB, último build (hotfix 6)
```

**Working tree** (hotfix 6 pronto para commit): 7 modificados + 2 novos:

```
M  scripts/build_deb.py
M  src/App.jsx
M  src/components/BatchActionModal.jsx
M  src/components/ErrorBoundary.jsx
M  src/components/HeaderBar.jsx
M  src/main.jsx
M  src/services/packageManager.js
?? src/components/DebugDock.jsx
?? src/services/debugLog.js
?? HANDOFF.md
```

**Último commit em master**: `f1d200a hotfix: tela cinza no batch action (v1.3.2 hotfix 1)`.

---

## TL;DR

1. **App é um clone do mintinstall 6.1.4 do Linux Mint**, escrito em React+Vite, com backend Python embarcado no `.deb`.
2. **v1.5.5 em produção e instalada no sistema do usuário.** 359 testes verdes (lint 0/0, custom 141/141, vitest 215/215, Playwright 6/6). 7 releases publicadas desde v1.4.1.
3. **Saga "tela cinza" fechada** (v1.5.3) — foram 3 bugs distintos: DebugDock off, callback incompatível, e launcher duplicado em `~/.local/bin/` mascarando o fix.
4. **Saga "directory listing" fechada** (v1.5.5) — removeu `MimeType=` do `.desktop` + `xdg-mime` do postinst + detecção de cópias obsoletas em `~/.local/bin/`.
5. **Hardening completo**: regex whitelist para APT/Flatpak IDs, CSRF protection, loopback-only binding, mutex threading no `/api/install`, 9 vetores de ataque empiricamente bloqueados.
6. **Identidade visual**: ícone `icon_mip.svg` (Grid Mint) usado em favicon, `.desktop` e empacotamento do `.deb`.
7. **Próximo passo**: 4 remediações de segurança opcionais (chmod 600 `.git/config`, npm audit fix, lockfile `--frozen-lockfile` no CI, validação Python própria) + auto-update do catálogo.
