# Correção de rolagem — versão 1.6.1

Verificação em **09/10/2026**, motivada pelo vídeo local
`Peek 09-10-2026 14-15.mp4`. A gravação tem 19,7 segundos, resolução 1274 × 842
e taxa de captura de 10 fps; essa taxa não mede os frames do aplicativo.

## Problema e alteração

A grade começava com 60 aplicativos e acrescentava 48 ao se aproximar do fim.
Os cards anteriores continuavam montados. Ao percorrer o catálogo completo,
o DOM chegava a 1.800 cards e a altura da barra de rolagem mudava a cada expansão.

`useVirtualGrid` mantém as linhas próximas à área visível, com uma margem de
seis linhas de cada lado e limites arredondados em blocos de quatro linhas.
O espaçamento representa as demais linhas e preserva a altura total do catálogo.
As atualizações são agrupadas com `requestAnimationFrame`; a grade só muda
quando sua janela de linhas muda. `ResizeObserver`, com fallback para o evento
`resize`, acompanha a largura e altura disponíveis.

O WebKitGTK pode reportar uma altura provisória muito grande durante a abertura.
A medição é limitada à altura da janela para evitar montar todo o catálogo
nessa etapa. A região de rolagem usa contenção de layout/pintura e desativa
ancoragem automática, pois a própria grade mantém as posições dos cards.
Os ícones usam decodificação assíncrona, sem filtro de sombra ou animação de escala.

Marcar Todos continua usando todos os resultados do filtro atual, excluindo
pacotes protegidos. A renderização parcial não limita a seleção em lote.
Buscar ou trocar filtros retorna ao início; atualizar o inventário preserva a
posição quando os resultados continuam disponíveis. Cards reciclados recuperam
a seleção do estado central da aplicação.

## Medição no WebKitGTK

Foi comparado o bundle publicado no `.deb` 1.6.0 com o build corrigido, em uma
janela nativa de 1274 × 842, WebKitGTK 2.52.6. A API de inventário foi substituída
por uma resposta controlada, com os mesmos 180 itens do catálogo marcados como
instalados nas duas versões. Nenhum pacote foi instalado ou removido.

A medição aplicou 120 passos de 80 pixels, aguardando `requestAnimationFrame`
entre os passos. A janela de teste foi fechada ao terminar. As execuções usadas
na comparação ocorreram sem outras suítes de teste em paralelo.

| Medida — lista de 180 instalados | 1.6.0 | 1.6.1 |
|---|---:|---:|
| Máximo de cards montados | 180 | 84 |
| Altura de rolagem inicial/final | 1.927 / 5.110 px | 5.110 / 5.110 px |
| Intervalo entre frames no percentil 95 | 142 ms | 114 ms |
| Intervalos acima de 50 ms | 54 | 54 |

Nesse cenário, o percentil 95 diminuiu cerca de 20%, mas continuam existindo
intervalos longos. O resultado não garante 60 fps nem substitui a observação
na máquina do usuário. Os tempos variam com hardware, compositor, decodificação
de ícones e velocidade do gesto. A correção elimina o crescimento do DOM e da
barra de rolagem; o teste de regressão usa limites de DOM e comportamento,
sem impor um tempo absoluto que dependeria da máquina.

No catálogo completo, a execução corrigida manteve no máximo 84 cards montados
para 1.800 entradas, com altura de rolagem de 50.470 px do início ao fim. A versão
anterior acumulava os 1.800 cards ao chegar ao fim.
Os [dados das medições](benchmarks/scroll-1.6.1.json) acompanham este relatório.

## Testes de regressão

- Vitest: ciclo de vida, agrupamento de eventos, cancelamento de frames e
  observadores, lista vazia, mudança de filtro, inventário, redimensionamento,
  ausência de `ResizeObserver` e altura provisória do GTK.
- Playwright: 1.800 aplicativos em 1, 2 e 3 colunas; início, meio e fim da lista;
  altura estável; retorno ao topo; seleção persistida; Marcar Todos fora da tela;
  proteção de pacotes; pesquisa; filtro APT/Flatpak; categorias; instalados;
  Tab/Shift+Tab entre cards e abertura de detalhes; atualização do inventário.
- WebKitGTK nativo: catálogo real de 1.800 entradas, rolagem ao meio/fim/início,
  DOM limitado, altura estável e seleção preservada. Operações reais ficam
  bloqueadas pelo executor do teste.

## Reprodução

```bash
npm run test:unit
npm run test:e2e:install
npm run test:e2e -- e2e/scroll-regression.spec.js
npm run build
python3 -m unittest discover -s scripts -p 'test_webview.py'
npm run build:deb
python3 scripts/verify_deb.py
```

Os testes nativos precisam de display, Python GI, GTK 3, WebKit2GTK 4.1 e build
em `dist/`; são ignorados quando esses requisitos não estão disponíveis.

Os resultados da validação atual estão no [relatório de testes](../RELATORIO_TESTES.md).
Os relatórios das versões publicadas acompanham as
[releases](https://github.com/yuri-schmaltz/mint_install_pro/releases).
