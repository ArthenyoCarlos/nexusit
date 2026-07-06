import { useState, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import { getDocs, createDoc, updateDoc, deleteDoc } from '../services/networkDocs'
import { useAuth } from '../contexts/AuthContext'
import Layout from '../components/Layout'

const SECTIONS = [
  { id: 'Topologia',        icon: '🗺️' },
  { id: 'Endereçamento IP', icon: '🔢' },
  { id: 'VLANs',            icon: '📡' },
  { id: 'Equipamentos',     icon: '🖥️' },
  { id: 'Runbooks',         icon: '📖' },
  { id: 'Outros',           icon: '📁' },
]

function fmt(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function NetworkDocsPage() {
  const { user } = useAuth()
  const [docs, setDocs] = useState([])
  const [loading, setLoading] = useState(true)
  const [section, setSection] = useState(SECTIONS[0].id)
  const [selected, setSelected] = useState(null)
  const [editing, setEditing] = useState(false)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ title: '', section: '', content: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getDocs().then(r => { setDocs(r.data); setLoading(false) }).catch(() => setLoading(false))
  }, [])

  const sectionDocs = docs.filter(d => d.section === section)

  function changeSection(s) { setSection(s); setSelected(null); setEditing(false); setCreating(false) }
  function openCreate() { setSelected(null); setEditing(false); setCreating(true); setForm({ title: '', section, content: '' }) }
  function openEdit() { setCreating(false); setEditing(true); setForm({ title: selected.title, section: selected.section, content: selected.content ?? '' }) }
  function cancel() { setEditing(false); setCreating(false) }

  async function handleSave() {
    if (!form.title.trim()) return
    setSaving(true)
    try {
      if (creating) {
        const { data } = await createDoc(form)
        setDocs(prev => [...prev, data]); setSelected(data); setCreating(false)
      } else if (editing && selected) {
        const { data } = await updateDoc(selected.id, form)
        setDocs(prev => prev.map(d => d.id === data.id ? data : d)); setSelected(data); setEditing(false)
      }
    } catch {}
    finally { setSaving(false) }
  }

  async function handleDelete(doc) {
    if (!window.confirm(`Excluir "${doc.title}"?`)) return
    try {
      await deleteDoc(doc.id)
      setDocs(prev => prev.filter(d => d.id !== doc.id))
      if (selected?.id === doc.id) { setSelected(null); setEditing(false) }
    } catch {}
  }

  return (
    <Layout>
      <div className="flex h-full min-h-screen">

        {/* Section sidebar */}
        <div className="w-52 border-r border-[var(--border)] bg-[var(--bg-surface)] flex flex-col flex-shrink-0">
          <div className="px-4 py-4 border-b border-[var(--border-muted)]">
            <p className="text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wider">Documentação de Rede</p>
          </div>
          <nav className="flex-1 p-2 space-y-0.5">
            {SECTIONS.map(s => {
              const count = docs.filter(d => d.section === s.id).length
              return (
                <button key={s.id} onClick={() => changeSection(s.id)}
                  className={`w-full text-left flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all ${
                    section === s.id
                      ? 'bg-[var(--accent-light)] text-[var(--accent-text)] font-medium'
                      : 'text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]'
                  }`}>
                  <span className="text-base leading-none">{s.icon}</span>
                  <span className="flex-1 truncate">{s.id}</span>
                  {count > 0 && (
                    <span className={`text-xs rounded-full w-5 h-5 flex items-center justify-center ${
                      section === s.id ? 'bg-[var(--accent-light)] text-[var(--accent-text)]' : 'bg-[var(--bg-muted)] text-[var(--text-tertiary)]'
                    }`}>{count}</span>
                  )}
                </button>
              )
            })}
          </nav>
        </div>

        {/* Doc list */}
        <div className="w-64 border-r border-[var(--border)] flex flex-col flex-shrink-0" style={{ background: 'var(--bg-subtle)' }}>
          <div className="flex items-center justify-between px-4 py-4 border-b border-[var(--border)]">
            <p className="text-sm font-semibold text-[var(--text-secondary)]">{section}</p>
            <button onClick={openCreate}
              className="w-7 h-7 rounded-lg bg-[var(--accent)] text-[var(--text-inverse)] flex items-center justify-center hover:bg-[var(--accent-hover)] transition-colors text-lg leading-none">
              +
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {loading ? (
              [...Array(3)].map((_, i) => (
                <div key={i} className="p-3 rounded-lg space-y-1.5">
                  <div className="skeleton h-4 w-3/4" />
                  <div className="skeleton h-3 w-1/2" />
                </div>
              ))
            ) : sectionDocs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center px-4">
                <p className="text-xs text-[var(--text-tertiary)]">Nenhum documento nesta seção.</p>
                <button onClick={openCreate} className="mt-2 text-xs text-[var(--accent-text)] hover:text-[var(--accent-hover)] font-medium">
                  + Criar documento
                </button>
              </div>
            ) : (
              sectionDocs.map(doc => (
                <button key={doc.id}
                  onClick={() => { setSelected(doc); setEditing(false); setCreating(false) }}
                  className={`w-full text-left px-3 py-2.5 rounded-lg transition-all ${
                    selected?.id === doc.id
                      ? 'bg-[var(--bg-surface)] shadow-sm border border-[var(--border)] ring-1 ring-[var(--accent-ring)]'
                      : 'hover:bg-[var(--bg-surface)] hover:shadow-sm'
                  }`}>
                  <p className="text-sm font-medium text-[var(--text-primary)] truncate leading-snug">{doc.title}</p>
                  <p className="text-xs text-[var(--text-tertiary)] mt-0.5 truncate">
                    {doc.updatedByName ?? 'Sistema'} · {fmt(doc.updatedAt)}
                  </p>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Content area */}
        <div className="flex-1 flex flex-col overflow-hidden bg-[var(--bg-surface)]">
          {(editing || creating) ? (
            /* ── Editor ── */
            <div className="flex flex-col flex-1 overflow-hidden">
              <div className="flex items-center gap-3 px-6 py-4 border-b border-[var(--border)] flex-shrink-0">
                <input type="text" placeholder="Título do documento *" value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  className="flex-1 text-base font-semibold bg-transparent border-0 outline-none text-[var(--text-primary)] placeholder:text-[var(--text-disabled)]" />
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button onClick={cancel} className="btn btn-default text-xs">Cancelar</button>
                  <button onClick={handleSave} disabled={saving || !form.title.trim()} className="btn btn-primary text-xs">
                    {saving ? 'Salvando...' : 'Salvar'}
                  </button>
                </div>
              </div>
              <textarea value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                placeholder="Conteúdo em Markdown...&#10;&#10;## Seção&#10;&#10;Descreva aqui."
                className="flex-1 p-6 font-mono text-sm outline-none resize-none text-[var(--text-secondary)] leading-relaxed"
                style={{ background: 'var(--bg-subtle)' }} />
            </div>
          ) : selected ? (
            /* ── Viewer ── */
            <div className="flex flex-col flex-1 overflow-y-auto">
              <div className="flex items-start justify-between gap-4 px-8 py-5 border-b border-[var(--border-muted)] flex-shrink-0">
                <div>
                  <h1 className="text-lg font-bold text-[var(--text-primary)]">{selected.title}</h1>
                  <p className="text-xs text-[var(--text-tertiary)] mt-1">
                    Última edição por <span className="font-medium text-[var(--text-tertiary)]">{selected.updatedByName ?? 'Sistema'}</span> · {fmt(selected.updatedAt)}
                  </p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button onClick={openEdit} className="btn btn-default text-xs">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                    </svg>
                    Editar
                  </button>
                  {user?.role === 'ADMIN' && (
                    <button onClick={() => handleDelete(selected)} className="btn btn-danger text-xs">Excluir</button>
                  )}
                </div>
              </div>
              <div className="px-8 py-6 flex-1">
                {selected.content ? (
                  <div className="prose max-w-none">
                    <ReactMarkdown>{selected.content}</ReactMarkdown>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-32 text-center">
                    <p className="text-[var(--text-tertiary)] text-sm">Documento sem conteúdo.</p>
                    <button onClick={openEdit} className="mt-2 text-xs text-[var(--accent-text)] hover:underline">Clique em Editar para adicionar</button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* ── Empty ── */
            <div className="flex-1 flex items-center justify-center" style={{ background: 'var(--bg-subtle)' }}>
              <div className="text-center">
                <div className="w-16 h-16 bg-[var(--bg-muted)] rounded-2xl flex items-center justify-center mx-auto mb-4 text-3xl">🌐</div>
                <p className="text-[var(--text-tertiary)] font-medium">Selecione um documento</p>
                <p className="text-[var(--text-tertiary)] text-sm mt-1 mb-4">ou crie um novo na seção <strong>{section}</strong></p>
                <button onClick={openCreate} className="btn btn-primary text-xs">+ Criar documento</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  )
}
