# Nacar Distribuição v3.7.2 — Carrinho rápido e orçamento por WhatsApp

## Melhorias

- Adicionar um produto não abre mais o carrinho automaticamente.
- O catálogo permanece na mesma posição para continuar a seleção.
- Uma confirmação discreta informa que o produto foi adicionado.
- O contador do carrinho é atualizado imediatamente.
- Ao adicionar o mesmo produto novamente, a quantidade é somada respeitando o estoque.
- O carrinho abre somente quando o usuário toca ou clica em **Carrinho**.
- Ao solicitar orçamento, o sistema salva o pedido como orçamento, gera um PDF e abre o WhatsApp do vendedor vinculado ao cliente.
- A mensagem inclui cliente, número do orçamento, total estimado e um link assinado para o PDF.
- O PDF pode ser aberto sem login somente com o link assinado; o endereço não expõe a chave privada.
- Caso o vendedor não tenha WhatsApp cadastrado, o orçamento continua salvo e o sistema informa o que precisa ser corrigido.

## Banco de dados

Não há SQL novo para esta versão.

## Atualização

1. Preserve o `.env.local`.
3. Execute `npm run typecheck` e `npm run build`.
4. Teste o catálogo e a solicitação de orçamento.
5. Publique normalmente pelo GitHub e Vercel.
