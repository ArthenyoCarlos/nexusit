import { useEffect, useRef, useState } from 'react'
import Layout from '../components/Layout'
import { getTsSessions } from '../services/monitoring'
import { collectionHealth, createSessionPoller, filterSessions, formatDisconnectedDuration, formatTsDate, paginateHistory, sessionCompliance, windowsEventLabel } from '../utils/tsSessions'
import './TsSessionsPage.css'

const complianceLabels = { ACTIVE: 'Ativa', EXEMPT: 'Isenta · administrador', WITHIN_LIMIT: 'Dentro do limite / tolerância', OVERDUE: 'Prazo excedido', UNKNOWN: 'Desconhecida' }
const complianceColors = { ACTIVE: 'blue', EXEMPT: 'purple', WITHIN_LIMIT: 'green', OVERDUE: 'red', UNKNOWN: 'amber' }
const stateLabels = { ACTIVE: 'Ativa', DISCONNECTED: 'Desconectada' }
const explanation = {
  ACTIVE: 'Sessão conectada: o limite de desconexão não se aplica.',
  EXEMPT: 'Administrador confirmado: sessão isenta da regra observada.',
  WITHIN_LIMIT: 'Não administrador confirmado, ainda dentro de 30 minutos + 2 minutos de tolerância.',
  OVERDUE: 'Não administrador confirmado, desconectado além do limite e da tolerância. Verifique a política efetiva no Windows.',
  UNKNOWN: 'Sem evidência suficiente: estado, tempo real de desconexão ou associação administrativa não confirmados.',
}

export default function TsSessionsPage() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(true)
  const [query, setQuery] = useState('')
  const [state, setState] = useState('')
  const [historyQuery, setHistoryQuery] = useState('')
  const [historyPage, setHistoryPage] = useState(1)
  const [historySize, setHistorySize] = useState(() => {
    try { const value = Number(localStorage.getItem('nexusit.ts.historyPageSize')); return [10, 25, 50, 100].includes(value) ? value : 10 } catch { return 10 }
  })
  const [now, setNow] = useState(Date.now())
  const pollerRef = useRef(null)

  useEffect(() => {
    const poller = createSessionPoller({
      load: getTsSessions,
      onData: snapshot => { setData(snapshot); setError(''); setNow(Date.now()) },
      onError: () => { setError('Não foi possível consultar as sessões TS. Os dados anteriores, se houver, foram preservados e não confirmam a situação atual.'); setNow(Date.now()) },
      onBusy: setBusy,
    })
    pollerRef.current = poller
    poller.refresh()
    const clock = setInterval(() => setNow(Date.now()), 10000)
    return () => { poller.stop(); pollerRef.current = null; clearInterval(clock) }
  }, [])

  const health = collectionHealth(data, error, now)
  const hasSnapshot = !!data?.collectedAt && Array.isArray(data?.sessions)
  const sessions = Array.isArray(data?.sessions) ? data.sessions : []
  const rows = filterSessions(sessions, query, state)
  const events = Array.isArray(data?.events) ? data.events : []
  const history = paginateHistory(events, historyQuery, historySize, historyPage)
  const counts = sessions.reduce((result, session) => {
    if (session.state === 'ACTIVE') result.active++
    if (session.state === 'DISCONNECTED') result.disconnected++
    const compliance = sessionCompliance(session, data?.policy)
    if (compliance === 'OVERDUE') result.overdue++
    if (compliance === 'EXEMPT') result.exempt++
    if (compliance === 'UNKNOWN') result.unknown++
    return result
  }, { active: 0, disconnected: 0, overdue: 0, exempt: 0, unknown: 0 })
  const states = [...new Set(['ACTIVE', 'DISCONNECTED', ...sessions.map(session => session.state).filter(Boolean)])]

  return <Layout><div className="page ts-page">
    <header className="page-header">
      <div className="page-header-left"><h1>Sessões TS</h1><p>Terminal Server · desconexões, isenções e evidências do Windows</p></div>
      <div className="ts-header-actions"><span className="badge badge-blue">Somente leitura</span><button className="btn btn-secondary" disabled={busy} onClick={() => pollerRef.current?.refresh()}>{busy ? 'Atualizando…' : 'Atualizar'}</button></div>
    </header>

    <section className="card ts-health" aria-label="Saúde da coleta" style={{ borderLeft: `4px solid ${health.color}` }}>
      <div className="ts-health-title"><strong style={{ color: health.color }} role="status">{busy && !data ? 'Consultando coletor…' : health.label}</strong><span>{data?.server || 'Servidor não informado'}{data?.ip ? ` · ${data.ip}` : ''}</span></div>
      <div className="ts-meta"><span>Snapshot: <strong>{formatTsDate(data?.collectedAt)}</strong></span><span>Último sucesso: <strong>{formatTsDate(data?.lastSuccessAt)}</strong></span><span>Atualização automática: 30s · America/Recife</span></div>
      {error && <p className="ts-warning" role="alert">{error}</p>}
      {!error && health.status !== 'OK' && <p className="ts-warning">{hasSnapshot ? 'Snapshot anterior / desatualizado: contagens e durações abaixo não representam necessariamente o estado atual.' : 'Sem coleta válida: não é possível afirmar quantos usuários estão conectados nem avaliar a conformidade.'}</p>}
    </section>

    <section className="ts-kpis" aria-label="Resumo de sessões">{[
      ['active', 'Ativas', 'var(--accent-text)'], ['disconnected', 'Desconectadas', 'var(--amber)'], ['overdue', 'Prazo excedido', 'var(--red)'], ['exempt', 'Isentas', 'var(--purple)'], ['unknown', 'Desconhecidas', 'var(--text-secondary)'],
    ].map(([key, label, color]) => <div key={key} className="stat-card"><div className="stat-value" style={{ color }}>{hasSnapshot ? counts[key] : '—'}</div><div className="stat-label">{label}</div><small>{!hasSnapshot ? 'Sem dados' : health.status === 'OK' ? 'No snapshot coletado' : 'Último snapshot · não atual'}</small></div>)}</section>

    <section className="card ts-policy" aria-label="Política observada"><div><span className="badge badge-gray">OBSERVE_ONLY</span><h2>30 minutos desconectado + 2 minutos de tolerância</h2></div><p>A regra considera somente sessões desconectadas de não administradores confirmados. Administradores são isentos; associação administrativa desconhecida permanece desconhecida. Tempo ocioso (idle) e duração de sessão ativa não são tempo de desconexão.</p><p>O Windows aplica a política e executa o logoff. Este painel apenas observa: não encerra nem desconecta sessões. A conformidade exibida é uma avaliação do snapshot, não prova de aplicação da GPO.</p>{data?.policy?.effectivePolicy && <details><summary>Política efetiva informada pelo coletor</summary><pre>{JSON.stringify(data.policy.effectivePolicy, null, 2)}</pre></details>}</section>

    <section className="card ts-section" aria-label="Lista de sessões">
      <div className="ts-section-header"><div><h2>Sessões do servidor</h2><p>{hasSnapshot ? `${rows.length} de ${sessions.length} sessões no snapshot` : 'Aguardando uma coleta válida'}</p></div><div className="ts-filters"><label><span>Usuário ou domínio</span><input className="input" type="search" placeholder="Buscar usuário…" value={query} onChange={event => setQuery(event.target.value)} /></label><label><span>Estado</span><select className="input" value={state} onChange={event => setState(event.target.value)}><option value="">Todos os estados</option>{states.map(value => <option key={value} value={value}>{stateLabels[value] || value}</option>)}</select></label></div></div>
      <div className="ts-table-scroll"><table className="ts-table"><caption className="ts-sr-only">Sessões TS; horários no fuso America/Recife e duração medida na coleta</caption><thead><tr>{['Usuário / sessão', 'Estado', 'Logon', 'Desconexão', 'Tempo desconectado', 'Admin / evidência', 'Cliente', 'Conformidade'].map(label => <th key={label} scope="col">{label}</th>)}</tr></thead><tbody>
        {rows.map((session, index) => {
          const compliance = sessionCompliance(session, data?.policy)
          return <tr key={`${data?.server}:${session.id}:${session.logonAt}:${index}`} className={compliance === 'OVERDUE' ? 'ts-overdue' : ''}>
            <td><strong>{session.domain ? `${session.domain}\\` : ''}{session.user || 'Usuário não informado'}</strong><small>Sessão {session.id ?? '—'}</small></td>
            <td><span className={`badge badge-${session.state === 'ACTIVE' ? 'blue' : session.state === 'DISCONNECTED' ? 'amber' : 'gray'}`}>{stateLabels[session.state] || session.state || 'Desconhecido'}</span></td>
            <td className="ts-nowrap">{formatTsDate(session.logonAt)}</td><td className="ts-nowrap">{formatTsDate(session.disconnectedAt)}</td>
            <td><strong>{session.state === 'DISCONNECTED' ? formatDisconnectedDuration(session.disconnectedSeconds) : 'Não se aplica'}</strong><small>Medido no snapshot · não é idle</small></td>
            <td>{session.isAdmin === true ? 'Sim · isento' : session.isAdmin === false ? 'Não' : 'Desconhecido'}<small>{typeof session.adminEvidence === 'object' && session.adminEvidence !== null ? JSON.stringify(session.adminEvidence) : session.adminEvidence || 'Sem evidência administrativa'}</small></td>
            <td>{session.clientName || '—'}<small>{session.clientAddress || 'Endereço não informado'}</small></td>
            <td><span className={`badge badge-${complianceColors[compliance]}`}>{complianceLabels[compliance]}</span><small>{explanation[compliance]}</small></td>
          </tr>
        })}
        {rows.length === 0 && <tr><td colSpan={8}><div className="empty-state"><h3>{!hasSnapshot ? 'Sem dados de sessões' : sessions.length === 0 ? 'Nenhuma sessão no snapshot' : 'Nenhuma sessão corresponde aos filtros'}</h3><p>{!hasSnapshot ? 'Verifique a disponibilidade e a última coleta bem-sucedida do coletor.' : 'A ausência de sessões não comprova que a política de logoff foi aplicada.'}</p></div></td></tr>}
      </tbody></table></div>
    </section>

    <section className="card ts-section ts-history" aria-label="Histórico Windows">
      <div className="ts-section-header"><div><h2>Histórico de eventos Windows</h2><p>21: logon · 23: logoff · 24: desconexão · 25: reconexão</p></div>
        <div className="ts-filters">
          <label><span>Pesquisar usuário no histórico</span><input className="input" type="search" placeholder="Usuário no histórico…" value={historyQuery} onChange={event => { setHistoryQuery(event.target.value); setHistoryPage(1) }} /></label>
          <label><span>Registros por página</span><select className="input" value={historySize} onChange={event => {
            const value = Number(event.target.value); setHistorySize(value); setHistoryPage(1)
            try { localStorage.setItem('nexusit.ts.historyPageSize', String(value)) } catch { /* Storage may be unavailable. */ }
          }}>{[10, 25, 50, 100].map(size => <option key={size} value={size}>{size} registros</option>)}</select></label>
        </div>
      </div>
      <p className="ts-history-note">Eventos mais recentes primeiro. O desaparecimento de uma sessão não confirma logoff; é necessário um evento Windows.</p>
      <div className="ts-table-scroll ts-history-scroll" tabIndex={0} aria-label="Eventos do histórico"><table className="ts-table"><thead><tr>{['Horário (Recife)', 'Evento', 'Usuário', 'Sessão', 'Fonte'].map(label => <th key={label} scope="col">{label}</th>)}</tr></thead><tbody>
        {history.rows.map((event, index) => <tr key={event.id ?? `${event.eventId}:${event.at}:${event.sessionId}:${index}`}><td className="ts-nowrap">{formatTsDate(event.at)}</td><td><strong>{windowsEventLabel(event)}</strong><small>Windows Event ID {event.eventId ?? '—'}</small></td><td>{event.user || '—'}</td><td>{event.sessionId ?? '—'}</td><td>{event.source || 'Fonte não informada'}</td></tr>)}
        {history.total === 0 && <tr><td colSpan={5}><div className="empty-state"><h3>{historyQuery.trim() ? 'Nenhum evento para este usuário' : 'Nenhum evento disponível'}</h3><p>{historyQuery.trim() ? 'Tente outro nome ou limpe a pesquisa.' : 'Sem eventos disponíveis no histórico recebido.'}</p></div></td></tr>}
      </tbody></table></div>
      <footer className="ts-history-pagination"><span aria-live="polite">{history.total ? `${(history.page - 1) * history.pageSize + 1}–${Math.min(history.page * history.pageSize, history.total)} de ${history.total}` : '0 registros'}{historyQuery.trim() ? ` filtrados · ${events.length} no histórico recebido` : ' registros no histórico recebido'}</span>
        <div><button className="btn btn-secondary" disabled={history.page <= 1} onClick={() => setHistoryPage(history.page - 1)}>Anterior</button><span>Página {history.page} de {history.totalPages}</span><button className="btn btn-secondary" disabled={history.page >= history.totalPages} onClick={() => setHistoryPage(history.page + 1)}>Próxima</button></div>
      </footer>
    </section>
  </div></Layout>
}
