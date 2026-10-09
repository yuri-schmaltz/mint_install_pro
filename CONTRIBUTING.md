# Guia de contribuição

Este guia acompanha a versão 1.6.0. Consulte o [README](README.md) para instalação
e o [HANDOFF](HANDOFF.md) para o estado técnico da entrega.

## Ambiente de desenvolvimento

- Node.js 22.13+ da série 22 ou Node.js 24+, com npm. O CI usa as séries 22 e 24.
- Python 3, necessário para a API de pacotes também em desenvolvimento.
- Linux com APT; Flatpak para suas operações. A janela nativa exige Python GI,
  GTK 3 e WebKit2GTK 4.1, com fallback para 4.0.

```bash
git clone https://github.com/yuri-schmaltz/mint_install_pro.git
cd mint_install_pro
npm ci
npm run dev
```

Acesse `http://127.0.0.1:3000`. O servidor de desenvolvimento usa a API real de
pacotes: acionar uma instalação ou remoção na interface altera o sistema.

## Validação

Para mudanças no comportamento, execute as suítes correspondentes e as
verificações exigidas pelo CI:

```bash
npm test
npm run test:unit
npm run test:backend
npm run lint
npm run test:e2e:install
npm run test:e2e
npm run build
npm audit --audit-level=moderate
```

Playwright executa os mesmos cenários em desenvolvimento e produção e inicia
seus próprios servidores; deixe as portas 3000 e 4173 livres. Os testes de
operações usam executores simulados ou interceptam a API. Não instalam nem
removem pacotes reais. O teste nativo GTK pode ser ignorado sem display,
bindings ou `dist/`; para incluí-lo, gere o build e rode os testes Python
numa sessão com GTK/WebKitGTK disponíveis.

Para mudanças no launcher, ícones ou empacotamento, confira também o artefato:

```bash
npm run build:deb
python3 scripts/verify_deb.py
```

A verificação extrai o `.deb` e compara arquivos e metadados, sem instalá-lo.
O [relatório da versão 1.6.0](RELATORIO_TESTES.md) registra 1.506 testes Vitest,
49 Python, 84 Playwright e 130 verificações de conformidade aprovados. Esses
números descrevem aquela execução; novas contribuições podem alterá-los.

## Convenções

- Use a paleta Mint-Y Dark em `tailwind.config.js`. O projeto usa Tailwind CSS 4
  com `@tailwindcss/postcss`; `src/index.css` carrega a configuração e as
  utilidades de compatibilidade da interface.
- Mantenha componentes em `src/components/`, estado em `src/hooks/` e clientes
  em `src/services/`. A execução e validação de comandos ficam em
  `scripts/package_backend.py`, compartilhado pelo Vite e pelo launcher GTK.
- Preferências usam `localStorage` com tratamento de indisponibilidade. O estado
  instalado vem do sistema; flags do catálogo e backups não comprovam instalação.
- Use `icon_mip.svg` da raiz como fonte do ícone. O empacotamento e a interface
  devem continuar apontando para essa fonte.
- Alterações no catálogo devem manter `src/data/initialApps.js` e `public/data/`
  sincronizados. Após alterar a fonte, execute `python3 scripts/migrate_catalog.py`.
- Preserve a validação de origem, os limites de requisição e a política de
  proteção de pacotes documentados em [SECURITY.md](SECURITY.md).
- Prefira commits com prefixos `feat:`, `fix:`, `docs:`, `refactor:`, `test:` ou
  `style:` conforme a alteração.

## Pull requests

Crie uma branch descritiva a partir de `master`, faça a alteração e execute as
verificações relevantes. Envie a branch ao seu fork e abra um pull request com
o problema resolvido, o comportamento resultante e a validação feita. Inclua
capturas quando elas ajudarem a revisar mudanças visuais.

Atualize a documentação quando mudar comandos, requisitos ou comportamento.
