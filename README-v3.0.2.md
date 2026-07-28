# Nacar Distribuição v3.0.2 — Visitas, GPS e Fotos

## Novidades

- Início e encerramento de visita comercial.
- Captura da localização GPS no início e no fim.
- Resultado, observações, próxima ação e próxima data de contato.
- Observação comercial rápida sem visita completa.
- Envio de fotos pela câmera do celular ou arquivos do computador.
- Galeria privada por empresa no Supabase Storage.
- Fotos podem ser vinculadas à visita em andamento.
- Histórico de visitas e link para abrir a posição no Google Maps.
- Visitas incluídas na timeline comercial do Perfil 360°.
- Admin acessa todas as empresas; vendedor apenas a própria carteira.

## Instalação

1. Execute `supabase/upgrade-v3.0.2.sql` uma única vez.
2. Copie o `.env.local` da versão anterior.
3. Execute:

```powershell
npm install
npm run typecheck
npm run build
npm run dev
```

## Permissão de localização

No celular ou computador, o navegador perguntará se pode acessar a localização. A visita também pode ser registrada sem GPS caso o usuário negue a permissão.

## Fotos

- Bucket privado: `customer-photos`.
- Tamanho máximo: 10 MB.
- Formatos: JPEG, PNG, WEBP, HEIC e HEIF.
