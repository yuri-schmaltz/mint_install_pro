# 🌿 Mint Install Pro

Gerenciador visual de aplicativos para Linux Mint, com interface React inspirada
no Mint-Y Dark, catálogo APT + Flatpak e operações individuais ou em lote.
As operações em lote solicitam uma única autorização administrativa quando
necessária, válida para todo o lote. Flatpaks do usuário dispensam essa autorização.
Componentes essenciais e de base do sistema aparecem como protegidos e têm a
remoção bloqueada, inclusive quando seriam removidos como dependência.

Versão: **1.6.2**, com o desenho atualizado do ícone.
[Release estável: v1.6.2](https://github.com/yuri-schmaltz/mint_install_pro/releases/tag/v1.6.2).
Veja as mudanças em [CHANGELOG.md](CHANGELOG.md).

## Funcionalidades

- Catálogo local de 1.800 entradas: 1.600 APT e 200 Flatpak, com categorias e busca.
- `Ctrl+F` (ou `Cmd+F`) foca a pesquisa e seleciona o texto atual.
- Consulta dos pacotes realmente instalados via `dpkg-query` e `flatpak list`,
  atualizada ao iniciar, ao voltar à janela, a cada 30 segundos e após operações.
- Instalação e remoção individuais ou em lote, com confirmação configurável e
  distinção entre sucesso e falha por aplicativo.
- Busca online no Flathub integrada à lista. A opção de incluir resultados online
  não verificados controla os novos resultados recebidos da API; o catálogo
  local não contém comprovação de verificação dos seus itens.
- Preferências organizadas em três abas: Pesquisa, Flatpaks e Operações & Lote,
  incluindo campos de busca, categoria e prioridade APT/Flatpak.
- Cards instalados com fundo neutro e checkbox verde. Os rótulos Instalar e
  Desinstalar ficam à direita do nome; a seleção em lote mantém Marcar Todos
  no topo da grade e Executar Ações no rodapé.
- Grade com renderização dos cards próximos à área visível, mantendo a altura
  total da lista. Marcar Todos continua selecionando todos os resultados do
  filtro atual que podem receber ações, inclusive os que estão fora da tela.
- Abertura de apps instalados via Flatpak ou lançador gráfico pertencente ao
  pacote APT. Pacotes sem lançador gráfico retornam uma mensagem explicativa.
- Exportação da lista de apps instalados presentes no catálogo. Importar um
  backup prepara uma seleção para instalação; não altera o estado instalado.

Instalações Flatpak usam o escopo do usuário e exigem o remoto `flathub` nesse
escopo. Remoções incluem as instalações do usuário e do sistema. APT e operações
Flatpak de sistema podem exigir autenticação pelo sistema operacional.

Nos lotes, os estados e resultados de cada aplicativo chegam durante a execução.
O registro de saída de cada comando é mostrado quando ele termina; a saída do
APT/Flatpak não é transmitida linha a linha. Se a API estiver indisponível, o
app informa a falha e bloqueia novas operações até conseguir consultar o estado
do sistema.

## Mais bem avaliados

A seção ordena as notas do catálogo carregado e mostra até 18 aplicativos,
em páginas de seis. Não existe atualização periódica dessas notas pela rede.
O catálogo reúne notas fixas, dados do cache local do MintInstall e estimativas
usadas quando faltam avaliações; os valores exibidos não representam sempre
médias de avaliações reais. Eles podem mudar quando o catálogo for regenerado
e distribuído em uma nova versão. A atualização do inventário a cada 30 segundos
consulta o estado instalado, sem atualizar as notas.

## Desenvolvimento

Requisitos: Node.js 22.13+ da série 22 ou Node.js 24+, npm, Python 3 e um sistema
com APT. Flatpak é necessário para suas respectivas operações. A interface nativa
usa Python GI, GTK 3 e WebKit2GTK 4.1 (com fallback para 4.0).

```bash
npm ci
npm run dev
```

Abra `http://127.0.0.1:3000`. O script `./run.sh` instala dependências quando
necessário, executa a auditoria estática e inicia o servidor local.

**O modo de desenvolvimento executa operações reais de pacotes.** O backend é o
mesmo usado no `.deb`; não existe fallback que simule sucesso.

## Build e pacote Debian

```bash
npm run build:deb
python3 scripts/verify_deb.py
```

Isso gera `mint-install-pro_1.6.2_all.deb`. Para instalá-lo no sistema desejado:

```bash
sudo apt install ./mint-install-pro_1.6.2_all.deb
```

Abra pelo menu ou execute `mint-install-pro`. Para diagnosticar a interface no
navegador, use `mint-install-pro --force-browser`.

O pacote registra o aplicativo no menu; não altera associações de arquivos nem
remove launchers pessoais. Se uma cópia antiga em `~/.local/bin` estiver antes
de `/usr/bin` no PATH, use `/usr/bin/mint-install-pro` e revise a cópia antiga.
O menu, a janela GTK, o favicon e a tela Sobre usam o SVG canônico `icon_mip.svg`.
O novo desenho usa um pacote branco com seta sobre fundo verde Mint;
veja a [prévia em tamanhos de menu e barra de tarefas](docs/icon-preview.png).
Depois de editar o SVG, execute `python3 scripts/sync_icons.py` antes do build
para atualizar o SVG público, PNGs e prévia. O comando requer `rsvg-convert`,
fornecido por `librsvg2-bin`.

## Verificações

```bash
npm test                       # catálogo, arquivos e estrutura; não exige .deb
npm run test:unit              # componentes, hooks e serviços
npm run test:backend           # API Python e WebView GTK, quando disponível
npm run lint
npm run test:e2e:install       # instala Chromium para Playwright
npm run test:e2e               # desenvolvimento e build de produção
npm audit --audit-level=moderate
```

Os testes de operações substituem o executor ou interceptam a API: não instalam
nem removem pacotes da máquina. O teste GTK é ignorado quando não há display,
bindings nativos ou build em `dist/`. Para executá-lo, gere o build e rode
`npm run test:backend` numa sessão GTK.

## Estrutura

- `src/components/`: interface, detalhes, preferências e lote.
- `src/hooks/`: catálogo, estado instalado, busca, navegação e seleção.
- `src/services/`: carregamento do catálogo, Flathub e cliente da API.
- `scripts/package_backend.py`: validação, consulta e execução de pacotes.
- `scripts/vitePackageApi.js`: ponte da API para desenvolvimento e preview.
- `scripts/launcher.py`: janela GTK e servidor do pacote instalado.
- `scripts/build_deb.py`: empacotamento a partir da versão de `package.json`.
- `public/data/`: catálogo gerado a partir de `src/data/initialApps.js`.

Veja também [SECURITY.md](SECURITY.md), [CONTRIBUTING.md](CONTRIBUTING.md),
[ABOUT.md](ABOUT.md), [HANDOFF.md](HANDOFF.md), [CHANGELOG.md](CHANGELOG.md) e
o [relatório de testes da versão 1.6.2](RELATORIO_TESTES.md) e a
[verificação da correção de rolagem 1.6.1](docs/scroll_performance_1.6.1.md).

Licença [MIT](LICENSE). Copyright © 2026 Yuri Schmaltz.
