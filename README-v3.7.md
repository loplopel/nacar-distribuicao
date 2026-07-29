# Nacar Distribuição v3.7 — Importação de Pedidos Históricos

Esta versão importa a **última compra real** disponível no relatório do Celta para cada um dos 263 clientes implantados na v3.6.

## Proteções

- não apaga clientes, vendedores, produtos ou pedidos atuais;
- não altera nem reserva estoque;
- cria somente pedidos com status `finalizado` e identificação histórica;
- usa uma chave única para impedir importação duplicada;
- vincula clientes pelo código ERP;
- vincula produtos pelo PLU;
- quando um PLU antigo não existe, cria um produto histórico inativo com estoque zero;
- o vendedor sempre é vinculado pelo cadastro real ou pela carteira atual do cliente;
- gera simulação antes da execução e relatório final em `output/`.

## Atualização do banco

Execute uma vez no SQL Editor do Supabase:

`supabase/upgrade-v3.7.sql`

## Simulação

```powershell
npm install
npm run import:history
```

A simulação não altera dados. Confira os totais e somente depois execute:

```powershell
npm run import:history -- --execute
```

## Resultado esperado da fonte

- 263 pedidos históricos;
- 1.040 itens históricos;
- uma compra por cliente, correspondente à última compra do relatório;
- pequenas diferenças de centavos podem existir por arredondamento do relatório de origem.

## Observação importante

Essa importação não representa todo o histórico do cliente. Representa apenas a última compra disponível no arquivo fornecido.
