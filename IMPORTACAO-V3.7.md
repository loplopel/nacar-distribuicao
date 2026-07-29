# Implantação segura — v3.7

1. Confirme que a v3.6 está funcionando com 263 clientes e 13 vendedores.
2. Preserve o `.env.local`.
3. Execute `supabase/upgrade-v3.7.sql` no Supabase.
4. Rode `npm run import:history` e envie o resultado da simulação para conferência.
5. Somente após a conferência, rode `npm run import:history -- --execute`.
6. Abra o sistema e valide pedidos históricos de clientes diferentes.
7. Rode `npm run typecheck` e `npm run build` antes do Git.
8. Não envie a pasta `output/` ao GitHub.

O script é idempotente: pedidos já importados são ignorados pela chave `import_key`.
