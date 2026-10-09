# Relatório de testes — versão 1.6.0 — 09/10/2026

Foram acrescentados 1.331 casos automatizados: 1.268 casos Vitest, 15 métodos
Python (com matrizes adicionais de subcasos) e 48 execuções Playwright.
A execução final de todas as suítes terminou sem falhas e sem testes ignorados.

| Suíte | Casos aprovados | Resultado |
| --- | ---: | --- |
| Vitest: componentes, hooks, serviços, integração e auditoria estática | 1.506 | 28 arquivos aprovados |
| Python: API, validação, autorização, proteção e WebKitGTK nativo | 49 | Aprovado |
| Playwright: Chromium em desenvolvimento e produção | 84 | Aprovado, sem retries |
| Verificações de conformidade do projeto | 130 | Aprovado |
| **Total** | **1.769** | **0 falhas** |

O ESLint também terminou sem erros ou avisos. O build de produção foi executado
pelo Playwright antes da suíte de produção. O pacote `.deb` foi regenerado e seu
conteúdo conferido: todos os arquivos do bundle, ausência de arquivos extras,
ícones, launcher executável, backend, nome, versão, arquitetura e sintaxe Python.
Na preparação do release, a auditoria identificou vulnerabilidades nas ferramentas
de compilação. As dependências foram atualizadas e as suítes executadas novamente;
`npm audit --audit-level=moderate` passou com zero vulnerabilidades.

## Cobertura acrescentada

- Preferências: ausência da aba “Sistema & Padrão” e de seus elementos, navegação
  entre as três abas restantes, todas as opções booleanas nas duas direções,
  formatos APT/Flatpak/todos, alterações consecutivas, sincronização externa,
  confirmação de salvamento, persistência ao reabrir e recarregar e Limpar Cache.
- Backups: listas vazias e preenchidas, exportação real de JSON, liberação da URL
  temporária, erro de exportação, importação válida, filtragem de valores não
  booleanos, JSON inválido, arrays e tipos primitivos, cancelamento e nova tentativa.
  O fluxo integrado ignora apps instalados, desconhecidos e protegidos e prepara
  a seleção sem iniciar uma instalação.
- Filtros: matriz de **1.152 combinações** sobre um catálogo controlado. Cruza os
  três formatos, resumo ligado/desligado, descrição ligada/desligada, pesquisa
  restrita/global, somente instalados ligado/desligado, quatro categorias e seis
  consultas. Inclui nomes equivalentes em APT/Flatpak e formatos sem alternativa.
- Atalhos: Ctrl+F, Cmd+F, letra maiúscula, modificadores combinados, seleção do
  texto completo, comandos que não devem ser interceptados e limpeza do listener.
  No navegador, Escape fecha preferências em cada aba.
- Cards: fundo neutro de instalados, checkbox preservado, indicação de instalação
  e remoção à direita e na linha do título, nomes longos e ausência dos elementos
  removidos da barra inferior. Janelas de **390, 820 e 1.280 pixels**.
- Inventário: respostas incompletas, HTTP 403/429/500/503, recuperação, preservação
  da última consulta válida, respostas e erros antigos, cancelamento, timeout,
  consulta por foco e intervalo e limpeza de listeners/timers.
- Respostas em lote: fragmentos de 1, 2, 3, 7, 64 e 65.536 bytes, Unicode e emoji,
  LF/CRLF/ausência de quebra final, linhas vazias, resultados fora de ordem,
  índices inválidos, JSON inválido, erros, resultados duplicados, respostas
  simuladas, interrupção e preservação de sucessos já confirmados. Lote de 500 itens.
- Backend: limites de identificadores e lotes, entradas com argumentos ou comandos,
  ações inválidas, duplicatas, todos os escopos de remoção Flatpak e combinações de
  sucesso/falha, cancelamento administrativo, saída incompleta do auxiliar,
  limite dos logs, 500 operações com uma autorização, todos os pacotes base e
  desktop da lista de proteção e matriz de status/metadados do dpkg.
- HTTP: origem e Host inconsistentes, tipos de conteúdo inválidos, JSON malformado,
  Content-Length inválido, Transfer-Encoding, concorrência e liberação do bloqueio.
- Identidade e versão: tela Sobre usa a versão do manifesto, favicon e imagem
  Sobre correspondem ao SVG canônico `icon_mip.svg` em desenvolvimento e produção.
  GTK carregou o SVG como imagem de 256 × 256 pixels. O desktop instalado aponta
  diretamente para `/usr/share/mint-install-pro/icon_mip.svg`, conferido no pacote.

## Problemas encontrados e corrigidos

1. Um auxiliar administrativo que encerrasse com código zero, mas sem todos os
   resultados, podia permitir que a etapa de usuário declarasse sucesso numa
   remoção Flatpak que também precisava remover a instalação do sistema.
   O backend agora detecta os resultados administrativos ausentes, preserva os
   resultados já confirmados e registra falha nas pendências, sem executar as
   etapas de usuário restantes ou repetir a autorização. Dois testes cobrem essa
   interrupção, incluindo a variante com sucesso parcial anterior.
2. Testes antigos verificavam o bloqueio imediatamente após receber a resposta
   HTTP, antes de a thread do servidor executar sua limpeza. Agora aguardam a
   aquisição do próprio bloqueio com prazo de um segundo, falhando se ele não
   for liberado. Isso elimina a corrida do teste e continua detectando bloqueios
   presos.

## Reprodução

```sh
npm run test:unit
python3 -m unittest discover -s scripts -p 'test_*.py'
npm run test:e2e -- --workers=4
npm test
npm run lint
python3 scripts/build_deb.py
python3 scripts/verify_deb.py
```

Execução feita com Node.js 22.23.2, Chromium do Playwright e Python do sistema.
Neste ambiente, os comandos Python foram executados no host com `flatpak-spawn`
para acessar GTK/WebKitGTK. Em ambientes sem GTK ou display, o teste nativo pode
ser ignorado; nesta execução ele passou.

Os logs da execução final estão em `test-results/verification/`.
As transações de pacotes foram simuladas nos testes; nenhum programa foi
instalado ou removido. A verificação do `.deb` extrai e compara seu conteúdo sem
instalá-lo ou executar scripts de instalação.

## Limites

A matriz de filtros é exaustiva para as dimensões e o catálogo de teste descritos.
Ela não prova todos os dados, sistemas, repositórios ou falhas possíveis. Os testes
de rede usam respostas controladas e os testes de comandos usam executores
simulados; transações reais, todos os ambientes Linux e interrupções físicas não
foram exercitados. Não foi calculada porcentagem de cobertura de linhas.
