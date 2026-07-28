import { redirect } from 'next/navigation';
import AppShell from '@/components/AppShell';
import WhatsAppTemplateManager from '@/components/WhatsAppTemplateManager';
import { getCurrentProfile } from '@/lib/supabase-server';
import { adminClient } from '@/lib/supabase-admin';

export const dynamic='force-dynamic';
export default async function WhatsAppAdminPage(){
 const profile=await getCurrentProfile();if(profile?.role!=='admin')redirect('/catalogo');
 const {data}=await adminClient().from('whatsapp_templates').select('id,name,message,context,active').order('context').order('name');
 return <AppShell><div className="dashboard-hero"><div><span className="eyebrow">CONFIGURAÇÕES COMERCIAIS</span><h1>WhatsApp</h1><p>Padronize mensagens da equipe e agilize os contatos com clientes.</p></div></div><section className="card"><WhatsAppTemplateManager templates={(data||[]) as any}/></section></AppShell>
}
