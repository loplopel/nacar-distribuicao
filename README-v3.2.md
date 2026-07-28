# Nacar Distribuição v3.2 — Pedido Inteligente

## Novidades

- Pedido automático baseado no histórico real de compras.
- Seleção dos produtos recomendados pelo NACS Intelligence.
- Quantidades sugeridas e totalmente editáveis no formato `[ 5 ]`.
- Confiança da recomendação por produto.
- Validação visual do estoque disponível.
- Cálculo do total estimado antes de gerar o pedido.
- Geração do carrinho com empresa, itens, quantidades e observação inteligente preenchidos.
- Revisão final no catálogo antes de salvar rascunho, solicitar orçamento ou enviar pedido.
- Atalho no Perfil 360° da empresa.

## Atualização

Não há SQL novo obrigatório nesta versão.

1. Copie o `.env.local` da v3.1.
2. Execute:

```bash
npm install
npm run typecheck
npm run build
npm run dev
```

3. Abra `Empresas → Ver empresa → Pedido inteligente`.

## Observação

As sugestões usam somente pedidos com status aprovado, separação, faturado, enviado ou finalizado. O vendedor sempre revisa o pedido antes de enviar.
