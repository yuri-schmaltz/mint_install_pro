# Guia de Contribuição (Contributing Guide)

Obrigado pelo interesse em contribuir com o **Mint Install Pro**! Este projeto é de código aberto e recebe contribuições da comunidade Linux e entusiastas de interfaces modernas.

> ⚠️ **ATENÇÃO — branches deprecated:**
> A branch `origin/fix/batch-modal-tela-cinza` (commit `c140630`) é **pré-gauntlet-loop** e contém regressões severas (remove DebugDock, remove 100+ testes, remove infra de diagnóstico). **NÃO MERGEAR** — prefere sempre `master`. Foi renomeada para `_deprecated/batch-modal-tela-cinza-old-approach` para deixar isso explícito.

---

## 🛠️ Ambiente de Desenvolvimento

### Pré-requisitos
- **Node.js** >= 18.0.0
- **npm** >= 9.0.0
- *(Opcional)* **Python 3** (necessário apenas para regenerar o catálogo a partir de pacotes do sistema)
- Sistema Operacional Linux (preferencialmente Linux Mint ou Debian/Ubuntu-based para testes de integração com ícones locais)

### Configuração Inicial
```bash
# Clone o repositório
git clone https://github.com/yuri-schmaltz/mint_install_pro.git
cd mint-install-pro

# Instale as dependências
npm install

# Inicie o servidor de desenvolvimento
npm run dev
```
Acesse a aplicação em `http://localhost:3000` (ou porta informada pelo Vite).

---

## 🧪 Bateria de Testes Automatizados

Antes de submeter qualquer alteração, garanta que todos os testes da suíte automatizada passam sem erros:

```bash
# Executa a suíte de testes de integridade e paridade (48 testes)
npm test

# Executa o build de produção
npm run build
```

---

## 📐 Padrões de Código e Convenções

1. **Estilização com Tailwind CSS**:
   - Utilize a paleta oficial Mint-Y Dark definida em `tailwind.config.js`:
     - Verde Mint: `#87cf3e`
     - Cinza-escuro (Janela): `#202326`
     - Cinza-médio (Cards): `#2b2e33` / `#2a2d32`
     - Bordas GTK: `#282b30` / `#383c42`
   - Evite adicionar estilos inline ou CSS solto fora de `src/index.css`.

2. **Convenções de Commits (Conventional Commits)**:
   - `feat:` Nova funcionalidade
   - `fix:` Correção de bug
   - `style:` Alterações de formatação, layout ou CSS
   - `docs:` Documentação
   - `refactor:` Refatoração sem alteração de comportamento
   - `test:` Inclusão ou ajuste de testes

3. **Arquitetura de Componentes**:
   - Mantenha componentes autocontidos dentro de `src/components/`.
   - Propague callbacks de forma explícita (`onSelectCategory`, `onToggleSelect`, etc.).
   - Assegure persistência de estado do usuário sempre via `localStorage` com tratamento de fallbacks.

---

## 🚀 Fluxo de Pull Request

1. Crie uma branch com nome descritivo a partir de `master`:
   ```bash
   git checkout -b feature/minha-melhoria
   ```
2. Realize seus commits seguindo as convenções.
3. Certifique-se de rodar `npm test && npm run build`.
4. Envie sua branch para o seu fork:
   ```bash
   git push origin feature/minha-melhoria
   ```
5. Abra um **Pull Request** detalhando as alterações e anexando capturas de tela quando houver impacto visual.
