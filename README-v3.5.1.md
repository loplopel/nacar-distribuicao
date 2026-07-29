# Nacar Distribuição v3.5.1 — Interface Mobile Responsiva

Esta versão corrige a navegação e a adaptação do sistema para celulares em modo vertical, preservando todas as regras comerciais, banco de dados, GPS, mapa, rotas e a atualização segura da PWA.

## Melhorias

- menu mobile acessível pelo botão no cabeçalho;
- gaveta lateral com fechamento por botão, toque fora, troca de página e tecla Esc;
- identificação do usuário e opção de sair dentro do menu;
- bloqueio da rolagem da página enquanto o menu está aberto;
- correção do deslocamento horizontal da aplicação;
- cards, filtros, formulários, mapas, rotas e dashboards adaptados à largura do celular;
- tabelas com rolagem apenas dentro da própria área;
- ações e botões reorganizados para toque;
- catálogo adaptado para uma ou duas colunas conforme a largura;
- cache da PWA atualizado para v3.5.1.

## Atualização

1. Preserve o arquivo `.env.local`.
2. Execute `npm install`.
3. Execute `npm run typecheck` e `npm run build`.
4. Teste com `npm run dev`.
5. Publique pelo GitHub; a Vercel fará o deploy automático.

Não há SQL novo para executar no Supabase.
