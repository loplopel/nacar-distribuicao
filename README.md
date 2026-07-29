# Nacar Distribuição B2B — v2.9.4 Final de Produção

Sistema B2B do Grupo Nacar para catálogo, pedidos, empresas, vendedores, CRM, metas, relatórios, WhatsApp, configurações e auditoria.

## Executar localmente

```powershell
npm install
npm run dev
```

Abra `http://localhost:3000`.

## Validar antes do deploy

```powershell
npm run typecheck
npm run build
```

## Banco

Esta versão utiliza o mesmo banco já atualizado até a v2.9.3.1. **Não há SQL novo obrigatório.**

## Produção

Consulte [PRODUCAO.md](./PRODUCAO.md) para GitHub, Vercel, variáveis, Supabase Auth, segurança e instalação PWA.

## v3.6 — Base comercial real
Consulte `README-v3.6.md` e `IMPLANTACAO-V3.6.md`. A implantação possui simulação, validação do Admin Rodrigo, backup automático e geração de credenciais temporárias.
