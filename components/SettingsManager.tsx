'use client';
import {useMemo,useState} from 'react';

type Setting={key:string;value:string;label:string|null;group_name:string};
const groups=[['empresa','Empresa'],['contato','Contato'],['aparencia','Aparência'],['integracoes','Integrações']];

export default function SettingsManager({settings}:{settings:Setting[]}){
 const initial=useMemo(()=>Object.fromEntries(settings.map(s=>[s.key,s.value||''])),[settings]);
 const [values,setValues]=useState<Record<string,string>>(initial);
 const [saving,setSaving]=useState(false);const [message,setMessage]=useState('');
 const labels=Object.fromEntries(settings.map(s=>[s.key,s.label||s.key]));
 async function save(){setSaving(true);setMessage('');const res=await fetch('/api/admin/settings',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(values)});const json=await res.json();setSaving(false);setMessage(res.ok?'Configurações salvas com sucesso.':json.error||'Não foi possível salvar.');}
 return <div className="settings-manager">
  {groups.map(([group,title])=><section className="settings-group" key={group}><div className="settings-group-head"><h2>{title}</h2><p>{group==='integracoes'?'Defina a fonte oficial usada na sincronização do catálogo.':'Informações usadas na identificação e comunicação do sistema.'}</p></div><div className="settings-grid">
   {settings.filter(s=>s.group_name===group).map(s=><label className={s.key.includes('address')||s.key.includes('sheet')?'settings-field wide':'settings-field'} key={s.key}><span>{labels[s.key]}</span>{s.key.includes('color')?<div className="color-field"><input type="color" value={values[s.key]||'#000000'} onChange={e=>setValues(v=>({...v,[s.key]:e.target.value}))}/><input value={values[s.key]||''} onChange={e=>setValues(v=>({...v,[s.key]:e.target.value}))}/></div>:<input value={values[s.key]||''} onChange={e=>setValues(v=>({...v,[s.key]:e.target.value}))} placeholder={s.key==='google_sheet_csv_url'?'https://docs.google.com/.../pub?output=csv':''}/>}</label>)}
  </div></section>)}
  <div className="settings-actions"><button className="btn primary" onClick={save} disabled={saving}>{saving?'Salvando...':'Salvar configurações'}</button>{message&&<span className={message.includes('sucesso')?'success-text':'error-text'}>{message}</span>}</div>
 </div>
}
