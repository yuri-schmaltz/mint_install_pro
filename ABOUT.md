# Sobre o Mint Install Pro

O Mint Install Pro é um projeto independente de Yuri Schmaltz para gerenciar
aplicativos APT e Flatpak no Linux Mint. A interface é inspirada no tema Mint-Y
Dark. A release estável é a [1.6.1](https://github.com/yuri-schmaltz/mint_install_pro/releases/tag/v1.6.1),
com correção da rolagem e novo ícone.

## Funcionalidades

- Catálogo de 1.800 entradas, categorias e pesquisa local, com busca online no Flathub.
- Consulta de instalações reais do sistema, abertura de apps com lançador gráfico
  e exportação/importação de seleções para instalação.
- Operações individuais e em lote. Quando necessário, uma autorização
  administrativa vale para todo o lote, com resultados por aplicativo.
- Bloqueio de remoções APT que atingiriam componentes protegidos do sistema,
  com indicação do motivo na interface.
- `Ctrl+F`/`Cmd+F` para pesquisar; cards instalados com fundo neutro, checkbox verde
  e rótulos de ação à direita do nome.
- Preferências nas abas Pesquisa, Flatpaks e Operações & Lote.
- Ícone canônico `icon_mip.svg` no menu, janela GTK, favicon e tela Sobre.
  O desenho usa um pacote branco com seta de instalação e fundo verde Mint.
- Grade que renderiza os cards próximos à área visível para reduzir o trabalho
  de rolagem, preservando a seleção de itens fora da tela.

A seção Mais bem avaliados usa notas do catálogo, incluindo valores fixos e
estimados. Não recebe avaliações atualizadas periodicamente pela rede.
Veja o [README](README.md#mais-bem-avaliados) para os limites desses dados.

## Arquitetura

| Camada | Implementação |
|---|---|
| Interface | React 18, Vite 7 e Tailwind CSS 4 |
| Estado e serviços | Hooks React, catálogo local e cliente HTTP do Flathub |
| API de pacotes | Python 3, execução de APT/Flatpak e validação de requisições |
| Janela nativa | Python GI, GTK 3 e WebKit2GTK |
| Distribuição | Pacote Debian gerado a partir da versão em `package.json` |

O [README](README.md) descreve o uso e os requisitos;
[SECURITY.md](SECURITY.md) explica a proteção de pacotes e os limites da API;
[CONTRIBUTING.md](CONTRIBUTING.md) orienta contribuições.
Os resultados e limites dos testes estão em [RELATORIO_TESTES.md](RELATORIO_TESTES.md).
Veja também a [verificação de rolagem da versão 1.6.1](docs/scroll_performance_1.6.1.md).

Desenvolvido por **Yuri Schmaltz**. Copyright © 2026.
Distribuído sob a licença [MIT](LICENSE).
