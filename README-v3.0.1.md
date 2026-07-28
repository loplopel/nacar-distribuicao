# Nacar Distribuição v3.0.1 — Perfil 360° da Empresa

## Novidades
- Score comercial de 0 a 100 com justificativas.
- Tendência de compra dos últimos 90 dias contra os 90 dias anteriores.
- Oportunidades recomendadas por regras comerciais.
- Marcas favoritas e produtos mais comprados.
- Timeline unificada de pedidos, contatos e follow-ups.
- Perfil disponível para Admin e vendedor, respeitando a carteira do vendedor.

## Atualização
1. Copie o `.env.local` da versão anterior.
2. Execute `supabase/upgrade-v3.0.1.sql` uma vez.
3. Rode `npm install`, `npm run typecheck`, `npm run build` e `npm run dev`.
4. Abra uma empresa pela lista de Empresas ou CRM.

## Observação
As recomendações desta versão são calculadas por regras objetivas e histórico real. O módulo com modelo de IA será implementado depois que os dados de visitas, propostas e fotos estiverem disponíveis.
