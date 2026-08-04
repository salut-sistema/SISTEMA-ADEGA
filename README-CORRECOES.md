# Sistema Adega — versão corrigida

Esta cópia não altera o seu projeto original.

## O que foi corrigido

- Pedido recalculado pelo servidor: o navegador não define preço, total ou taxa.
- Venda bloqueada quando o produto, tamanho, complemento ou estoque-base não têm saldo.
- Criação e edição de pedido executadas em transação do MongoDB Atlas: pedido e estoque são salvos juntos, ou nada é salvo.
- Correção da atualização visual de `estoquesBases` após editar pedido.
- Login por senha com hash bcrypt e sessão JWT temporária; não há senhas de empresas no código.

## Antes de publicar

1. No Render, adicione `JWT_SECRET` (uma frase aleatória com no mínimo 32 caracteres).
2. Gere o hash bcrypt de uma nova senha master e configure `SENHA_MASTER_HASH` no Render. A senha master não fica no GitHub.
3. Rode `npm install` dentro de `adega-backend`.
4. Crie as empresas no MongoDB usando `npm run criar-empresa`. O comentário no início de `criar-empresa.js` mostra exatamente como preencher os dados no PowerShell.
5. Faça o deploy do backend no Render. O frontend da Vercel continua usando a mesma URL de API em `adega-frontend/api.js`.

## Importante

As empresas que estavam em `empresasConfig.js` não são levadas com as senhas antigas, porque isso manteria senhas expostas no código. Recrie-as com o comando acima e entregue uma nova senha a cada cliente.

MongoDB Atlas já usa replica set, portanto suporta transações. Em MongoDB local simples, as transações exigem replica set também.
