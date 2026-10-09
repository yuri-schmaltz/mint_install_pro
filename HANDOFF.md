# Handoff de desenvolvimento — Mint Install Pro 1.6.0

Estado documentado em **09/10/2026**.

## Entrega publicada

- Repositório: [yuri-schmaltz/mint_install_pro](https://github.com/yuri-schmaltz/mint_install_pro), branch `master`.
- Release estável: [v1.6.0](https://github.com/yuri-schmaltz/mint_install_pro/releases/tag/v1.6.0).
- Tag de release no commit `ab5d508c93b6e1ce812fd89d5e905fb4b686ba3e`.
- Assets publicados: `mint-install-pro_1.6.0_all.deb`, `RELATORIO_TESTES.md` e `SHA256SUMS`.
- [CI da entrega](https://github.com/yuri-schmaltz/mint_install_pro/actions/runs/37905768730): testes/build nas séries Node 22 e 24, auditoria e empacotamento aprovados.

Alterações de documentação posteriores à tag podem estar em `master`.
O histórico anterior foi preservado em
[docs/archive/handoff-pre-1.6.0.md](docs/archive/handoff-pre-1.6.0.md).

## Arquitetura e requisitos

React 18, Vite 7, Tailwind CSS 4 com `@tailwindcss/postcss`, Python 3 e pacote
Debian. Node.js 22.13+ da série 22 ou Node.js 24+ é necessário para desenvolvimento.
A interface nativa usa Python GI, GTK 3 e WebKit2GTK 4.1 com fallback para 4.0.

- `src/components/`: interface, cards, detalhes, preferências e execução do lote.
- `src/hooks/`: catálogo, busca, inventário instalado e seleção de ações.
- `src/services/`: acesso ao catálogo, Flathub e API local.
- `scripts/package_backend.py`: servidor HTTP e executor de operações reais.
- `scripts/vitePackageApi.js`: ponte usada em desenvolvimento e preview.
- `scripts/launcher.py`: servidor e janela GTK do pacote instalado.
- `scripts/build_deb.py` e `scripts/verify_deb.py`: geração e inspeção do `.deb`.
- `icon_mip.svg`: fonte canônica usada pelo desktop, GTK, favicon e tela Sobre.
- `src/data/initialApps.js`: fonte do catálogo; `scripts/migrate_catalog.py`
  sincroniza os arquivos distribuídos em `public/data/`.

## Comportamento da versão

O inventário instalado é consultado no início, ao retornar à janela, a cada
30 segundos e após operações. A API indisponível gera mensagem de falha e
bloqueia novas operações até que o inventário possa ser consultado.

`POST /api/batch` transmite estados e resultados por NDJSON. O backend valida
o plano e solicita uma única autorização via `pkexec` para as ações
administrativas do lote; Flatpaks do usuário são processados depois. Cancelar
a autorização encerra o restante do lote. Se faltar resultado do auxiliar,
os sucessos confirmados são preservados, os demais itens falham e não há nova
solicitação de autorização. A saída de cada comando chega quando ele termina.

A política de proteção bloqueia a remoção de componentes essenciais, de base,
da sessão gráfica e do kernel em uso. Remoções APT simulam dependências antes
da autorização e são revalidadas pelo auxiliar. Instalações APT usam
`--no-remove`. Consulte [SECURITY.md](SECURITY.md) para regras e limites.

`Ctrl+F`/`Cmd+F` foca a pesquisa. Cards instalados têm fundo neutro e checkbox
verde; ações selecionadas mantêm destaque e rótulo à direita do nome. Marcar
Todos permanece no topo da grade. As preferências têm três abas: Pesquisa,
Flatpaks e Operações & Lote.

## Verificações e reprodução

```bash
npm ci
npm test
npm run test:unit
npm run test:backend
npm run lint
npm run test:e2e:install
npm run test:e2e
npm audit --audit-level=moderate
npm run build:deb
python3 scripts/verify_deb.py
```

A execução local da entrega aprovou 1.506 testes Vitest, 49 Python, 84 Playwright
e 130 verificações de conformidade, totalizando 1.769. O teste WebKitGTK nativo
passou nessa execução. Em ambientes sem display, bindings ou `dist/`, ele pode
ser ignorado; gere o build antes dos testes Python para incluí-lo.
Os testes de operações não alteram os pacotes instalados da máquina.
Veja os cenários e limites em [RELATORIO_TESTES.md](RELATORIO_TESTES.md).

## Limites relevantes

- Mais bem avaliados ordena notas do catálogo, incluindo valores fixos e
  estimados. Não existe sincronização periódica de avaliações.
- Flatpak instala no escopo do usuário e exige o remoto `flathub` nesse escopo;
  remoções consultam as instalações do usuário e do sistema.
- Pacotes APT sem lançador gráfico não podem ser abertos pelo botão Abrir.
- A API valida origem e usa loopback, mas não impede chamadas feitas por outros
  processos executando como o usuário local.
- A proteção de remoções vale para operações deste aplicativo; outros
  gerenciadores continuam podendo alterar os pacotes do sistema.
- O pacote não altera associações de arquivos nem remove launchers pessoais.
  Uma cópia antiga em `~/.local/bin` pode preceder `/usr/bin` no PATH.

O [README](README.md) orienta o uso; [CONTRIBUTING.md](CONTRIBUTING.md) descreve
o fluxo de contribuição e [CHANGELOG.md](CHANGELOG.md) registra as versões.
