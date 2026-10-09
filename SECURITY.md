# Segurança

O Mint Install Pro executa operações reais de APT e Flatpak. Falhas de rede,
HTTP, autenticação ou comando são apresentadas como falha; não há simulação
implícita de sucesso.

## API local

O desenvolvimento, o preview e o pacote `.deb` usam `scripts/package_backend.py`.
O Vite encaminha `/api/*` para uma instância local desse serviço. No pacote,
o launcher GTK usa o mesmo servidor para a API e os arquivos da interface.

- Bind em `127.0.0.1`; validação de IP de loopback e hostname local.
- POST exige `Origin` igual à origem do `Host` e `Content-Type: application/json`.
- Requisições com origem estrangeira, `Origin: null` ou `Sec-Fetch-Site: cross-site`
  são rejeitadas. O servidor não concede acesso CORS.
- Corpo de POST limitado a 8 KiB nas ações individuais e 64 KiB nos lotes
  (até 500 operações), com leitura sob timeout.
- `packageType` explícito (`apt` ou `flatpak`); IDs validados com `fullmatch`.
- Comandos recebem uma lista de argumentos, sem shell, com `--` antes do ID nas
  operações de instalação e remoção.
- Uma transação por instância do servidor, protegida por lock. Operações externas
  ou outras instâncias continuam sujeitas aos locks próprios do APT/Flatpak.
- APT individual usa `pkexec apt-get`. Lotes usam uma única chamada a `pkexec`
  para um auxiliar Python em modo isolado, com o plano completo de APT e remoções
  Flatpak do sistema. O auxiliar revalida o plano antes de executar os comandos
  e encerra ao terminar o lote; não armazena senha nem concede privilégios a
  operações posteriores. Não há alteração das regras de autorização do sistema.
- O lote valida todos os pacotes antes de solicitar autorização. Ações
  administrativas executam primeiro; ações Flatpak do usuário executam depois,
  sem privilégios. Cancelar a autorização interrompe o restante do lote sem
  novas solicitações. Resultados por pacote chegam à interface via NDJSON.
  Falhas individuais não impedem as demais operações; remoções nos dois escopos
  só são consideradas concluídas quando ambos têm sucesso.
- Flatpak instala no escopo do usuário. Remoções consultam e removem os escopos
  de usuário e sistema em que o app estiver instalado.
- A lista de instalados vem do `dpkg-query` e de `flatpak list`; flags do catálogo
  e backups importados não comprovam instalação.

A proteção de origem impede que páginas de outras origens usem a API pelo
navegador. Ela não é uma barreira contra processos já executando como o usuário
local, que podem enviar seus próprios cabeçalhos HTTP.

## Proteção de componentes do sistema

A consulta ao `dpkg-query` identifica pacotes com `Essential: yes`,
`Protected: yes` ou prioridade `required`. A política também protege componentes
críticos do Mint, inicialização, sessão gráfica, gerenciamento de pacotes e
kernel em uso. Kernels antigos não são bloqueados apenas por serem kernels.
A interface mostra o motivo da proteção, desabilita Remover e exclui esses
componentes de Marcar Todos.

O backend não confia em flags enviadas pela interface. Antes de uma remoção APT,
consulta os metadados e simula a remoção com `apt-get --simulate`, bloqueando
planos que também removeriam componentes protegidos por dependência. A checagem
ocorre antes da autorização e novamente no auxiliar autorizado, incluindo antes
de cada remoção do lote. Falhas na consulta ou simulação bloqueiam a remoção.
Instalações APT usam `--no-remove` para impedir que a resolução de conflitos
remova pacotes existentes durante uma instalação.
As regras são específicas de pacotes APT; aplicativos Flatpak continuam seguindo
seus próprios escopos. Esta proteção se aplica às operações do Mint Install Pro,
e não impede transações feitas por outros gerenciadores ou pelo terminal.

## Verificação

`npm run test:backend` testa a API com executor simulado, inclusive origem,
validação, concorrência, falhas e escopos Flatpak. `npm run test:e2e` verifica
os fluxos de interface em desenvolvimento e produção com transações interceptadas.
Nenhum desses testes instala ou remove pacotes reais.

`npm audit --audit-level=moderate` é uma etapa bloqueante do CI. A ausência de
avisos nessa ferramenta não substitui os testes de comportamento.

## Relato de problemas

Não publique detalhes de exploração em uma issue pública. Entre em contato com
[Yuri Schmaltz](https://github.com/yuri-schmaltz), mantenedor do projeto, para
combinar o envio privado de um relato reproduzível.
