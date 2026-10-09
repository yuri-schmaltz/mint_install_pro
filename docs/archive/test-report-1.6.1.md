# Relatório de testes — versão 1.6.1 — 09/10/2026

A validação local da versão 1.6.1 repetiu todas as suítes, incluindo os testes
nativos WebKitGTK, sem falhas e sem testes ignorados.

| Suíte | Casos aprovados | Resultado |
| --- | ---: | --- |
| Vitest: componentes, hooks, serviços, integração e auditoria estática | 1.511 | 29 arquivos aprovados |
| Python: API, validação, autorização, proteção e WebKitGTK nativo | 50 | Aprovado, incluindo dois testes nativos |
| Playwright: Chromium em desenvolvimento e produção | 98 | Aprovado, sem retries |
| Verificações de conformidade do projeto | 130 | Aprovado |
| **Total** | **1.789** | **0 falhas** |

ESLint passou sem erros ou avisos. O build de produção passou e a auditoria
`npm audit --audit-level=moderate` reportou zero vulnerabilidades.

## Cobertura da versão

A cobertura anterior continua passando: preferências e persistência, backup,
matriz de filtros, Ctrl+F/Cmd+F, cards responsivos, inventário, respostas NDJSON,
execução em lote, autorização única, remoções protegidas, validação HTTP,
identidade visual e versão. O [relatório histórico da 1.6.0](test-report-1.6.0.md)
detalha esses cenários e suas dimensões.

Foram acrescentados cinco testes Vitest, um método Python nativo e sete cenários
Playwright executados em desenvolvimento e produção, totalizando 20 casos:

- Grade com 1.800 aplicativos em 1, 2 e 3 colunas; rolagem ao início, meio e fim;
  altura estável, último card acessível e limite de 90 cards montados.
- Seleção preservada ao reciclar cards, Marcar Todos incluindo itens fora da
  tela e proteção de remoções preservada.
- Pesquisa, lista vazia, categorias, APT/Flatpak e instalados após rolar ao fim;
  redimensionamento e atualização externa do inventário.
- Tab/Shift+Tab entre cards e abertura dos detalhes de um aplicativo distante.
- Agrupamento de eventos de rolagem por frame, limpeza de observadores e frames,
  ausência de ResizeObserver e altura provisória muito grande no WebKitGTK.
- Janela WebKitGTK com catálogo real de 1.800 entradas, rolagem ao meio/fim/início,
  altura estável, DOM limitado e seleção preservada.

A [verificação de desempenho](../scroll_performance_1.6.1.md) inclui as medições
comparativas e os limites da conclusão. Não foi estabelecida uma garantia de FPS.

## Ícone e pacote final

O SVG canônico recebeu uma edição durante a validação. Essa edição foi preservada;
SVG público, PNGs e prévia foram regenerados. Depois dela, os dois testes de
identidade visual passaram novamente em desenvolvimento e produção e o build
foi repetido. GdkPixbuf nativo carregou o ícone em 16, 24, 32, 48, 64, 96 e 256 px.

A verificação do `.deb` comparou os 360 arquivos do bundle, ícones, launcher,
backend, metadados, arquitetura, permissões e sintaxe Python. A instalação real
foi executada e o estado `install ok installed`, versão 1.6.1, foi confirmado.
Os 366 arquivos instalados foram comparados byte a byte com o pacote final,
incluindo os ícones; não há arquivos extras no bundle, exceto cache Python.

O pacote instalado e anexado à release é `mint-install-pro_1.6.1_all.deb`.
Seu SHA-256 está em `SHA256SUMS`, publicado junto ao pacote e a este relatório.

## Reprodução

```sh
npm run test:unit
npm run build
python3 -m unittest discover -s scripts -p 'test_*.py'
npm run test:e2e -- --workers=4
npm test
npm run lint
npm audit --audit-level=moderate
python3 scripts/build_deb.py
python3 scripts/verify_deb.py
```

Execução local com Node.js 22.23.2, Chromium do Playwright e Python do sistema.
Os comandos Python foram executados no host com `flatpak-spawn` para acessar
GTK/WebKitGTK. Os testes nativos precisam de display, bindings e build em
`dist/`; podem ser ignorados em ambientes sem esses requisitos.

Os logs da preparação da release foram preservados localmente em
`test-results/verification/`. A pasta não integra o código versionado.

## Limites

Os testes de operações usam executores simulados ou interceptam a API: não
instalam nem removem programas. A instalação real citada acima atualizou apenas
o próprio Mint Install Pro; não valida transações reais de outros aplicativos.
A matriz de filtros é exaustiva para o catálogo e as dimensões descritos no
relatório anterior. Não prova todos os dados, sistemas, repositórios, falhas de
rede ou interrupções possíveis. Não foi calculada cobertura de linhas.
