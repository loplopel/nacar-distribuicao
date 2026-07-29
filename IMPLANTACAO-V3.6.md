# Procedimento operacional — v3.6

## 1. Antes de começar
- confirme que a v3.5.2 está funcionando;
- faça um backup do banco no Supabase;
- não execute durante o uso do sistema;
- preserve o `.env.local`.

## 2. Preparar banco
No Supabase > SQL Editor, execute `supabase/upgrade-v3.6.sql`.

## 3. Conferir o administrador preservado
No `.env.local`, adicione ou confira:

```env
PRESERVE_ADMIN_EMAIL="rodrigo.franco@nacar.com.br"
```

O script aborta automaticamente se esse e-mail não existir no Supabase Auth ou não tiver perfil `admin`.

## 4. Simular

```powershell
npm install
npm run implant:real
```

Confira:
- administrador preservado;
- usuários a excluir;
- 13 vendedores a criar;
- 263 clientes a importar;
- 1 cliente sem vendedor informado na origem.

## 5. Executar

```powershell
npm run implant:real -- --execute
```

Não feche o terminal durante o processo.

## 6. Conferir os arquivos gerados
Abra a nova pasta dentro de `output` e guarde em local seguro:
- backup;
- credenciais dos vendedores;
- relatório final.

## 7. Testes após a implantação
- login do Admin Rodrigo;
- listagem dos vendedores;
- total de clientes;
- carteira de cada vendedor;
- busca por cliente;
- criação de pedido;
- CRM e Perfil 360°;
- mapa e roteiro;
- login de um vendedor com a senha temporária.

## 8. Publicação
A importação atua no Supabase e pode ser executada antes do deploy. Para publicar a v3.6:

```powershell
git add .
git commit -m "Nacar Distribuicao v3.6 base comercial real"
git push origin main
```
