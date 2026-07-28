'use client';
import { createClient } from '@/lib/supabase-browser';
export default function LogoutButton({icon}:{icon?:React.ReactNode}){return <button className="logout" title="Sair" onClick={async()=>{await createClient().auth.signOut();location.href='/login'}}>{icon||'Sair'}</button>}
