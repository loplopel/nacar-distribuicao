# Nacar Distribuição v3.3.1 — Validação de GPS Mobile

## Novidades
- Explicação antes da solicitação nativa de GPS.
- GPS obrigatório no início e no término da visita.
- Nova tentativa quando o GPS falhar.
- Exceção para continuar sem GPS somente com motivo registrado.
- Mensagens diferentes para permissão negada, GPS indisponível e tempo esgotado.
- Precisão do GPS no check-in e check-out.
- Distância entre o ponto inicial e final no relatório administrativo.
- Justificativas sem GPS visíveis no relatório e na exportação CSV.
- Sem rastreamento contínuo: localização somente ao iniciar e concluir a visita.

## Instalação
1. Execute `supabase/upgrade-v3.3.1.sql` no SQL Editor do Supabase.
2. Preserve o seu `.env.local`.
3. Execute `npm install`.
4. Execute `npm run dev` e teste no celular.
5. Após validar, faça commit e push para a branch `main`.

## Teste obrigatório
- Permitir GPS e iniciar uma visita.
- Concluir a visita com GPS.
- Bloquear o GPS e confirmar que o app exige motivo para continuar.
- Conferir check-in, check-out, precisão, distância e justificativa em Admin > Visitas e GPS.
