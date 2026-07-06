import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Layout from '../components/Layout'
import { getTermos, termoPdfUrl } from '../services/termos'

const STATUS = {
  ATIVO: { label: 'Ativo', color: 'var(--green)', bg: 'var(--green-bg)' },
  DEVOLVIDO: { label: 'Devolvido', color: 'var(--accent-text)', bg: 'var(--accent-light)' },
  CANCELADO: { label: 'Cancelado', color: 'var(--text-tertiary)', bg: 'var(--bg-muted)' },
}
const DATE = v => v ? new Date(v + 'T00:00').toLocaleDateString('pt-BR') : '—'

export default function TermosPage() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  useEffect(() => { getTermos().then(setItems).finally(() => setLoading(false)) }, [])
  return <Layout><div className="page fade-up">
    <div className="page-header">
      <div className="page-header-left"><h1>Termos de Responsabilidade</h1><p>{items.length} termo(s) cadastrado(s)</p></div>
      <div style={{display:'flex', gap:8}}>
        <Link to="/termos/template" className="btn btn-default">Template</Link>
        <Link to="/termos/novo" className="btn btn-primary">+ Novo Termo</Link>
      </div>
    </div>
    <div className="card scroll-x" style={{overflow:'hidden'}}>
      <table style={{width:'100%', borderCollapse:'collapse'}}>
        <thead><tr style={{borderBottom:'1px solid var(--border-muted)'}}>{['Status','Termo','Responsável','Equipamento','Tombamento','Entrega','Assinatura',''].map(h=><th key={h} style={th}>{h}</th>)}</tr></thead>
        <tbody>
          {items.map(t => { const s=STATUS[t.status] ?? STATUS.ATIVO; return <tr key={t.id} style={{borderBottom:'1px solid var(--border-muted)'}}>
            <td style={td}><span style={{fontSize:11.5,fontWeight:700,padding:'4px 9px',borderRadius:99,background:s.bg,color:s.color}}>{s.label}</span></td>
            <td style={td}><Link to={`/termos/${t.id}`} style={{fontWeight:700,color:'var(--accent-text)'}}>{t.numeroTermo}</Link></td>
            <td style={td}><b>{t.responsavelNome}</b><p style={muted}>{t.setor || '—'} · {t.cargo || '—'}</p></td>
            <td style={td}>{t.tipoEquipamento}<p style={muted}>{[t.marca,t.modelo].filter(Boolean).join(' ') || '—'}</p></td>
            <td style={td}><code>{t.tombamento}</code></td>
            <td style={td}>{DATE(t.dataEntrega)}</td>
            <td style={td}>{t.assinado ? <span style={{color:'var(--green)',fontWeight:700}}>Assinado</span> : <Link to={`/termos/${t.id}/assinar`}>Assinar</Link>}</td>
            <td style={td}><div style={{display:'flex',gap:6}}><Link className="btn btn-default btn-sm" to={`/termos/${t.id}`}>Ver</Link>{t.assinado && <a className="btn btn-default btn-sm" href={termoPdfUrl(t.id)} target="_blank">PDF</a>}</div></td>
          </tr>})}
          {!loading && items.length===0 && <tr><td colSpan={8} style={{padding:32,textAlign:'center',color:'var(--text-tertiary)'}}>Nenhum termo cadastrado.</td></tr>}
        </tbody>
      </table>
    </div>
  </div></Layout>
}
const th={padding:'10px 14px',textAlign:'left',fontSize:11.5,fontWeight:700,color:'var(--text-tertiary)',textTransform:'uppercase',letterSpacing:'.05em'}
const td={padding:'12px 14px',fontSize:13,color:'var(--text-secondary)',verticalAlign:'top'}
const muted={fontSize:11.5,color:'var(--text-tertiary)',marginTop:3}
