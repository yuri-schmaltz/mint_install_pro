# Relatório de testes — versão 1.6.3 — 09/10/2026

A limpeza removeu 115 arquivos versionados sem uso ou obsoletos: imagens que
não eram referenciadas, propostas antigas de ícones, documentação histórica
redundante, dados abandonados e o painel DebugDock com seus testes exclusivos.
Também foram removidos carregadores de catálogo e de populares do Flathub que
não eram chamados pela aplicação, junto com testes e mocks dessas funções.

## Validação local

| Suíte | Aprovados | Resultado |
| --- | ---: | --- |
| Vitest — componentes, hooks, serviços e integração | 1.479 | 27 arquivos, sem falhas |
| Python — backend e launcher, incluindo dois testes WebKitGTK nativos | 50 | Sem falhas ou testes ignorados |
| Playwright — desenvolvimento e produção | 98 | Sem falhas ou retries |
| Conformidade do projeto | 128 | Sem falhas |
| **Total** | **1.755** | **Aprovado** |

ESLint e build de produção passaram. O teste de auditoria estática foi repetido
após o ajuste final de seus comentários e verificações. A redução no número de
testes corresponde à remoção de testes exclusivos de recursos abandonados;
os cenários de operações em lote, proteção, pesquisa, preferências, inventário,
rolagem, identidade visual e handlers de diagnóstico continuam cobertos.

## Integridade após a limpeza

- Os ícones locais das 1.800 entradas do catálogo e os cinco banners ativos
  foram conferidos no disco, sem referências ausentes.
- O catálogo distribuído corresponde à fonte `src/data/initialApps.js`; a
  migração continua idempotente e não recria o índice leve obsoleto.
- As categorias usam a fonte canônica `src/data/categoriesList.js`, inclusive
  no gerador de catálogo; a definição antiga e duplicada foi eliminada.
- Os links locais da documentação foram conferidos. Relatórios de versões
  publicadas continuam disponíveis nas respectivas releases e no histórico Git.
- `sync_icons.py` preserva o SVG canônico e regenera os PNGs e a prévia usando
  uma cópia temporária, sem recriar o SVG público redundante removido.
- A sintaxe dos scripts Python alterados foi conferida.

## Pacote Debian

Foi gerado e verificado `mint-install-pro_1.6.3_all.deb`. A verificação comparou
os **267 arquivos do bundle** com `dist/`, além do SVG canônico, PNG hicolor,
launcher, backend e desktop. Também conferiu nome, versão, arquitetura,
permissões, sintaxe Python e ausência de arquivos extras.

O pacote da 1.6.2 continha 360 arquivos no bundle. A limpeza reduz os recursos
copiados ao pacote sem remover os ícones usados pelos aplicativos ou pelo sistema.
O `.deb` foi extraído para verificação; não foi instalado nesta validação.

## Reprodução

```sh
python3 scripts/migrate_catalog.py
python3 scripts/sync_icons.py
npm run test:unit
npm test
npm run lint
npm run test:e2e -- --workers=4
python3 -m unittest discover -s scripts -p 'test_*.py'
python3 scripts/build_deb.py
python3 scripts/verify_deb.py
```

Playwright gera o build de produção. Os testes nativos precisam de `dist/`,
Python GI, GTK 3, WebKit2GTK e display. Os comandos Python nativos desta execução
foram executados no host com `flatpak-spawn`. Os logs locais estão em
`test-results/verification/`, fora do versionamento.

Os testes de operações usam executores simulados ou interceptam a API. Não
instalam nem removem pacotes reais e não provam todos os sistemas, repositórios
ou falhas possíveis. Não foi calculada cobertura de linhas.
