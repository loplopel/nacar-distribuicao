'use client';
import { useMemo, useState } from 'react';
import { Check, MessageCircle, Phone, CalendarPlus, Send, X } from 'lucide-react';
import { useRouter } from 'next/navigation';

type Template={id:string;name:string;message:string;context:string};
type Props={customerId:string;sellerId:string|null;whatsapp:string|null;phone:string|null;customerName:string;sellerName:string;templates:Template[];lastOrderNumber?:string|null};
function normalizePhone(value:string){const digits=value.replace(/\D/g,'');if(!digits)return'';return digits.startsWith('55')?digits:`55${digits}`}
export default function CrmActions({customerId,sellerId,whatsapp,phone,customerName,sellerName,templates,lastOrderNumber}:Props){
  const router=useRouter(); const [followOpen,setFollowOpen]=useState(false);const[waOpen,setWaOpen]=useState(false); const [loading,setLoading]=useState(false); const [error,setError]=useState('');
  const number=normalizePhone(whatsapp||phone||'');
  const first=templates[0];const[selectedId,setSelectedId]=useState(first?.id||'');
  const selected=useMemo(()=>templates.find(t=>t.id===selectedId)||first,[templates,selectedId,first]);
  const renderMessage=(text:string)=>(text||'').replaceAll('{cliente}',customerName).replaceAll('{vendedor}',sellerName||'Nacar Distribuição').replaceAll('{pedido}',lastOrderNumber?`#${lastOrderNumber}`:'');
  const [custom,setCustom]=useState('');
  const message=custom||renderMessage(selected?.message||`Olá, ${customerName}! Tudo bem? Aqui é da Nacar Distribuição. Posso ajudar com um novo pedido?`);
  async function submit(e:React.FormEvent<HTMLFormElement>){e.preventDefault();setLoading(true);setError('');const form=new FormData(e.currentTarget);const r=await fetch('/api/crm/followups',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({customer_id:customerId,seller_id:sellerId,title:form.get('title'),notes:form.get('notes'),channel:form.get('channel'),due_at:form.get('due_at')})});const j=await r.json();setLoading(false);if(!r.ok){setError(j.error||'Erro ao salvar.');return;}setFollowOpen(false);router.refresh()}
  async function openWhatsApp(){if(!number)return;setLoading(true);await fetch('/api/crm/interactions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({customer_id:customerId,channel:'whatsapp',template_id:selected?.id||null,subject:selected?.name||'Contato comercial',message})});setLoading(false);window.open(`https://wa.me/${number}?text=${encodeURIComponent(message)}`,'_blank','noopener,noreferrer');setWaOpen(false);router.refresh()}
  async function call(){await fetch('/api/crm/interactions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({customer_id:customerId,channel:'telefone',subject:'Ligação comercial'})});window.location.href=`tel:${phone||whatsapp}`}
  return <div className="crm-actions">
    {number&&<button className="crm-icon whatsapp" onClick={()=>{setCustom('');setWaOpen(true)}} title="WhatsApp"><MessageCircle size={17}/></button>}
    {(phone||whatsapp)&&<button className="crm-icon" onClick={call} title="Ligar"><Phone size={17}/></button>}
    <button className="btn btn-light btn-sm" onClick={()=>setFollowOpen(true)}><CalendarPlus size={16}/>Agendar</button>
    {waOpen&&<div className="crm-modal-backdrop" onMouseDown={()=>setWaOpen(false)}><div className="crm-modal wide" onMouseDown={e=>e.stopPropagation()}><button className="modal-close" onClick={()=>setWaOpen(false)}><X size={18}/></button><h3>Enviar WhatsApp</h3><p>{customerName}</p><div className="form"><label>Modelo<select className="input" value={selectedId} onChange={e=>{setSelectedId(e.target.value);setCustom('')}}>{templates.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label><label>Mensagem<textarea className="input" rows={7} value={custom||message} onChange={e=>setCustom(e.target.value)}/></label><small className="form-help">O contato será registrado no histórico comercial ao abrir o WhatsApp.</small><div className="crm-modal-buttons"><button className="btn btn-light" onClick={()=>setWaOpen(false)}>Cancelar</button><button disabled={loading} className="btn btn-primary" onClick={openWhatsApp}><Send size={16}/>{loading?'Registrando...':'Abrir WhatsApp'}</button></div></div></div></div>}
    {followOpen&&<div className="crm-modal-backdrop" onMouseDown={()=>setFollowOpen(false)}><div className="crm-modal" onMouseDown={e=>e.stopPropagation()}><h3>Novo follow-up</h3><p>{customerName}</p><form onSubmit={submit} className="form">
      <label>Assunto<input className="input" name="title" required placeholder="Ex.: Retornar sobre orçamento"/></label>
      <div className="crm-form-grid"><label>Canal<select className="input" name="channel"><option value="whatsapp">WhatsApp</option><option value="telefone">Telefone</option><option value="email">E-mail</option><option value="visita">Visita</option><option value="outro">Outro</option></select></label><label>Data e hora<input className="input" type="datetime-local" name="due_at" required/></label></div>
      <label>Observação<textarea className="input" name="notes" rows={3}/></label>{error&&<div className="error">{error}</div>}<div className="crm-modal-buttons"><button type="button" className="btn btn-light" onClick={()=>setFollowOpen(false)}>Cancelar</button><button disabled={loading} className="btn btn-primary"><Check size={16}/>{loading?'Salvando...':'Salvar'}</button></div>
    </form></div></div>}
  </div>
}

export function CompleteFollowup({id}:{id:string}){const router=useRouter();const[loading,setLoading]=useState(false);async function done(){setLoading(true);await fetch('/api/crm/followups',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,status:'concluido'})});setLoading(false);router.refresh()}return <button disabled={loading} onClick={done} className="crm-complete" title="Concluir"><Check size={15}/>{loading?'...':'Concluir'}</button>}
