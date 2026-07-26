import { useEffect, useState } from 'react'
import Layout from '../components/Layout'
import { enqueueBackupNow, enqueueRestoreTestNow, getBackupRequests, getBackupRestoreTests, getBackupRuns, getBackupSummary } from '../services/backups'

function fmtDate(v) { return v ? new Date(v).toLocaleString('pt-BR') : '—' }
function fmtBytes(v) { if (v == null) return '—'; if (v >= 1e9) return (v/1e9).toFixed(1)+' GB'; if (v >= 1e6) return (v/1e6).toFixed(1)+' MB'; return Math.round(v/1024)+' KB' }
function fmtAge(mins){ if(mins == null || mins < 0) return '—'; if(mins < 60) return `${mins}min`; const h=Math.floor(mins/60); return h < 48 ? `${h}h` : `${Math.floor(h/24)}d` }
const labels = { OK:'OK', FAILED:'Falhou', STALE:'Atrasado', NO_RUN:'Sem backup', DISABLED:'Desabilitado', RESTORE_OK:'Restore OK', RESTORE_FAILED:'Restore falhou', RESTORE_STALE:'Restore velho', NO_RESTORE:'Sem restore' }
const reqLabels = { QUEUED:'Na fila', RUNNING:'Executando', SUCCESS:'Concluído', FAILED:'Falhou', BACKUP:'Backup', RESTORE_TEST:'Restore' }
function color(s){ return ['OK','RESTORE_OK','SUCCESS'].includes(s)?'var(--green)':['FAILED','RESTORE_FAILED'].includes(s)?'var(--red)':['STALE','RESTORE_STALE'].includes(s)?'var(--orange)':['NO_RUN','NO_RESTORE','QUEUED','RUNNING'].includes(s)?'var(--amber)':'var(--text-tertiary)' }

export default function BackupsPage(){
  const [summary,setSummary]=useState(null), [selected,setSelected]=useState(null), [runs,setRuns]=useState([]), [restoreTests,setRestoreTests]=useState([]), [requests,setRequests]=useState([]), [loading,setLoading]=useState(true), [busy,setBusy]=useState(''), [notice,setNotice]=useState('')
  async function load(){ setLoading(true); try{ const r=await getBackupSummary(); setSummary(r.data); if(selected){ const found=r.data.jobs?.find(j=>j.id===selected.id); if(found) setSelected(found) } }catch{ setNotice('Falha ao carregar backups.') } finally{ setLoading(false) } }
  useEffect(()=>{ load() },[])
  async function select(job){ setSelected(job); setRuns([]); setRestoreTests([]); setRequests([]); try{ const [runRes,restoreRes,reqRes]=await Promise.all([getBackupRuns(job.id), getBackupRestoreTests(job.id), getBackupRequests(job.id)]); setRuns(runRes.data); setRestoreTests(restoreRes.data); setRequests(reqRes.data) }catch{ setNotice('Falha ao carregar histórico do backup.') } }
  async function enqueue(job, type){ setBusy(type); setNotice(''); try{ const res = type === 'backup' ? await enqueueBackupNow(job.id) : await enqueueRestoreTestNow(job.id); setNotice(`${type==='backup'?'Backup':'Teste de restauração'} enfileirado. Status: ${reqLabels[res.data.status] || res.data.status}. O executor processa automaticamente.`); await load(); await select(job) }catch{ setNotice('Falha ao enfileirar ação.') } finally{ setBusy('') } }
  const jobs=summary?.jobs??[]
  return <Layout><div className="page">
    <div className="page-header"><div className="page-header-left"><h1>Backups</h1><p>Backup + teste de restauração: recuperação comprovada, não só arquivo gerado</p></div><button className="btn btn-secondary" onClick={load} disabled={loading}>{loading?'Atualizando...':'Atualizar'}</button></div>
    {notice&&<div className="card" style={{padding:12,marginBottom:14,borderColor:notice.includes('Falha')?'var(--red)':'var(--green)'}}>{notice}</div>}
    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(145px,1fr))',gap:12,marginBottom:16}}>{[
      ['Rotinas',summary?.totalJobs??0,'var(--accent-text)'],['Backup OK',summary?.okCount??0,'var(--green)'],['Falhas',summary?.failedCount??0,'var(--red)'],['Atrasados',summary?.staleCount??0,'var(--orange)'],['Restore OK',summary?.restoreOkCount??0,'var(--green)'],['Restore pend.',summary?.restoreProblemCount??0,'var(--amber)'],['Fila',summary?.queuedRequestCount??0,'var(--accent-text)']
    ].map(([l,v,c])=><div key={l} className="stat-card"><div className="stat-value" style={{color:c}}>{v}</div><div className="stat-label">{l}</div></div>)}</div>
    <div style={{display:'grid',gridTemplateColumns:'minmax(0,1fr) minmax(360px,.85fr)',gap:16}}>
      <div className="card" style={{overflow:'hidden'}}>{jobs.length===0?<div className="empty-state"><h3>Nenhuma rotina cadastrada</h3><p>Cadastre ou importe rotinas de backup.</p></div>:jobs.map(j=><button key={j.id} onClick={()=>select(j)} style={{width:'100%',textAlign:'left',padding:14,border:0,borderBottom:'1px solid var(--border)',background:selected?.id===j.id?'var(--bg-muted)':'transparent',cursor:'pointer'}}>
        <div style={{display:'flex',justifyContent:'space-between',gap:10}}><strong>{j.name}</strong><span style={{color:color(j.healthStatus),fontWeight:800}}>{labels[j.healthStatus]??j.healthStatus}</span></div>
        <div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:8,fontSize:12,color:'var(--text-tertiary)'}}><span>{j.systemName}</span><span>{j.sourceType}</span><span>backup {fmtAge(j.ageMinutes)}</span><span style={{color:color(j.restoreStatus)}}>{labels[j.restoreStatus]??j.restoreStatus}</span>{j.lastRequest&&['QUEUED','RUNNING'].includes(j.lastRequest.status)&&<span style={{color:'var(--amber)'}}>fila: {reqLabels[j.lastRequest.action]}</span>}</div>
        <p style={{marginTop:8,fontSize:12.5,color:'var(--text-secondary)'}}>{j.recommendation}</p>
      </button>)}</div>
      <div className="card" style={{padding:16,alignSelf:'start'}}>{!selected?<div className="empty-state"><h3>Selecione um backup</h3><p>Veja última execução, restauração e fila de ações.</p></div>:<>
        <div style={{display:'flex',justifyContent:'space-between',gap:10}}><div><h3>{selected.name}</h3><p style={{fontSize:12,color:'var(--text-tertiary)'}}>{selected.sourceRef} → {selected.targetRef}</p></div><span style={{color:color(selected.healthStatus),fontWeight:800}}>{labels[selected.healthStatus]}</span></div>
        <div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:14}}><button className="btn btn-primary" onClick={()=>enqueue(selected,'backup')} disabled={!!busy}>{busy==='backup'?'Enfileirando...':'Executar backup agora'}</button><button className="btn btn-secondary" onClick={()=>enqueue(selected,'restore')} disabled={!!busy || !selected.lastRun}>{busy==='restore'?'Enfileirando...':'Testar restauração'}</button></div>
        <div style={{display:'grid',gap:8,marginTop:14,fontSize:13}}><p><strong>Último backup:</strong> {fmtDate(selected.lastRun?.finishedAt)} · {selected.lastRun?.status??'—'} · {fmtBytes(selected.lastRun?.sizeBytes)}</p><p><strong>Último restore:</strong> {fmtDate(selected.lastRestoreTest?.testedAt)} · {selected.lastRestoreTest?.status??'—'}</p><p><strong>Mensagem:</strong> {selected.lastRestoreTest?.message || selected.lastRun?.message || selected.recommendation}</p></div>
        <h4 style={{marginTop:18}}>Fila recente</h4>
        <div style={{display:'grid',gap:8,marginTop:10}}>{requests.length===0?<p style={{color:'var(--text-tertiary)',fontSize:13}}>Nenhuma ação sob demanda recente.</p>:requests.slice(0,5).map(r=><div key={r.id} style={{padding:'8px 0',borderBottom:'1px solid var(--border)',fontSize:13}}><strong style={{color:color(r.status)}}>{reqLabels[r.action]||r.action}</strong> · {reqLabels[r.status]||r.status} · {fmtDate(r.requestedAt)}<div style={{color:'var(--text-tertiary)'}}>{r.resultMessage||r.requestedBy||'—'}</div></div>)}</div>
        <h4 style={{marginTop:18}}>Testes de restauração</h4>
        <div style={{display:'grid',gap:8,marginTop:10}}>{restoreTests.length===0?<p style={{color:'var(--text-tertiary)',fontSize:13}}>Nenhum teste de restauração registrado.</p>:restoreTests.slice(0,6).map(t=><div key={t.id} style={{padding:'8px 0',borderBottom:'1px solid var(--border)',fontSize:13}}><strong style={{color:color(t.status)}}>{t.status}</strong> · {fmtDate(t.testedAt)} · {t.durationSeconds??0}s<div style={{color:'var(--text-tertiary)'}}>{t.message||t.testedArtifactRef||'—'}</div></div>)}</div>
        <h4 style={{marginTop:18}}>Histórico de backups</h4>
        <div style={{display:'grid',gap:8,marginTop:10}}>{runs.length===0?<p style={{color:'var(--text-tertiary)',fontSize:13}}>Nenhuma execução registrada ainda.</p>:runs.slice(0,6).map(r=><div key={r.id} style={{padding:'8px 0',borderBottom:'1px solid var(--border)',fontSize:13}}><strong style={{color:r.status==='SUCCESS'?'var(--green)':'var(--red)'}}>{r.status}</strong> · {fmtDate(r.finishedAt)} · {fmtBytes(r.sizeBytes)}<div style={{color:'var(--text-tertiary)'}}>{r.message||r.artifactRef||'—'}</div></div>)}</div>
      </>}</div>
    </div>
  </div></Layout>
}
