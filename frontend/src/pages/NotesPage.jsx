import { useState, useEffect, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import { getNotes, searchNotes, createNote, updateNote, deleteNote } from '../services/notes'
import { useAuth } from '../contexts/AuthContext'
import Layout from '../components/Layout'
import Modal from '../components/Modal'

const TAG_COLORS = [
  'bg-[var(--accent-light)] text-[var(--accent-text)]', 'bg-[var(--purple-bg)] text-[var(--purple)]',
  'bg-[var(--green-bg)] text-[var(--green)]', 'bg-[var(--amber-bg)] text-[var(--amber)]',
  'bg-[var(--red-bg)] text-[var(--red)]', 'bg-[var(--orange-bg)] text-[var(--orange)]',
]
function tagColor(tag) {
  let h = 0
  for (const c of (tag || '')) h = h * 31 + c.charCodeAt(0)
  return TAG_COLORS[Math.abs(h) % TAG_COLORS.length]
}

const EMPTY_FORM = { title: '', content: '', visibility: 'PERSONAL', tags: [] }

function TagChip({ tag, category }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${tagColor(tag)}`}>
      {tag}{category ? ` · ${category}` : ''}
    </span>
  )
}

export default function NotesPage() {
  const { user } = useAuth()
  const [notes, setNotes] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [tagFilter, setTagFilter] = useState('')
  const [catFilter, setCatFilter] = useState('')
  const [visFilter, setVisFilter] = useState('')

  // Modal state
  const [modalOpen, setModalOpen] = useState(false)
  const [editingNote, setEditingNote] = useState(null) // null = create
  const [form, setForm] = useState(EMPTY_FORM)
  const [previewTab, setPreviewTab] = useState('edit') // 'edit' | 'preview'
  const [tagInput, setTagInput] = useState({ tag: '', category: '' })
  const [saving, setSaving] = useState(false)

  const fetch = useCallback(async () => {
    setLoading(true)
    try {
      const params = {}
      if (search) params.q = search
      if (tagFilter) params.tag = tagFilter
      if (catFilter) params.category = catFilter
      const res = (search || tagFilter || catFilter)
        ? await searchNotes(params)
        : await getNotes()
      let data = res.data
      if (visFilter) data = data.filter(n => n.visibility === visFilter)
      setNotes(data)
    } catch { setNotes([]) }
    finally { setLoading(false) }
  }, [search, tagFilter, catFilter, visFilter])

  useEffect(() => { fetch() }, [fetch])

  // Debounce search
  useEffect(() => {
    const t = setTimeout(fetch, 350)
    return () => clearTimeout(t)
  }, [search])

  function openCreate() {
    setEditingNote(null)
    setForm(EMPTY_FORM)
    setPreviewTab('edit')
    setTagInput({ tag: '', category: '' })
    setModalOpen(true)
  }

  function openEdit(note) {
    setEditingNote(note)
    setForm({
      title: note.title,
      content: note.content || '',
      visibility: note.visibility,
      tags: note.tags.map(t => ({ tag: t.tag, category: t.category })),
    })
    setPreviewTab('edit')
    setTagInput({ tag: '', category: '' })
    setModalOpen(true)
  }

  async function handleSave() {
    if (!form.title.trim()) return
    setSaving(true)
    try {
      if (editingNote) {
        await updateNote(editingNote.id, form)
      } else {
        await createNote(form)
      }
      setModalOpen(false)
      fetch()
    } catch { /* error handled silently */ }
    finally { setSaving(false) }
  }

  async function handleDelete(id, e) {
    e.stopPropagation()
    if (!window.confirm('Excluir esta anotação?')) return
    await deleteNote(id)
    fetch()
  }

  function addTag() {
    if (!tagInput.tag.trim()) return
    setForm(f => ({ ...f, tags: [...f.tags, { ...tagInput }] }))
    setTagInput({ tag: '', category: '' })
  }

  function removeTag(i) {
    setForm(f => ({ ...f, tags: f.tags.filter((_, idx) => idx !== i) }))
  }

  // Collect all unique tags and categories for filter suggestions
  const allTags = [...new Set(notes.flatMap(n => n.tags.map(t => t.tag).filter(Boolean)))]
  const allCats = [...new Set(notes.flatMap(n => n.tags.map(t => t.category).filter(Boolean)))]

  return (
    <Layout>
      <div className="page fade-up">
        {/* Header */}
        <div className="page-header">
          <div className="page-header-left">
            <h1>Anotações</h1>
            <p>{notes.length} anotação(ões)</p>
          </div>
          <button onClick={openCreate} className="btn btn-primary">+ Nova Anotação</button>
        </div>

        {/* Filters */}
        <div className="filter-bar">
          <input type="text" placeholder="Buscar título ou conteúdo..." value={search}
            onChange={e => setSearch(e.target.value)} className="input" style={{ width: 220, height: 32 }} />
          <select value={tagFilter} onChange={e => setTagFilter(e.target.value)} className="input" style={{ width: 'auto', height: 32 }}>
            <option value="">Todas as tags</option>
            {allTags.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <select value={catFilter} onChange={e => setCatFilter(e.target.value)} className="input" style={{ width: 'auto', height: 32 }}>
            <option value="">Todas as categorias</option>
            {allCats.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={visFilter} onChange={e => setVisFilter(e.target.value)} className="input" style={{ width: 'auto', height: 32 }}>
            <option value="">Todas as visibilidades</option>
            <option value="PERSONAL">Pessoal</option>
            <option value="SHARED">Compartilhada</option>
          </select>
        </div>

        {/* Notes grid */}
        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px,1fr))', gap: 14 }}>
            {[...Array(6)].map((_, i) => <div key={i} className="skeleton" style={{ height: 160, borderRadius: 'var(--r-lg)' }} />)}
          </div>
        ) : notes.length === 0 ? (
          <div className="card empty-state">
            <div className="empty-state-icon">
              <svg width="22" height="22" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16l4-2 4 2 4-2 4 2V8z"/></svg>
            </div>
            <h3>Nenhuma anotação encontrada</h3>
            <p>Crie sua primeira anotação para começar</p>
            <button onClick={openCreate} className="btn btn-primary btn-sm" style={{ marginTop: 12 }}>+ Nova Anotação</button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px,1fr))', gap: 14 }}>
            {notes.map(note => (
              <div key={note.id} onClick={() => openEdit(note)} className="card note-card"
                style={{ padding: '16px 18px', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 10, transition: 'box-shadow 0.15s, transform 0.15s, border-color 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.boxShadow = 'var(--shadow-md)'; e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.borderColor = 'var(--accent)' }}
                onMouseLeave={e => { e.currentTarget.style.boxShadow = ''; e.currentTarget.style.transform = ''; e.currentTarget.style.borderColor = '' }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                  <p style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.3, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', flex: 1 }}>{note.title}</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                    <span className={note.visibility === 'SHARED' ? 'badge badge-green' : 'badge badge-gray'} style={{ fontSize: 11 }}>
                      {note.visibility === 'SHARED' ? 'Compartilhada' : 'Pessoal'}
                    </span>
                    {(note.authorId === user?.id || user?.role === 'ADMIN') && (
                      <button onClick={(e) => handleDelete(note.id, e)}
                        style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: '0 2px' }}
                        onMouseEnter={e => e.currentTarget.style.color = 'var(--red)'}
                        onMouseLeave={e => e.currentTarget.style.color = 'var(--text-tertiary)'}>
                        ×
                      </button>
                    )}
                  </div>
                </div>

                {note.content && (
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.55, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' }}>
                    {note.content.replace(/[#*`_[\]]/g, '')}
                  </p>
                )}

                {note.tags.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {note.tags.slice(0, 4).map((t, i) => <TagChip key={i} tag={t.tag} category={t.category} />)}
                    {note.tags.length > 4 && <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>+{note.tags.length - 4}</span>}
                  </div>
                )}

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11.5, color: 'var(--text-tertiary)', marginTop: 'auto', paddingTop: 8, borderTop: '1px solid var(--border-muted)' }}>
                  <span>{note.authorName}</span>
                  <span>{new Date(note.updatedAt).toLocaleDateString('pt-BR')}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)}
        title={editingNote ? 'Editar Anotação' : 'Nova Anotação'} size="xl">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Title + visibility */}
          <div style={{ display: 'flex', gap: 10 }}>
            <input type="text" placeholder="Título *" value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              className="input" style={{ flex: 1 }} />
            <select value={form.visibility} onChange={e => setForm(f => ({ ...f, visibility: e.target.value }))} className="input" style={{ width: 'auto' }}>
              <option value="PERSONAL">Pessoal</option>
              <option value="SHARED">Compartilhada</option>
            </select>
          </div>

          {/* Tags */}
          <div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <input type="text" placeholder="Tag" value={tagInput.tag}
                onChange={e => setTagInput(t => ({ ...t, tag: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && addTag()} className="input" style={{ flex: 1, height: 30, fontSize: 12 }} />
              <input type="text" placeholder="Categoria" value={tagInput.category}
                onChange={e => setTagInput(t => ({ ...t, category: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && addTag()} className="input" style={{ flex: 1, height: 30, fontSize: 12 }} />
              <button onClick={addTag} className="btn btn-default btn-sm">+ Tag</button>
            </div>
            {form.tags.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {form.tags.map((t, i) => (
                  <button key={i} onClick={() => removeTag(i)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>
                    <TagChip tag={t.tag} category={`${t.category || ''} ×`} />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Tabs + content */}
          <div>
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: 10 }}>
              {['edit', 'preview'].map(tab => (
                <button key={tab} onClick={() => setPreviewTab(tab)}
                  style={{ padding: '6px 16px', fontSize: 13, fontWeight: 500, border: 'none', background: 'none', cursor: 'pointer', borderBottom: previewTab === tab ? '2px solid var(--accent)' : '2px solid transparent', color: previewTab === tab ? 'var(--accent)' : 'var(--text-secondary)' }}>
                  {tab === 'edit' ? 'Editar' : 'Prévia'}
                </button>
              ))}
            </div>
            {previewTab === 'edit' ? (
              <textarea value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                placeholder="Conteúdo (suporta Markdown)..." rows={12}
                className="input" style={{ fontFamily: 'var(--font-mono)', fontSize: 13, resize: 'vertical', height: 'auto' }} />
            ) : (
              <div className="prose" style={{ minHeight: 192, maxHeight: 320, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: '12px 16px' }}>
                {form.content ? <ReactMarkdown>{form.content}</ReactMarkdown> : <p style={{ color: 'var(--text-tertiary)', fontStyle: 'italic' }}>Sem conteúdo para prévia.</p>}
              </div>
            )}
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button onClick={() => setModalOpen(false)} className="btn btn-default">Cancelar</button>
            <button onClick={handleSave} disabled={!form.title.trim() || saving} className="btn btn-primary">
              {saving ? 'Salvando...' : editingNote ? 'Salvar' : 'Criar'}
            </button>
          </div>
        </div>
      </Modal>
    </Layout>
  )
}
