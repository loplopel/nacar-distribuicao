# Nacar Distribuição v3.3 — Gestão de Visitas e Geolocalização

## Novidades
- Relatório administrativo de visitas em `/admin/visitas`.
- Filtros por período, vendedor, status, GPS, resultado e busca textual.
- Indicadores de visitas, conclusão, GPS, duração média, visitas ativas e conversão.
- Resultado padronizado no encerramento da visita.
- Vínculo opcional com pedido ou proposta.
- Abertura do check-in no Google Maps.
- Exportação CSV compatível com Excel.

## Banco de dados
Execute `supabase/upgrade-v3.3.sql` uma única vez no SQL Editor do Supabase antes de publicar.

## Publicação
Após executar o SQL: `npm run check`, `git add .`, `git commit -m "Nacar Distribuicao v3.3 gestao de visitas"` e `git push origin main`. A Vercel fará o deploy automaticamente.
