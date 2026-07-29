# Nacar Distribuição v3.6 — Implantação da Base Comercial Real

Esta versão prepara e executa a troca segura da base de testes pela base comercial real.

## O que é preservado
- Admin Rodrigo, identificado pelo e-mail configurado em `PRESERVE_ADMIN_EMAIL` ou `ADMIN_EMAIL`;
- produtos, marcas, catálogo e estoque;
- configurações do sistema;
- modelos de WhatsApp;
- estrutura, recursos e regras do aplicativo.

## O que é removido
- clientes de teste;
- usuários e vendedores de teste, exceto o Admin Rodrigo;
- pedidos, propostas, visitas, fotos, CRM, metas, roteiros, auditoria e sincronizações de teste.

## O que é criado
- 13 vendedores reais encontrados na base;
- 263 clientes reais tratados;
- vínculo de cada cliente ao vendedor de origem;
- códigos do ERP e informações da última compra;
- backup completo antes da limpeza;
- relatório final e arquivo de credenciais temporárias dos vendedores.

## Segurança obrigatória
1. Faça backup do Supabase pelo painel antes da execução.
2. Confira no `.env.local`:

```env
PRESERVE_ADMIN_EMAIL="rodrigo.franco@nacar.com.br"
```

3. Execute `supabase/upgrade-v3.6.sql` no SQL Editor.
4. Rode primeiro a simulação:

```powershell
npm run implant:real
```

A simulação não altera dados e precisa mostrar o Admin Rodrigo correto.

5. Somente depois execute:

```powershell
npm run implant:real -- --execute
```

## Saídas geradas
A pasta `output/implantacao-v3.6-...` conterá:
- `backup-antes-da-implantacao.json`;
- `credenciais-vendedores.csv`;
- `relatorio-final.json`.

As senhas dos vendedores são temporárias e devem ser entregues individualmente. Recomenda-se alterá-las no primeiro acesso.

## Observação importante
Os e-mails de acesso dos vendedores são gerados no padrão `vendedor.nome@nacar.com.br`, pois a base de clientes não informa os e-mails pessoais dos vendedores. Esses e-mails podem ser editados posteriormente no painel administrativo.
