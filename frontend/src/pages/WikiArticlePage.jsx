import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import Layout from '../components/Layout'
import { getArticle } from '../services/wiki'
import { getWikiArticleTicketLinks } from '../services/ticketWikiLinks'

export default function WikiArticlePage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [article, setArticle] = useState(null)
  const [relatedTickets, setRelatedTickets] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      getArticle(id),
      getWikiArticleTicketLinks(id).catch(() => []),
    ]).then(([articleData, ticketLinks]) => {
      setArticle(articleData)
      setRelatedTickets(ticketLinks || [])
    }).catch(() => {
      setArticle(null)
      setRelatedTickets([])
    }).finally(() => setLoading(false))
  }, [id])

  if (loading) return <Layout><div className="page"><p style={{ color: 'var(--text-tertiary)' }}>Carregando...</p></div></Layout>
  if (!article) return <Layout><div className="page"><p>Artigo não encontrado.</p></div></Layout>

  return (
    <Layout>
      <div className="page fade-up" style={{ maxWidth: 860 }}>
        <button onClick={() => navigate('/wiki')} className="btn btn-default btn-sm" style={{ marginBottom: 16 }}>← Voltar</button>

        <div className="card" style={{ padding: '28px 32px' }}>
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <span style={{ fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 99, background: 'var(--bg-muted)', color: 'var(--text-secondary)' }}>{article.category}</span>
              {article.tags && article.tags.split(',').map(t => (
                <span key={t} style={{ fontSize: 11.5, color: 'var(--text-tertiary)', padding: '2px 8px', borderRadius: 99, border: '1px solid var(--border-muted)' }}>{t.trim()}</span>
              ))}
            </div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.3 }}>{article.title}</h1>
            <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 6 }}>
              Por {article.authorName ?? '—'} · Atualizado em {new Date(article.updatedAt).toLocaleDateString('pt-BR')} · {article.linkedTicketCount ?? relatedTickets.length} chamado(s) relacionado(s)
            </p>
          </div>
          <hr style={{ border: 'none', borderTop: '1px solid var(--border-muted)', marginBottom: 20 }} />
          <div className="prose">
            <ReactMarkdown>{article.content}</ReactMarkdown>
          </div>

          <div style={{ marginTop: 28, paddingTop: 20, borderTop: '1px solid var(--border-muted)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 12 }}>
              <div>
                <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>Chamados GLPI relacionados</p>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>Histórico de chamados que reutilizaram ou geraram este artigo.</p>
              </div>
              <span style={{ fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 99, background: 'var(--bg-muted)', color: 'var(--text-secondary)' }}>{relatedTickets.length}</span>
            </div>
            {relatedTickets.length === 0 ? (
              <p style={{ fontSize: 13, color: 'var(--text-tertiary)', fontStyle: 'italic' }}>Nenhum chamado vinculado a este artigo ainda.</p>
            ) : (
              <div style={{ display: 'grid', gap: 8 }}>
                {relatedTickets.map(link => (
                  <div key={link.id} style={{ border: '1px solid var(--border-muted)', borderRadius: 14, padding: '12px 14px', background: 'var(--bg-muted)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
                      <div>
                        <p style={{ fontWeight: 700, color: 'var(--text-primary)' }}>Chamado GLPI #{link.glpiTicketId}</p>
                        <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 3 }}>Vinculado por {link.createdByName || 'Sistema'} em {link.createdAt ? new Date(link.createdAt).toLocaleString('pt-BR') : '—'}</p>
                      </div>
                      <button onClick={() => navigate('/tickets')} className="btn btn-default btn-sm">Abrir chamados</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  )
}
