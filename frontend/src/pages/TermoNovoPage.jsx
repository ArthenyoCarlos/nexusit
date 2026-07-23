import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'
import { createTermo } from '../services/termos'
import { getAllInventory } from '../services/inventory'

const EMPTY = { responsavelNome:'', cpf:'', cargo:'', setor:'', dataEntrega:new Date().toISOString().slice(0,10), tipoEquipamento:'Notebook', marca:'', modelo:'', numeroSerie:'', tombamento:'', condicaoInicial:'', observacoes:'', acessorios:['Carregador'] }

export default function TermoNovoPage() {
  const nav = useNavigate(); const [form,setForm]=useState(EMPTY); const [inventory,setInventory]=useState([]); const [saving,setSaving]=useState(false)
  useEffect(()=>{ getAllInventory().then(setInventory).catch(()=>{}) }, [])
  const set = (k,v)=>setForm(f=>({...f,[k]:v}))
  const submit = async e => { e.preventDefault(); setSaving(true); try { const t=await createTermo({...form, acessorios: form.acessorios.filter(Boolean)}); nav(`/termos/${t.id}`) } finally { setSaving(false) } }
  const pickInventory = id => { const item=inventory.find(i=>i.id===id); if(!item) return; setForm(f=>({...f, tombamento:item.tombamento||'', tipoEquipamento:item.type||f.tipoEquipamento, marca:item.brand||'', modelo:item.model||'', numeroSerie:item.serialNumber||''})) }
  return <Layout><div className="page fade-up"><div className="page-header"><div className="page-header-left"><h1>Novo Termo</h1><p>Cadastro de responsabilidade de equipamento</p></div></div>
    <form onSubmit={submit} className="card" style={{display:'flex',flexDirection:'column',gap:18}}>
      <Section title="Vincular inventário"><select className="input" onChange={e=>pickInventory(e.target.value)} defaultValue=""><option value="">Selecionar por tombamento GAL-YYYY-NNN...</option>{inventory.filter(i=>i.tombamento).map(i=><option key={i.id} value={i.id}>{i.tombamento} — {i.name} {i.brand} {i.model}</option>)}</select></Section>
      <Section title="Responsável"><Grid><Input label="Nome *" value={form.responsavelNome} onChange={v=>set('responsavelNome',v)} required/><Input label="CPF" value={form.cpf} onChange={v=>set('cpf',v)}/><Input label="Cargo" value={form.cargo} onChange={v=>set('cargo',v)}/><Input label="Setor" value={form.setor} onChange={v=>set('setor',v)}/><Input type="date" label="Data entrega" value={form.dataEntrega} onChange={v=>set('dataEntrega',v)}/></Grid></Section>
      <Section title="Equipamento"><Grid><Input label="Tipo *" value={form.tipoEquipamento} onChange={v=>set('tipoEquipamento',v)} required/><Input label="Marca" value={form.marca} onChange={v=>set('marca',v)}/><Input label="Modelo" value={form.modelo} onChange={v=>set('modelo',v)}/><Input label="Número série" value={form.numeroSerie} onChange={v=>set('numeroSerie',v)}/><Input label="Tombamento" value={form.tombamento} onChange={v=>set('tombamento',v)} placeholder="GAL-2026-001 (vazio gera automático)"/></Grid></Section>
      <Section title="Condição, acessórios e observações"><label className="input-label">Condição inicial</label><textarea className="input" rows={3} value={form.condicaoInicial} onChange={e=>set('condicaoInicial',e.target.value)} /><label className="input-label">Acessórios (um por linha)</label><textarea className="input" rows={3} value={form.acessorios.join('\n')} onChange={e=>set('acessorios',e.target.value.split('\n'))}/><label className="input-label">Observações</label><textarea className="input" rows={3} value={form.observacoes} onChange={e=>set('observacoes',e.target.value)} /></Section>
      <div style={{display:'flex',justifyContent:'flex-end',gap:8}}><button type="button" className="btn btn-default" onClick={()=>nav('/termos')}>Cancelar</button><button className="btn btn-primary" disabled={saving}>{saving?'Salvando...':'Salvar termo'}</button></div>
    </form></div></Layout>
}
function Section({title,children}){return <section><h2 style={{fontSize:13,fontWeight:800,color:'var(--text-primary)',marginBottom:10}}>{title}</h2>{children}</section>}
function Grid({children}){return <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:10}}>{children}</div>}
function Input({label,value,onChange,type='text',...props}){return <div><label className="input-label">{label}</label><input className="input" type={type} value={value||''} onChange={e=>onChange(e.target.value)} {...props}/></div>}
