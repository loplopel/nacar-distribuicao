# Nacar Distribuição v3.4 — Mapa Comercial e Roteiro de Visitas

## Recursos
- Mapa comercial administrativo com OpenStreetMap e filtros.
- Indicadores de cobertura, clientes críticos e coordenadas pendentes.
- Cadastro de endereço completo, latitude, longitude e raio permitido.
- Validação do check-in pela distância até a empresa.
- Roteiro diário do vendedor por prioridade comercial e proximidade.
- Abertura do próximo destino no Google Maps.
- Persistência de roteiros no Supabase.

## Instalação
1. Preserve o `.env.local`.
2. Execute `supabase/upgrade-v3.4.sql` no SQL Editor.
3. Rode `npm install`, `npm run typecheck` e `npm run build`.
4. Teste em localhost e publique com Git/Vercel.

O mapa usa tiles do OpenStreetMap e a biblioteca Leaflet carregada no navegador.
