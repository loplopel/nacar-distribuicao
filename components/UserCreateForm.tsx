'use client';
import { useState } from 'react';

type Option={id:string,name:string};

export default function UserCreateForm({
  sellers,
  customers,
  defaultRole='cliente',
  lockedRole=false,
  title='Novo usuário',
  description='Crie o acesso e faça o vínculo comercial necessário.',
}:{
  sellers:Option[];
  customers:Option[];
  defaultRole?:'admin'|'vendedor'|'cliente';
  lockedRole?:boolean;
  title?:string;
  description?:string;
}){
  const[msg,setMsg]=useState('');
  const[loading,setLoading]=useState(false);
  const[role,setRole]=useState(defaultRole);

  async function submit(e:React.FormEvent<HTMLFormElement>){
    e.preventDefault();setLoading(true);setMsg('');
    const f=new FormData(e.currentTarget);
    if(lockedRole) f.set('role',defaultRole);
    const r=await fetch('/api/admin/users',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(Object.fromEntries(f.entries()))});
    const j=await r.json();
    setMsg(r.ok?'Usuário criado com sucesso.':j.error||'Erro ao criar usuário.');
    setLoading(false);
    if(r.ok){e.currentTarget.reset();setRole(defaultRole);setTimeout(()=>location.reload(),600)}
  }

  return <form className="card form" onSubmit={submit}>
    <div className="card-title"><div><h2>{title}</h2><p>{description}</p></div></div>
    {msg&&<div className={msg.includes('sucesso')?'success':'error'}>{msg}</div>}
    <div className="form-grid">
      <label>Nome<input className="input" name="name" required/></label>
      <label>E-mail<input className="input" name="email" type="email" required/></label>
      <label>Senha inicial<input className="input" name="password" type="password" minLength={6} required/></label>
      {!lockedRole&&<label>Perfil<select className="input" name="role" value={role} onChange={e=>setRole(e.target.value as typeof role)}><option value="cliente">Cliente</option><option value="vendedor">Vendedor</option><option value="admin">Admin</option></select></label>}
      {lockedRole&&<input type="hidden" name="role" value={defaultRole}/>} 
      <label>Cargo<input className="input" name="job_title" placeholder={role==='vendedor'?'Ex.: Consultor comercial':'Ex.: Comprador'}/></label>
      <label>Região<input className="input" name="region" placeholder="Ex.: Capital, Interior, Sul"/></label>
      <label>Telefone<input className="input" name="phone"/></label>
      <label>WhatsApp<input className="input" name="whatsapp"/></label>
      {role==='cliente'&&<>
        <label>Empresa vinculada<select className="input" name="customer_id"><option value="">Selecione</option>{customers.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
        <label>Vendedor responsável<select className="input" name="seller_id"><option value="">Não vinculado</option>{sellers.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
      </>}
    </div>
    <button className="btn btn-primary" disabled={loading}>{loading?'Criando...':role==='vendedor'?'Cadastrar vendedor':'Criar usuário'}</button>
  </form>
}
