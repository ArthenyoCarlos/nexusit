import { useEffect, useState } from 'react'
import Layout from '../components/Layout'
import { SkeletonLine } from '../components/Skeleton'
import { getTermoTemplate, updateTermoTemplate } from '../services/termos'

export default function TermoTemplatePage(){
 const [form,setForm]=useState(null); const [saved,setSaved]=useState(false); const [saving,setSaving]=useState(false)
 useEffect(()=>{getTermoTemplate().then(setForm)},[])
 const set=(k,v)=>{setSaved(false);setForm(f=>({...f,[k]:v}))}
 const submit=async e=>{e.preventDefault();setSaving(true);try{setForm(await updateTermoTemplate(form));setSaved(true)}finally{setSaving(false)}}
 if(!form) return <Layout><div className="page" style={{display:'flex',flexDirection:'column',gap:12}}><SkeletonLine className="h-6 w-1/3"/><SkeletonLine className="h-64 w-full"/></div></Layout>
 return <Layout><div className="page fade-up"><div className="page-header"><div className="page-header-left"><h1>Template do Termo</h1><p>Cláusulas, texto padrão e posição da logo</p></div></div>
  <form onSubmit={submit} className="card" style={{display:'flex',flexDirection:'column',gap:12}}>
   {saved&&<div className="alert alert-green">Template salvo.</div>}
   <div><label className="input-label">Nome</label><input className="input" value={form.nome||''} onChange={e=>set('nome',e.target.value)}/></div>
   <div><label className="input-label">Logo da empresa</label><input className="input" value={form.logoUrl||''} onChange={e=>set('logoUrl',e.target.value)} placeholder="URL https://... ou data:image/png;base64,..."/><p style={{fontSize:12,color:'var(--text-tertiary)',marginTop:4}}>Campo reservado para logo no topo do PDF. Pode ser URL ou base64.</p></div>
   <div><label className="input-label">Posição da logo</label><select className="input" value={form.logoPosition||'TOPO_CENTRO'} onChange={e=>set('logoPosition',e.target.value)}><option>TOPO_ESQUERDA</option><option>TOPO_CENTRO</option><option>TOPO_DIREITA</option></select></div>
   <div><label className="input-label">Cláusulas padrão</label><textarea className="input" rows={18} value={form.clausulas||''} onChange={e=>set('clausulas',e.target.value)} style={{fontFamily:'monospace',lineHeight:1.5}}/></div>
   <div style={{display:'flex',justifyContent:'flex-end'}}><button className="btn btn-primary" disabled={saving}>{saving?'Salvando...':'Salvar template'}</button></div>
  </form></div></Layout>
}
