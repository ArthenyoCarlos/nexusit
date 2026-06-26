import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import Layout from '../components/Layout'
import { getArticle } from '../services/wiki'

export default function WikiArticlePage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [article, setArticle] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getArticle(id).then(setArticle).finally(() => setLoading(false))
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
              Por {article.authorName ?? '—'} · Atualizado em {new Date(article.updatedAt).toLocaleDateString('pt-BR')}
            </p>
          </div>
          <hr style={{ border: 'none', borderTop: '1px solid var(--border-muted)', marginBottom: 20 }} />
          <div className="markdown-body" style={{ fontSize: 14, lineHeight: 1.8, color: 'var(--text-primary)' }}>
            <ReactMarkdown>{article.content}</ReactMarkdown>
          </div>
        </div>
      </div>
    </Layout>
  )
}
