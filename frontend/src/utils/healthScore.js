export function computeHealthScore({ problems, tickets, licenses, contracts, monitors }) {
  let score = 100
  const crit   = (problems  || []).filter(p => Number(p.severity) >= 4)
  const warn   = (problems  || []).filter(p => Number(p.severity) < 4)
  const open   = (tickets   || []).filter(t => ![5, 6].includes(Number(t.status)))
  const critTx = open.filter(t => Number(t.priority) >= 4)
  const expLic = (licenses  || []).filter(l => l.status === 'EXPIRED' || l.status === 'EXPIRING_SOON')
  const expCtr = (contracts || []).filter(c => c.status === 'EXPIRED' || c.status === 'EXPIRING_SOON')
  const down   = (monitors  || []).filter(m => m.enabled && m.lastStatus != null && m.lastStatus >= 400)

  score -= Math.min(crit.length   * 10, 30)
  score -= Math.min(warn.length   *  3, 12)
  score -= Math.min(critTx.length *  5, 15)
  score -= Math.min(open.length   *  1,  8)
  score -= Math.min(expLic.length *  5, 15)
  score -= Math.min(expCtr.length *  5, 15)
  score -= Math.min(down.length   * 10, 20)
  return Math.max(0, Math.min(score, 100))
}

function clamp(n) { return Math.max(0, Math.min(100, Math.round(n))) }

export function computeHealthBreakdown({ problems, tickets, licenses, contracts, monitors }) {
  const crit   = (problems  || []).filter(p => Number(p.severity) >= 4)
  const warn   = (problems  || []).filter(p => Number(p.severity) < 4)
  const open   = (tickets   || []).filter(t => ![5, 6].includes(Number(t.status)))
  const critTx = open.filter(t => Number(t.priority) >= 4)
  const expLic = (licenses  || []).filter(l => l.status === 'EXPIRED' || l.status === 'EXPIRING_SOON')
  const expCtr = (contracts || []).filter(c => c.status === 'EXPIRED' || c.status === 'EXPIRING_SOON')
  const down   = (monitors  || []).filter(m => m.enabled && m.lastStatus != null && m.lastStatus >= 400)

  const infraScore     = clamp(100 - Math.min(crit.length   * 15, 60) - Math.min(warn.length * 5, 25))
  const chamadosScore  = clamp(100 - Math.min(critTx.length * 10, 50) - Math.min(open.length  * 2, 40))
  const licencasScore  = clamp(100 - Math.min(expLic.length * 15, 60))
  const contratosScore = clamp(100 - Math.min(expCtr.length * 15, 60))
  const urlsScore      = (monitors || []).length === 0 ? null : clamp(100 - Math.min(down.length * 20, 80))

  return [
    { key: 'infra',     label: 'Infraestrutura', score: infraScore,
      detail: `${crit.length} crítico(s) · ${warn.length} aviso(s)`, to: '/monitoring' },
    { key: 'chamados',  label: 'Chamados',       score: chamadosScore,
      detail: `${critTx.length} crítico(s) · ${open.length} aberto(s)`, to: '/tickets' },
    { key: 'licencas',  label: 'Licenças',       score: licencasScore,
      detail: `${expLic.length} a vencer/vencida(s)`, to: '/licenses' },
    { key: 'contratos', label: 'Contratos',      score: contratosScore,
      detail: `${expCtr.length} a vencer/vencido(s)`, to: '/contracts' },
    { key: 'urls',      label: 'URLs',           score: urlsScore,
      detail: urlsScore == null ? 'nenhuma monitorada' : `${down.length} com falha`, to: '/url-monitor' },
  ]
}

export function healthScoreColor(score) {
  if (score == null) return 'var(--text-tertiary)'
  if (score >= 80) return 'var(--green)'
  if (score >= 60) return 'var(--amber)'
  if (score >= 40) return 'var(--orange)'
  return 'var(--red)'
}

export function healthScoreBg(score) {
  if (score == null) return 'var(--bg-muted)'
  if (score >= 80) return 'var(--green-bg)'
  if (score >= 60) return 'var(--amber-bg)'
  if (score >= 40) return 'var(--orange-bg)'
  return 'var(--red-bg)'
}

export function healthScoreLabel(score) {
  if (score == null) return '—'
  if (score >= 80) return 'Operação saudável'
  if (score >= 60) return 'Atenção necessária'
  if (score >= 40) return 'Situação crítica'
  return 'Operação comprometida'
}
