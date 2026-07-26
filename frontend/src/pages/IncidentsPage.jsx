import { useEffect, useMemo, useState } from 'react'
import Layout from '../components/Layout'
import { closeIncident, createIncidentTicket, executeIncidentAction, getIncidentAnalysis, getIncidentRunbook, getIncidents, reopenIncident } from '../services/monitoring'

const statusLabels = { OPEN: 'Aberto', RESOLVED: 'Resolvido' }
const sourceLabels = { ZABBIX: 'Zabbix', UNIFI_AP: 'UniFi AP' }
const safetyLabels = { READ_ONLY: 'Seguro/read-only', DOCUMENTATION: 'Documentação' }
function fmtDate(v) { return v ? new Date(v).toLocaleString('pt-BR') : '—' }
function sevColor(s) { return s >= 5 ? 'var(--red)' : s >= 4 ? 'var(--orange)' : s >= 3 ? 'var(--amber)' : 'var(--text-tertiary)' }
function ageText(v) {
  if (!v) return '—'
  const mins = Math.max(0, Math.round((Date.now() - new Date(v).getTime()) / 60000))
  if (mins < 60) return `${mins}min`
  const h = Math.floor(mins / 60)
  if (h < 48) return `${h}h`
  return `${Math.floor(h / 24)}d`
}

export default function IncidentsPage() {
  const [payload, setPayload] = useState(null)
  const [filters, setFilters] = useState({ status: 'OPEN', sourceType: 'ALL', host: '', withTicket: '', minSeverity: '', recurrent: false })
  const [selected, setSelected] = useState(null)
  const [detail, setDetail] = useState(null)
  const [analysis, setAnalysis] = useState(null)
  const [runbook, setRunbook] = useState(null)
  const [actionResult, setActionResult] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [actionBusy, setActionBusy] = useState('')
  const [notice, setNotice] = useState('')

  async function load() {
    setLoading(true)
    try {
      const params = {
        status: filters.status,
        sourceType: filters.sourceType === 'ALL' ? undefined : filters.sourceType,
        host: filters.host || undefined,
        withTicket: filters.withTicket === '' ? undefined : filters.withTicket === 'true',
        minSeverity: filters.minSeverity || undefined,
        recurrent: filters.recurrent || undefined,
      }
      const res = await getIncidents(params)
      setPayload(res.data)
      if (selected) {
        const found = res.data.incidents?.find(i => i.id === selected.id)
        if (found) setSelected(found)
      }
    } catch (e) { setNotice('Falha ao carregar incidentes.') }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const incidents = payload?.incidents ?? []
  const kpis = useMemo(() => [
    ['Abertos', payload?.openCount ?? 0, 'var(--amber)'],
    ['Críticos', payload?.criticalCount ?? 0, 'var(--red)'],
    ['Recorrentes', payload?.recurrentCount ?? 0, 'var(--orange)'],
    ['Com GLPI', payload?.withTicketCount ?? 0, 'var(--accent-text)'],
    ['Sem GLPI', payload?.withoutTicketCount ?? 0, 'var(--text-secondary)'],
  ], [payload])

  async function selectIncident(item) {
    setSelected(item); setDetail(null); setAnalysis(null); setRunbook(null); setActionResult(null); setNotice('')
    try {
      const res = await getIncidentRunbook(item.id)
      setRunbook(res.data)
    } catch { setNotice('Falha ao carregar runbook do incidente.') }
  }

  async function analyze(item) {
    setSelected(item); setAnalysis(null); setNotice('')
    try {
      const res = await getIncidentAnalysis(item.id)
      setAnalysis(res.data.analysis)
    } catch { setNotice('Falha ao gerar análise.') }
  }
  async function runAction(item, actionKey) {
    setActionBusy(actionKey); setNotice('')
    try {
      const res = await executeIncidentAction(item.id, actionKey)
      setActionResult(res.data)
      const rb = await getIncidentRunbook(item.id)
      setRunbook(rb.data)
    } catch { setNotice('Falha ao executar ação guiada.') }
    finally { setActionBusy('') }
  }

  async function ticket(item) {
    setBusy(true)
    try {
      const res = await createIncidentTicket(item.id, 'Criado pela Central de Incidentes NexusIT')
      setNotice(res.data.created ? `GLPI #${res.data.ticketId} criado.` : `GLPI #${res.data.ticketId} reutilizado.`)
      await load()
    } catch { setNotice('Falha ao criar/reusar GLPI.') }
    finally { setBusy(false) }
  }
  async function changeStatus(item, close) {
    setBusy(true)
    try {
      if (close) await closeIncident(item.id, 'Resolvido manualmente pela Central de Incidentes')
      else await reopenIncident(item.id, 'Reaberto manualmente pela Central de Incidentes')
      setNotice(close ? 'Incidente resolvido.' : 'Incidente reaberto.')
      await load()
    } catch { setNotice('Falha ao atualizar status do incidente.') }
    finally { setBusy(false) }
  }

  return <Layout><div className="page">
    <div className="page-header"><div className="page-header-left"><h1>Central de Incidentes</h1><p>Incidentes correlacionados Zabbix/UniFi com anti-duplicidade GLPI e análise operacional</p></div><button className="btn btn-secondary" onClick={load} disabled={loading}>{loading ? 'Atualizando...' : 'Atualizar'}</button></div>
    {notice && <div className="card" style={{ padding: 12, marginBottom: 14, borderColor: notice.includes('Falha') ? 'var(--red)' : 'var(--green)' }}>{notice}</div>}
    <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))', gap:12, marginBottom:16 }}>{kpis.map(([l,v,c]) => <div key={l} className="stat-card"><div className="stat-value" style={{ color:c }}>{v}</div><div className="stat-label">{l}</div></div>)}</div>
    <div className="card" style={{ padding: 14, marginBottom: 16 }}>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))', gap:10, alignItems:'end' }}>
        <label><span className="label-caps">Status</span><select className="input" value={filters.status} onChange={e=>setFilters({...filters,status:e.target.value})}><option value="OPEN">Abertos</option><option value="RESOLVED">Resolvidos</option><option value="ALL">Todos</option></select></label>
        <label><span className="label-caps">Origem</span><select className="input" value={filters.sourceType} onChange={e=>setFilters({...filters,sourceType:e.target.value})}><option value="ALL">Todas</option><option value="ZABBIX">Zabbix</option><option value="UNIFI_AP">UniFi AP</option></select></label>
        <label><span className="label-caps">GLPI</span><select className="input" value={filters.withTicket} onChange={e=>setFilters({...filters,withTicket:e.target.value})}><option value="">Todos</option><option value="true">Com GLPI</option><option value="false">Sem GLPI</option></select></label>
        <label><span className="label-caps">Severidade mín.</span><select className="input" value={filters.minSeverity} onChange={e=>setFilters({...filters,minSeverity:e.target.value})}><option value="">Todas</option><option value="3">Média+</option><option value="4">Alta+</option><option value="5">Crítica</option></select></label>
        <label><span className="label-caps">Host/AP</span><input className="input" value={filters.host} onChange={e=>setFilters({...filters,host:e.target.value})} placeholder="Buscar..." /></label>
        <label style={{ display:'flex', gap:8, alignItems:'center', fontSize:13 }}><input type="checkbox" checked={filters.recurrent} onChange={e=>setFilters({...filters,recurrent:e.target.checked})}/> Só recorrentes</label>
        <button className="btn btn-primary" onClick={load}>Filtrar</button>
      </div>
    </div>
    <div style={{ display:'grid', gridTemplateColumns:'minmax(0,1.2fr) minmax(320px,.8fr)', gap:16 }}>
      <div className="card" style={{ overflow:'hidden' }}>
        {incidents.length === 0 ? <div className="empty-state"><h3>Nenhum incidente encontrado</h3><p>Ajuste os filtros ou aguarde nova coleta.</p></div> : incidents.map(item => <button key={item.id} onClick={()=>selectIncident(item)} style={{ width:'100%', textAlign:'left', padding:14, border:0, borderBottom:'1px solid var(--border)', background:selected?.id===item.id?'var(--bg-muted)':'transparent', cursor:'pointer' }}>
          <div style={{ display:'flex', justifyContent:'space-between', gap:10 }}><strong style={{ color:'var(--text-primary)' }}>{item.title}</strong><span style={{ color:sevColor(item.severity), fontWeight:800 }}>S{item.severity}</span></div>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginTop:8, fontSize:12, color:'var(--text-tertiary)' }}><span>{sourceLabels[item.sourceType] ?? item.sourceType}</span><span>{statusLabels[item.status] ?? item.status}</span><span>{item.occurrenceCount} ocorr.</span><span>idade {ageText(item.firstSeenAt)}</span>{item.openGlpiTicketId && <span>GLPI #{item.openGlpiTicketId}</span>}</div>
          <p style={{ marginTop:8, fontSize:12.5, color:'var(--text-secondary)' }}>{item.summary}</p>
        </button>)}
      </div>
      <div className="card" style={{ padding:16, alignSelf:'start' }}>
        {!selected ? <div className="empty-state"><h3>Selecione um incidente</h3><p>Veja análise, próximas ações e GLPI relacionado.</p></div> : <>
          <div style={{ display:'flex', justifyContent:'space-between', gap:10 }}><div><h3>{selected.title}</h3><p style={{ color:'var(--text-tertiary)', fontSize:12 }}>{selected.affectedHost} · {fmtDate(selected.lastSeenAt)}</p></div><span className="badge" style={{ color: sevColor(selected.severity) }}>S{selected.severity}</span></div>
          <p style={{ marginTop:12, color:'var(--text-secondary)' }}>{selected.recommendation}</p>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginTop:14 }}>
            <button className="btn btn-primary" onClick={()=>analyze(selected)}>Analisar</button>
            <button className="btn btn-secondary" onClick={()=>ticket(selected)} disabled={busy}>{selected.openGlpiTicketId ? 'Reusar GLPI' : 'Criar GLPI'}</button>
            {selected.status === 'OPEN' ? <button className="btn btn-secondary" onClick={()=>changeStatus(selected,true)} disabled={busy}>Resolver</button> : <button className="btn btn-secondary" onClick={()=>changeStatus(selected,false)} disabled={busy}>Reabrir</button>}
          </div>
          {analysis && <div style={{ marginTop:14, padding:12, border:'1px solid rgba(59,130,246,.35)', borderRadius:12, whiteSpace:'pre-wrap', fontSize:13, color:'var(--text-secondary)' }}>{analysis}</div>}
          <div style={{ marginTop:18, paddingTop:16, borderTop:'1px solid var(--border)' }}>
            <h4>Diagnóstico guiado</h4>
            {!runbook ? <p style={{ color:'var(--text-tertiary)', fontSize:13, marginTop:8 }}>Carregando runbook...</p> : <>
              <p style={{ color:'var(--text-secondary)', fontSize:13, marginTop:8 }}>{runbook.recommendedAction}</p>
              <p style={{ color:'var(--text-tertiary)', fontSize:12, marginTop:6 }}>{runbook.impact}</p>
              <div style={{ display:'grid', gap:10, marginTop:12 }}>
                {runbook.steps?.map(step => <div key={step.actionKey} style={{ padding:12, border:'1px solid var(--border)', borderRadius:12, background:'rgba(15,23,42,.22)' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', gap:8 }}><strong>{step.title}</strong><span style={{ color: step.safetyLevel === 'READ_ONLY' ? 'var(--green)' : 'var(--amber)', fontSize:12 }}>{safetyLabels[step.safetyLevel] ?? step.safetyLevel}</span></div>
                  <p style={{ color:'var(--text-secondary)', fontSize:12.5, marginTop:6 }}>{step.description}</p>
                  <p style={{ color:'var(--text-tertiary)', fontSize:12, marginTop:4 }}>Saída esperada: {step.expectedOutput}</p>
                  {step.executable && <button className="btn btn-secondary" style={{ marginTop:8 }} onClick={()=>runAction(selected, step.actionKey)} disabled={!!actionBusy}>{actionBusy===step.actionKey?'Executando...':'Executar ação'}</button>}
                </div>)}
              </div>
              {actionResult && <div style={{ marginTop:14, padding:12, border:'1px solid rgba(34,197,94,.35)', borderRadius:12, whiteSpace:'pre-wrap', fontSize:13 }}>
                <strong>{actionResult.title}</strong> · {actionResult.status} · {actionResult.durationMs ?? 0}ms
                <p style={{ color:'var(--text-secondary)', marginTop:6 }}>{actionResult.summary}</p>
                <pre style={{ whiteSpace:'pre-wrap', marginTop:8, color:'var(--text-tertiary)' }}>{actionResult.output}</pre>
              </div>}
              {runbook.recentResults?.length > 0 && <div style={{ marginTop:14 }}><h4>Últimas ações</h4>{runbook.recentResults.slice(0,4).map(r => <div key={r.id} style={{ padding:'8px 0', borderBottom:'1px solid var(--border)', fontSize:12.5 }}><strong>{r.title}</strong> · {r.status}<div style={{ color:'var(--text-tertiary)' }}>{r.summary}</div></div>)}</div>}
            </>}
          </div>
        </>}
      </div>
    </div>
  </div></Layout>
}
