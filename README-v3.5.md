# Nacar Distribuição v3.5 — Atualização segura da PWA

Esta versão altera somente a camada PWA. Não há atualização de banco de dados no Supabase.

## Melhorias

- cache identificado como v3.5.0 e remoção automática dos caches antigos;
- o novo service worker não assume o controle no meio do trabalho;
- aviso de nova versão com botão **Atualizar agora**;
- proteção básica contra atualização enquanto há campos alterados na tela;
- atualização automática segura quando o aplicativo fica em segundo plano e não há edição pendente;
- verificação de nova versão ao abrir/focar o app e a cada 30 minutos;
- tela offline própria;
- páginas autenticadas, APIs, dados do Supabase e respostas dinâmicas não são armazenados pela PWA;
- arquivos versionados do Next.js podem ser armazenados com segurança;
- correção da política do navegador para permitir geolocalização no próprio domínio.

## Instalação

1. Preserve o arquivo `.env.local` da versão atual.
2. Execute `npm install`.
3. Execute `npm run typecheck` e `npm run build`.
4. Teste localmente com `npm run dev`.
5. Publique com Git normalmente.

Não é necessário executar SQL no Supabase para esta versão.
