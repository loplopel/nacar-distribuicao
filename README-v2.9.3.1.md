# Nacar Distribuição v2.9.3.1

Correção da auditoria e restauração de uma tela de configurações mais completa.

## Atualização obrigatória no Supabase
Execute uma única vez:

`supabase/upgrade-v2.9.3.1.sql`

O script não apaga produtos, usuários, empresas ou pedidos.

## Principais correções
- adiciona `actor_email`, `actor_name` e `actor_role` à auditoria;
- recria os triggers de auditoria de forma compatível;
- inclui as configurações na auditoria;
- melhora a tela de Configurações com identidade, catálogo, segurança e backup;
- exibe erros reais na tela de Auditoria.
