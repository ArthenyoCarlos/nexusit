import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'
import Modal from '../components/Modal'
import ConfirmDialog from '../components/ConfirmDialog'
import { SkeletonCard } from '../components/Skeleton'
import { useAuth } from '../contexts/AuthContext'
import { getArticles, createArticle, updateArticle, deleteArticle } from '../services/wiki'

const CATEGORIES = ['Geral', 'Servidores', 'Rede', 'Sistemas', 'Procedimentos', 'Segurança', 'Hardware']
const EMPTY = { title: '', category: 'Geral', content: '', tags: '' }

export default function WikiPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [articles, setArticles] = useState([])
  const [category, setCategory] = useState('')
  const [loading, setLoading]   = useState(true)
  const [modal, setModal]       = useState(false)
  const [form, setForm]         = useState(EMPTY)
  const [editing, setEditing]   = useState(null)
  const [saving, setSaving]     = useState(false)
  const [confirm, setConfirm]   = useState(null)

  const load = (cat) => getArticles(cat).then(setArticles).finally(() => setLoading(false))
  useEffect(() => { load(category) }, [category])

  const openCreate = () => { setForm(EMPTY); setEditing(null); setModal(true) }
  const openEdit   = a => { setForm({ title: a.title, category: a.category, content: a.content, tags: a.tags ?? '' }); setEditing(a.id); setModal(true) }

  const handleSave = async e => {
    e.preventDefault(); setSaving(true)
    try {
      if (editing) await updateArticle(editing, form)
      else         await createArticle(form)
      setModal(false); load(category)
    } finally { setSaving(false) }
  }

  const handleDelete = async id => { await deleteArticle(id); load(category) }

  const catCounts = CATEGORIES.reduce((acc, c) => {
    acc[c] = articles.filter(a => a.category === c).length; return acc
  }, {})

  return (
    <Layout>
      <div className="page fade-up" style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 20, alignItems: 'start' }}>

        {/* Sidebar categorias */}
        <div className="card" style={{ padding: '12px 8px', position: 'sticky', top: 76 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.07em', padding: '0 8px', marginBottom: 8 }}>Categorias</p>
          <button onClick={() => setCategory('')} className={`nav-item${!category ? ' active' : ''}`} style={{ width: '100%', justifyContent: 'space-between' }}>
            <span>Todos</span>
            <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{articles.length}</span>
          </button>
          {CATEGORIES.map(c => (
            <button key={c} onClick={() => setCategory(c)} className={`nav-item${category === c ? ' active' : ''}`} style={{ width: '100%', justifyContent: 'space-between' }}>
              <span>{c}</span>
              {catCounts[c] > 0 && <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{catCounts[c]}</span>}
            </button>
          ))}
        </div>

        {/* Content */}
        <div>
          <div className="page-header" style={{ marginBottom: 16 }}>
            <div className="page-header-left">
              <h1>Base de Conhecimento</h1>
              <p>{articles.length} artigo(s){category ? ` em ${category}` : ''}</p>
            </div>
            <button onClick={openCreate} className="btn btn-primary">+ Novo Artigo</button>
          </div>

          {loading ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
              {[...Array(6)].map((_, i) => <SkeletonCard key={i} />)}
            </div>
          ) : articles.length === 0 ? (
            <div className="card" style={{ padding: 40, textAlign: 'center' }}>
              <p style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>Nenhum artigo encontrado. Crie o primeiro!</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {articles.map(a => (
                <div key={a.id} className="card card-hover" style={{ padding: '16px 20px', cursor: 'pointer' }} onClick={() => navigate(`/wiki/${a.id}`)}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 99, background: 'var(--bg-muted)', color: 'var(--text-secondary)' }}>{a.category}</span>
                        {a.tags && a.tags.split(',').slice(0,3).map(t => (
                          <span key={t} style={{ fontSize: 11, color: 'var(--text-tertiary)', padding: '1px 6px', borderRadius: 99, border: '1px solid var(--border-muted)' }}>{t.trim()}</span>
                        ))}
                      </div>
                      <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{a.title}</p>
                      <p style={{ fontSize: 12.5, color: 'var(--text-tertiary)', marginTop: 4, lineHeight: 1.5 }}>
                        {a.content.replace(/[#*`]/g, '').slice(0, 120)}{a.content.length > 120 ? '...' : ''}
                      </p>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <p style={{ fontSize: 11.5, color: 'var(--text-tertiary)' }}>{a.authorName ?? '—'}</p>
                      <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>{new Date(a.updatedAt).toLocaleDateString('pt-BR')}</p>
                      <div style={{ display: 'flex', gap: 6, marginTop: 8, justifyContent: 'flex-end' }} onClick={e => e.stopPropagation()}>
                        <button onClick={() => openEdit(a)} className="btn btn-default btn-sm">Editar</button>
                        <button onClick={() => setConfirm(a.id)} className="btn btn-danger btn-sm">✕</button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Editar Artigo' : 'Novo Artigo'} size="lg">
          <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div style={{ gridColumn: '1/-1' }}>
                <label className="input-label">Título *</label>
                <input required value={form.title} onChange={e => setForm(f=>({...f,title:e.target.value}))} className="input" />
              </div>
              <div>
                <label className="input-label">Categoria</label>
                <select value={form.category} onChange={e => setForm(f=>({...f,category:e.target.value}))} className="input">
                  {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="input-label">Tags (separadas por vírgula)</label>
                <input value={form.tags} onChange={e => setForm(f=>({...f,tags:e.target.value}))} className="input" placeholder="backup, servidor, linux" />
              </div>
              <div style={{ gridColumn: '1/-1' }}>
                <label className="input-label">Conteúdo (Markdown)</label>
                <textarea value={form.content} onChange={e => setForm(f=>({...f,content:e.target.value}))} className="input" rows={10} style={{ resize: 'vertical', fontFamily: 'monospace', fontSize: 13 }} placeholder="# Título&#10;&#10;Escreva em **Markdown**..." />
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button type="button" onClick={() => setModal(false)} className="btn btn-default">Cancelar</button>
              <button type="submit" disabled={saving} className="btn btn-primary">{saving ? 'Salvando...' : 'Salvar'}</button>
            </div>
          </form>
        </Modal>

        <ConfirmDialog open={!!confirm} title="Excluir artigo?" message="Esta ação não pode ser desfeita."
          onConfirm={() => { handleDelete(confirm); setConfirm(null) }} onCancel={() => setConfirm(null)} />
      </div>
    </Layout>
  )
}
