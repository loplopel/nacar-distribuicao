import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentProfile } from '@/lib/supabase-server';
import { adminClient } from '@/lib/supabase-admin';

const schema=z.object({
 name:z.string().min(2).optional(),legal_name:z.string().nullable().optional(),cnpj:z.string().nullable().optional(),city:z.string().nullable().optional(),state:z.string().nullable().optional(),phone:z.string().nullable().optional(),whatsapp:z.string().nullable().optional(),email:z.union([z.string().email(),z.literal(''),z.null()]).optional(),seller_id:z.string().uuid().nullable().optional(),payment_terms:z.string().nullable().optional(),credit_limit:z.coerce.number().min(0).optional(),region:z.string().nullable().optional(),notes:z.string().nullable().optional(),active:z.boolean().optional()
});
export async function PATCH(req:Request,{params}:{params:Promise<{id:string}>}){
 const p=await getCurrentProfile();if(p?.role!=='admin')return NextResponse.json({error:'Acesso negado'},{status:403});
 const{id}=await params;const parsed=schema.safeParse(await req.json());if(!parsed.success)return NextResponse.json({error:'Revise os dados informados.'},{status:400});
 const data={...parsed.data,email:parsed.data.email||null,updated_at:new Date().toISOString()};
 const{error}=await adminClient().from('customers').update(data).eq('id',id);if(error)return NextResponse.json({error:error.message},{status:400});return NextResponse.json({ok:true});
}


export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const current = await getCurrentProfile();
  if (current?.role !== 'admin') return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
  const { id } = await params;
  const supabase = adminClient();

  const [{ count: usersCount }, { count: ordersCount }] = await Promise.all([
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('customer_id', id),
    supabase.from('orders').select('id', { count: 'exact', head: true }).eq('customer_id', id),
  ]);

  if ((usersCount || 0) > 0) return NextResponse.json({ error: 'A empresa possui compradores vinculados. Remova ou transfira os usuários antes de excluir.' }, { status: 400 });
  if ((ordersCount || 0) > 0) return NextResponse.json({ error: 'A empresa possui histórico de pedidos e não pode ser excluída. Use Inativar.' }, { status: 400 });

  const { error } = await supabase.from('customers').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
