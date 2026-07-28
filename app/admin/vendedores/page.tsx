import { redirect } from 'next/navigation';
import AppShell from '@/components/AppShell';
import { getCurrentProfile } from '@/lib/supabase-server';
import { adminClient } from '@/lib/supabase-admin';
import UserCreateForm from '@/components/UserCreateForm';
import UserManager from '@/components/UserManager';

export default async function Vendedores(){
  const profile=await getCurrentProfile();
  if(profile?.role!=='admin') redirect('/catalogo');
  const supabase=adminClient();
  const [{data:sellers,error},{data:customers}]=await Promise.all([
    supabase.from('profiles').select('*').eq('role','vendedor').order('name'),
    supabase.from('customers').select('id,name,active').order('name'),
  ]);
  return <AppShell>
    <div className="page-head">
      <div><h1>Vendedores</h1><p>Cadastro, edição, região, contato e situação da equipe comercial.</p></div>
      <span className="count">{sellers?.length||0} vendedores</span>
    </div>
    {error&&<div className="error">Erro ao carregar vendedores: {error.message}</div>}
    <UserCreateForm sellers={sellers||[]} customers={(customers||[]).filter(c=>c.active)} defaultRole="vendedor" lockedRole title="Novo vendedor" description="Crie o acesso comercial e defina a região de atendimento."/>
    <UserManager users={(sellers||[]) as any} sellers={sellers||[]} customers={customers||[]} initialRoleFilter="vendedor" lockRoleFilter/>
  </AppShell>
}
