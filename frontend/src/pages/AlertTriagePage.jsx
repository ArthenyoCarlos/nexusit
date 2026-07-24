import { useCallback, useEffect, useState } from 'react'
import Layout from '../components/Layout'
import { createAlertTicket, decideAlert, getAlertTriage, getIncidentAnalysis, updateAlertRuleEnabled } from '../services/monitoring'

const ACTION_LABELS = {
  SHOW_ONLY: 'Mostrar na triagem',
  CREATE_TICKET_IMMEDIATELY: 'Criar chamado imediatamente',
  CREATE_TICKET_AFTER_DELAY: 'Criar após persistência',
  CREATE_TICKET_ON_RECURRENCE: 'Criar por recorrência',
  IGNORE: 'Descartado',
  SILENCE_TEMPORARILY: 'Silenciado temporariamente',
}

function fmtAge(seconds) {
  if (!seconds) return 'agora'
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (d) return `${d}d ${h}h`
  if (h) return `${h}h ${m}m`
  return `${m}m`
}
function fmtClock(epoch) {
  return epoch ? new Date(epoch * 1000).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'
}
function severityClass(sev) {
  if (sev >= 5) return 'badge-red'
  if (sev >= 4) return 'badge-orange'
  if (sev >= 3) return 'badge-amber'
  return 'badge-blue'
}
function actionClass(action) {
  if (action === 'IGNORE') return 'badge-gray'
  if (action === 'SILENCE_TEMPORARILY') return 'badge-purple'
  if (action === 'CREATE_TICKET_IMMEDIATELY') return 'badge-red'
  return 'badge-blue'
}

export default function AlertTriagePage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(null)
  const [msg, setMsg] = useState(null)
  const [showSuppressed, setShowSuppressed] = useState(true)
  const [reason, setReason] = useState('')
  const [analysis, setAnalysis] = useState(null)

  const load = useCallback(async () => {
    try {
      const res = await getAlertTriage(showSuppressed)
      setData(res.data)
    } finally {
      setLoading(false)
    }
  }, [showSuppressed])

  useEffect(() => {
    load()
    const t = setInterval(load, 60_000)
    return () => clearInterval(t)
  }, [load])

  async function run(label, fn) {
    setBusy(label); setMsg(null)
    try {
      const out = await fn()
      setMsg({ ok: true, text: out || 'Ação concluída.' })
      await load()
    } catch (err) {
      setMsg({ ok: false, text: err?.response?.data?.message || err?.message || 'Falha ao executar ação.' })
    } finally { setBusy(null) }
  }

  const items = data?.items ?? []
  const rules = data?.rules ?? []

  return (
    <Layout>
      <div className="page">
        <div className="page-header">
          <div className="page-header-left">
            <h1>Triagem de Alertas</h1>
            <p>Decida o que vira chamado GLPI, o que fica em observação e o que deve ser descartado.</p>
          </div>
          <button className="btn btn-secondary" onClick={load} disabled={loading || !!busy}>Atualizar</button>
        </div>

        {msg && <div className={`card ${msg.ok ? '' : 'danger'}`} style={{ padding: 12, marginBottom: 16, borderColor: msg.ok ? 'var(--green)' : 'var(--red)' }}>{msg.text}</div>}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(170px,1fr))', gap: 12, marginBottom: 18 }}>
          {[
            ['Alertas visíveis', data?.activeCount ?? 0, 'var(--accent-text)'],
            ['Acionáveis', data?.actionableCount ?? 0, 'var(--red)'],
            ['Triagem', data?.showOnlyCount ?? 0, 'var(--blue)'],
            ['Descartados', data?.ignoredCount ?? 0, 'var(--text-tertiary)'],
            ['Silenciados', data?.silencedCount ?? 0, 'var(--purple)'],
            ['Alta severidade', data?.highSeverityCount ?? 0, 'var(--amber)'],
          ].map(([label, value, color]) => (
            <div key={label} className="stat-card">
              <div className="stat-value" style={{ color }}>{value}</div>
              <div className="stat-label">{label}</div>
            </div>
          ))}
        </div>

        <div className="card" style={{ padding: 14, marginBottom: 18 }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
            <div>
              <h3 style={{ fontSize: 14, color: 'var(--text-primary)' }}>Política inicial</h3>
              <p style={{ fontSize: 12.5, color: 'var(--text-tertiary)', marginTop: 3 }}>Alta/Desastre ficam acionáveis; Warning/Average aparecem aqui para decisão antes de virar GLPI.</p>
            </div>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12.5, color: 'var(--text-secondary)' }}>
              <input type="checkbox" checked={showSuppressed} onChange={e => setShowSuppressed(e.target.checked)} />
              Mostrar descartados/silenciados
            </label>
          </div>
          <div style={{ marginTop: 12 }}>
            <label className="input-label">Motivo padrão para descartar/silenciar</label>
            <input className="input" value={reason} onChange={e => setReason(e.target.value)} placeholder="Ex.: túnel antigo não usado, queda curta esperada, manutenção..." />
          </div>
        </div>

        {analysis && (
          <div className="card" style={{ padding: 14, marginBottom: 18, borderColor: 'rgba(59,130,246,.35)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'start' }}>
              <div>
                <p className="label-caps">Análise com Hermes</p>
                <h3 style={{ color: 'var(--text-primary)', fontSize: 14, marginTop: 4 }}>{analysis.title}</h3>
              </div>
              <button className="btn btn-secondary" onClick={() => setAnalysis(null)}>Fechar</button>
            </div>
            <pre style={{ whiteSpace: 'pre-wrap', color: 'var(--text-secondary)', fontSize: 12.5, marginTop: 10, lineHeight: 1.45 }}>{analysis.text}</pre>
          </div>
        )}

        <section style={{ marginBottom: 26 }}>
          <p className="label-caps" style={{ marginBottom: 10 }}>Alertas ativos do Zabbix</p>
          {loading ? <div className="skeleton" style={{ height: 160 }} /> : items.length === 0 ? (
            <div className="card empty-state"><h3>Nenhum alerta para triagem</h3><p>Ou todos estão recuperados/silenciados conforme filtro.</p></div>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {items.map(item => (
                <div key={item.eventId} className="card" style={{ padding: 14, borderLeft: item.ticketEligible ? '4px solid var(--red)' : '4px solid var(--accent)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                    <div style={{ minWidth: 220, flex: 1 }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 6 }}>
                        <span className={`badge ${severityClass(item.severity)}`}>{item.severityLabel}</span>
                        <span className={`badge ${actionClass(item.action)}`}>{item.actionLabel || ACTION_LABELS[item.action]}</span>
                        <span className="badge badge-gray">{fmtAge(item.ageSeconds)}</span>
                      </div>
                      <h3 style={{ fontSize: 15, color: 'var(--text-primary)', marginBottom: 4 }}>{item.hostName}</h3>
                      <p style={{ fontSize: 13.2, color: 'var(--text-secondary)' }}>{item.alertName}</p>
                      <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 7 }}>Detectado: {fmtClock(item.clock)} · Event ID: {item.eventId}</p>
                      <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 5 }}>Incidente: {item.incidentId ? item.incidentId.slice(0, 8) : '—'} · Ocorrências: {item.occurrenceCount ?? 1} {item.glpiTicketId ? `· GLPI #${item.glpiTicketId}` : ''}</p>
                      {item.ruleReason && <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 5 }}>Motivo: {item.ruleReason}</p>}
                      <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 8 }}>{item.recommendation}</p>
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                      <button className="btn btn-primary" disabled={!!busy} onClick={() => run(`ticket-${item.eventId}`, async () => {
                        const res = await createAlertTicket(item.eventId)
                        return `${res.data.created ? 'Chamado GLPI criado' : 'Chamado já existia'} #${res.data.ticketId} para ${item.hostName}.`
                      })}>{item.glpiTicketId ? `GLPI #${item.glpiTicketId}` : 'Criar GLPI'}</button>
                      <button className="btn btn-secondary" disabled={!!busy || !item.incidentId} onClick={() => run(`analysis-${item.eventId}`, async () => {
                        const res = await getIncidentAnalysis(item.incidentId)
                        setAnalysis({ title: `${item.hostName}: ${item.alertName}`, text: res.data.analysis })
                        return 'Análise gerada abaixo.'
                      })}>Analisar</button>
                      <button className="btn btn-secondary" disabled={!!busy} onClick={() => run(`silence-${item.eventId}`, async () => {
                        await decideAlert({ eventId: item.eventId, action: 'SILENCE_TEMPORARILY', reason: reason || 'Silenciado pela triagem NexusIT' })
                        return 'Alerta silenciado por 24h.'
                      })}>Silenciar 24h</button>
                      <button className="btn btn-secondary" disabled={!!busy} onClick={() => run(`ignore-${item.eventId}`, async () => {
                        await decideAlert({ eventId: item.eventId, action: 'IGNORE', reason: reason || 'Descartado pela triagem NexusIT' })
                        return 'Alerta descartado por regra.'
                      })}>Descartar</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section>
          <p className="label-caps" style={{ marginBottom: 10 }}>Regras salvas</p>
          {rules.length === 0 ? <div className="card empty-state"><h3>Sem regras salvas</h3><p>Use os botões dos alertas para silenciar/descartar ou criar política.</p></div> : (
            <div className="card" style={{ overflow: 'hidden' }}>
              {rules.map((r, idx) => (
                <div key={r.id} style={{ padding: 13, borderTop: idx ? '1px solid var(--border)' : 'none', display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: 10, alignItems: 'center' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <span className={`badge ${actionClass(r.action)}`}>{r.actionLabel}</span>
                      {!r.enabled && <span className="badge badge-gray">inativa</span>}
                    </div>
                    <p style={{ fontSize: 13, color: 'var(--text-primary)', marginTop: 5, overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.hostPattern || '*'} — {r.alertPattern || '*'}</p>
                    <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 3 }}>{r.reason || 'Sem motivo informado'}</p>
                  </div>
                  <button className="btn btn-secondary" disabled={!!busy} onClick={() => run(`rule-${r.id}`, async () => {
                    await updateAlertRuleEnabled(r.id, !r.enabled)
                    return r.enabled ? 'Regra desativada.' : 'Regra reativada.'
                  })}>{r.enabled ? 'Desativar' : 'Reativar'}</button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </Layout>
  )
}
