# Relatório de testes — versão 1.6.2 — 09/10/2026

Esta versão integra o desenho manual atualizado de `icon_mip.svg`. O SVG fonte
foi preservado byte a byte; foram regenerados o SVG público, os favicons de
16/32/48 px, o PNG hicolor de 96 px e a prévia com amostras em fundos claro e escuro.

## Verificações locais

| Verificação | Resultado |
| --- | --- |
| Identidade visual em desenvolvimento e produção — Playwright | 2 testes aprovados |
| WebKitGTK nativo — lote/origem e rolagem virtualizada | 2 testes aprovados, sem testes ignorados |
| Conformidade do projeto | 130 verificações aprovadas |
| Build de produção | Aprovado |
| Carregamento do SVG no GdkPixbuf | 16, 24, 32, 48, 64, 96 e 256 px |
| Regeneração dos arquivos derivados | Repetição sem diferenças; fonte preservada |
| Sintaxe de scripts/sync_icons.py | Válida |
| Verificação do pacote Debian | 360 arquivos do bundle, ícones, launcher, backend e metadados conferidos |

O teste de identidade compara o favicon com o SVG canônico, a árvore SVG da tela
Sobre com o desenho fonte e a versão exibida com `package.json`.
A regeneração foi executada novamente e comparada por SHA-256, incluindo a fonte,
para confirmar que o processo não altera o desenho e produz os mesmos arquivos.

O `.deb` foi instalado e seu estado confirmado como `install ok installed`, versão
1.6.2. Todos os 366 arquivos instalados foram comparados byte a byte com o pacote,
incluindo os ícones. O launcher é executável e o bundle não contém arquivos extras,
exceto cache Python.

A validação completa da versão anterior está preservada no
[relatório histórico da 1.6.1](docs/archive/test-report-1.6.1.md). Esta atualização
não altera o comportamento dos aplicativos, filtros ou operações em lote.
O [CI](https://github.com/yuri-schmaltz/mint_install_pro/actions/workflows/ci.yml)
executa as suítes completas nas séries Node 22 e 24, lint, auditoria, build e
empacotamento; os testes GTK dependem de display e bindings nativos.

## Reprodução

```sh
# Requer rsvg-convert, fornecido por librsvg2-bin.
python3 scripts/sync_icons.py
npm run test:e2e -- e2e/branding.spec.js
python3 -m unittest discover -s scripts -p 'test_webview.py'
npm test
python3 scripts/build_deb.py
python3 scripts/verify_deb.py
```

Os testes Playwright geram o build de produção. Os testes nativos precisam de
`dist/`, Python GI, GTK 3, WebKit2GTK e display; nesta execução os dois passaram.
Os comandos Python nativos foram executados no host com `flatpak-spawn`.
As operações de pacotes nos testes foram interceptadas ou usaram executores
simulados. A instalação real atualizou apenas o próprio Mint Install Pro.

Os logs locais estão em `test-results/verification-1.6.2/`, fora do versionamento.
O pacote anexado à release é `mint-install-pro_1.6.2_all.deb`; seu SHA-256 está
em `SHA256SUMS`, publicado junto ao pacote e a este relatório.
