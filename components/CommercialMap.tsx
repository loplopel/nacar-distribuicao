'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Building2, MapPin } from 'lucide-react';

declare global { interface Window { L?: any } }

type Point={id:string;name:string;city?:string|null;state?:string|null;latitude:number|string|null;longitude:number|string|null;seller_name?:string|null;status_label:string;status_color:string;last_visit?:string|null;days_without_visit?:number|null;priority_reason?:string|null;href:string};

export default function CommercialMap({points}:{points:Point[]}){
 const ref=useRef<HTMLDivElement>(null); const mapRef=useRef<any>(null); const [selected,setSelected]=useState<Point|null>(null);
 const valid=useMemo(()=>points.filter(p=>p.latitude!==null&&p.longitude!==null&&Number.isFinite(Number(p.latitude))&&Number.isFinite(Number(p.longitude))),[points]);
 useEffect(()=>{
  let cancelled=false;
  async function load(){
   if(!document.querySelector('link[data-leaflet]')){const link=document.createElement('link');link.rel='stylesheet';link.href='https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';link.dataset.leaflet='1';document.head.appendChild(link)}
   if(!window.L){await new Promise<void>((resolve,reject)=>{const existing=document.querySelector('script[data-leaflet]') as HTMLScriptElement|null;if(existing){existing.addEventListener('load',()=>resolve(),{once:true});return;}const s=document.createElement('script');s.src='https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';s.dataset.leaflet='1';s.onload=()=>resolve();s.onerror=()=>reject(new Error('Não foi possível carregar o mapa.'));document.body.appendChild(s);});}
   if(cancelled||!ref.current||!window.L||mapRef.current)return; const L=window.L; const center=valid.length?[Number(valid[0].latitude),Number(valid[0].longitude)]:[-23.5505,-46.6333];
   const map=L.map(ref.current,{zoomControl:true}).setView(center,valid.length?9:5); mapRef.current=map;
   L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap'}).addTo(map);
   const bounds:any[]=[]; valid.forEach(p=>{const lat=Number(p.latitude),lng=Number(p.longitude);bounds.push([lat,lng]);const marker=L.circleMarker([lat,lng],{radius:9,color:p.status_color,fillColor:p.status_color,fillOpacity:.85,weight:2}).addTo(map);marker.bindTooltip(p.name);marker.on('click',()=>setSelected(p));});
   if(bounds.length>1)map.fitBounds(bounds,{padding:[30,30],maxZoom:13}); setTimeout(()=>map.invalidateSize(),100);
  }
  load().catch(()=>{}); return()=>{cancelled=true;if(mapRef.current){mapRef.current.remove();mapRef.current=null;}};
 },[valid]);
 return <div className="commercial-map-layout"><div className="commercial-map" ref={ref}/><aside className="commercial-map-detail">{selected?<><span className="map-status" style={{borderColor:selected.status_color,color:selected.status_color}}>{selected.status_label}</span><h3>{selected.name}</h3><p><MapPin size={16}/>{[selected.city,selected.state].filter(Boolean).join(' / ')||'Endereço não informado'}</p><p><Building2 size={16}/>{selected.seller_name||'Sem vendedor vinculado'}</p>{selected.last_visit&&<small>Última visita: {new Date(selected.last_visit).toLocaleDateString('pt-BR')}</small>}{selected.priority_reason&&<div className="map-priority-reason">{selected.priority_reason}</div>}<a className="btn btn-primary" href={selected.href}>Ver empresa</a><a className="btn btn-light" target="_blank" rel="noreferrer" href={`https://www.google.com/maps?q=${selected.latitude},${selected.longitude}`}>Abrir no Google Maps</a></>:<div className="map-empty"><MapPin size={30}/><b>Selecione uma empresa</b><span>Clique em um ponto do mapa para ver os detalhes.</span></div>}</aside></div>
}
