import { redirect } from 'next/navigation';
import { getCurrentProfile } from '@/lib/supabase-server';

export default async function Home(){
  const profile=await getCurrentProfile();
  if(profile?.role==='admin') redirect('/dashboard');
  if(profile?.role==='vendedor') redirect('/vendedor');
  redirect('/catalogo');
}
