# Nacar Distribuição v3.7.1 — Dashboards: operação e histórico

## Ajustes
- A Visão Geral mostra somente pedidos operacionais criados pelo aplicativo.
- A base histórica aparece em um bloco separado, com quantidade e faturamento.
- Pedidos históricos não entram nas etapas operacionais.
- O Dashboard Gerencial ganhou os filtros: Operação atual, Histórico importado e Consolidado.
- Os indicadores e rankings respeitam a visualização selecionada.
- Não há alteração de banco de dados nesta versão.

## Atualização
1. Preserve o `.env.local`.
2. Execute `npm install`, `npm run typecheck` e `npm run build`.
3. Teste em localhost.
4. Publique normalmente via Git/Vercel.
