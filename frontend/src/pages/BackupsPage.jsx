import { useEffect, useState } from 'react'
import Layout from '../components/Layout'
import { getBackupRuns, getBackupSummary } from '../services/backups'

function fmtDate(v) { return v ? new Date(v).toLocaleString('pt-BR') : '—' }
function fmtBytes(v) { if (v == null) return '—'; if (v >= 1e9) return (v/1e9).toFixed(1)+' GB'; if (v >= 1e6) return (v/1e6).toFixed(1)+' MB'; return Math.round(v/1024)+' KB' }
const labels = { OK:'OK', FAILED:'Falhou', STALE:'Atrasado', NO_RUN:'Sem execução', DISABLED:'Desabilitado' }
function color(s){ return s==='OK'?'var(--green)':s==='FAILED'?'var(--red)':s==='STALE'?'var(--orange)':s==='NO_RUN'?'var(--amber)':'var(--text-tertiary)' }

export default function BackupsPage(){
  const [summary,setSummary]=useState(null), [selected,setSelected]=useState(null), [runs,setRuns]=useState([]), [loading,setLoading]=useState(true), [notice,setNotice]=useState('')
  async function load(){ setLoading(true); try{ const r=await getBackupSummary(); setSummary(r.data); if(selected){ const found=r.data.jobs?.find(j=>j.id===selected.id); if(found) setSelected(found) } }catch{ setNotice('Falha ao carregar backups.') } finally{ setLoading(false) } }
  useEffect(()=>{ load() },[])
  async function select(job){ setSelected(job); setRuns([]); try{ const r=await getBackupRuns(job.id); setRuns(r.data) }catch{ setNotice('Falha ao carregar histórico do backup.') } }
  const jobs=summary?.jobs??[]
  return <Layout><div className="page">
    <div className="page-header"><div className="page-header-left"><h1>Backups</h1><p>Inventário e saúde das rotinas de backup críticas</p></div><button className="btn btn-secondary" onClick={load} disabled={loading}>{loading?'Atualizando...':'Atualizar'}</button></div>
    {notice&&<div className="card" style={{padding:12,marginBottom:14,borderColor:'var(--red)'}}>{notice}</div>}
    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))',gap:12,marginBottom:16}}>{[
      ['Rotinas',summary?.totalJobs??0,'var(--accent-text)'],['OK',summary?.okCount??0,'var(--green)'],['Falhas',summary?.failedCount??0,'var(--red)'],['Atrasados',summary?.staleCount??0,'var(--orange)'],['Sem execução',summary?.noRunCount??0,'var(--amber)']
    ].map(([l,v,c])=><div key={l} className="stat-card"><div className="stat-value" style={{color:c}}>{v}</div><div className="stat-label">{l}</div></div>)}</div>
    <div style={{display:'grid',gridTemplateColumns:'minmax(0,1fr) minmax(330px,.8fr)',gap:16}}>
      <div className="card" style={{overflow:'hidden'}}>{jobs.length===0?<div className="empty-state"><h3>Nenhuma rotina cadastrada</h3><p>Cadastre ou importe rotinas de backup.</p></div>:jobs.map(j=><button key={j.id} onClick={()=>select(j)} style={{width:'100%',textAlign:'left',padding:14,border:0,borderBottom:'1px solid var(--border)',background:selected?.id===j.id?'var(--bg-muted)':'transparent',cursor:'pointer'}}>
        <div style={{display:'flex',justifyContent:'space-between',gap:10}}><strong>{j.name}</strong><span style={{color:color(j.healthStatus),fontWeight:800}}>{labels[j.healthStatus]??j.healthStatus}</span></div>
        <div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:8,fontSize:12,color:'var(--text-tertiary)'}}><span>{j.systemName}</span><span>{j.sourceType}</span><span>{j.scheduleLabel||'Sem agenda'}</span><span>janela {j.staleAfterMinutes}min</span></div>
        <p style={{marginTop:8,fontSize:12.5,color:'var(--text-secondary)'}}>{j.recommendation}</p>
      </button>)}</div>
      <div className="card" style={{padding:16,alignSelf:'start'}}>{!selected?<div className="empty-state"><h3>Selecione um backup</h3><p>Veja última execução, destino e histórico.</p></div>:<>
        <div style={{display:'flex',justifyContent:'space-between',gap:10}}><div><h3>{selected.name}</h3><p style={{fontSize:12,color:'var(--text-tertiary)'}}>{selected.sourceRef} → {selected.targetRef}</p></div><span style={{color:color(selected.healthStatus),fontWeight:800}}>{labels[selected.healthStatus]}</span></div>
        <div style={{display:'grid',gap:8,marginTop:14,fontSize:13}}><p><strong>Última execução:</strong> {fmtDate(selected.lastRun?.finishedAt)}</p><p><strong>Status:</strong> {selected.lastRun?.status??'—'}</p><p><strong>Tamanho:</strong> {fmtBytes(selected.lastRun?.sizeBytes)}</p><p><strong>Mensagem:</strong> {selected.lastRun?.message??selected.recommendation}</p></div>
        <h4 style={{marginTop:18}}>Histórico recente</h4>
        <div style={{display:'grid',gap:8,marginTop:10}}>{runs.length===0?<p style={{color:'var(--text-tertiary)',fontSize:13}}>Nenhuma execução registrada ainda.</p>:runs.map(r=><div key={r.id} style={{padding:'9px 0',borderBottom:'1px solid var(--border)',fontSize:13}}><strong style={{color:r.status==='SUCCESS'?'var(--green)':'var(--red)'}}>{r.status}</strong> · {fmtDate(r.finishedAt)} · {fmtBytes(r.sizeBytes)}<div style={{color:'var(--text-tertiary)'}}>{r.message||r.artifactRef||'—'}</div></div>)}</div>
      </>}</div>
    </div>
  </div></Layout>
}
