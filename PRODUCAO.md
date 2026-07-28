# Publicação em produção — Nacar Distribuição B2B v2.9.4

## 1. Segurança antes de publicar

1. Gere uma nova chave secreta no Supabase, porque a chave antiga apareceu em imagens durante os testes.
2. Troque a senha inicial do administrador.
3. Confirme que `.env.local` não será enviado ao GitHub.
4. No Supabase Auth, configure a URL oficial do sistema e a URL de redirecionamento de recuperação de senha.

## 2. Variáveis na Vercel

Cadastre em **Settings → Environment Variables**:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_APP_URL` — use a URL final, sem barra no final
- `GOOGLE_SHEET_CSV_URL`
- `ADMIN_EMAIL`

A senha inicial do administrador não precisa ficar na Vercel após o usuário estar criado.

## 3. GitHub

```powershell
git init
git add .
git commit -m "Nacar Distribuição B2B v2.9.4"
git branch -M main
git remote add origin URL_DO_REPOSITORIO
git push -u origin main
```

## 4. Vercel

1. Importe o repositório.
2. Framework: Next.js.
3. Cadastre as variáveis.
4. Faça o deploy.
5. Teste `/api/health`; deve retornar `status: ok`.

## 5. Supabase Auth

Em **Authentication → URL Configuration**:

- Site URL: URL da Vercel ou domínio final.
- Redirect URLs: adicione `https://SEU-DOMINIO/**`.

## 6. PWA

No Chrome/Edge, abra o sistema publicado e use **Instalar aplicativo**. O service worker só é registrado em produção.

## 7. Checklist funcional

- Login Admin, Vendedor e Cliente.
- Recuperação de senha por e-mail.
- Sincronização do Google Sheets.
- Catálogo e imagens.
- Carrinho, rascunho, orçamento e pedido.
- Alteração de status e timeline.
- Empresas, compradores e vendedores.
- CRM, follow-ups e WhatsApp.
- Metas gerais e por produto.
- Dashboard gerencial.
- Relatórios, configurações e auditoria.
- Instalação PWA no celular.
