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
        <div className="w-52 border-r border-slate-200 bg-white flex flex-col flex-shrink-0">
          <div className="px-4 py-4 border-b border-slate-100">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Documentação de Rede</p>
          </div>
          <nav className="flex-1 p-2 space-y-0.5">
            {SECTIONS.map(s => {
              const count = docs.filter(d => d.section === s.id).length
              return (
                <button key={s.id} onClick={() => changeSection(s.id)}
                  className={`w-full text-left flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all ${
                    section === s.id
                      ? 'bg-blue-50 text-blue-700 font-medium'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}>
                  <span className="text-base leading-none">{s.icon}</span>
                  <span className="flex-1 truncate">{s.id}</span>
                  {count > 0 && (
                    <span className={`text-xs rounded-full w-5 h-5 flex items-center justify-center ${
                      section === s.id ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'
                    }`}>{count}</span>
                  )}
                </button>
              )
            })}
          </nav>
        </div>

        {/* Doc list */}
        <div className="w-64 border-r border-slate-200 flex flex-col flex-shrink-0" style={{ background: '#f8fafc' }}>
          <div className="flex items-center justify-between px-4 py-4 border-b border-slate-200">
            <p className="text-sm font-semibold text-slate-700">{section}</p>
            <button onClick={openCreate}
              className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center hover:bg-blue-700 transition-colors text-lg leading-none">
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
                <p className="text-xs text-slate-400">Nenhum documento nesta seção.</p>
                <button onClick={openCreate} className="mt-2 text-xs text-blue-600 hover:text-blue-700 font-medium">
                  + Criar documento
                </button>
              </div>
            ) : (
              sectionDocs.map(doc => (
                <button key={doc.id}
                  onClick={() => { setSelected(doc); setEditing(false); setCreating(false) }}
                  className={`w-full text-left px-3 py-2.5 rounded-lg transition-all ${
                    selected?.id === doc.id
                      ? 'bg-white shadow-sm border border-slate-200 ring-1 ring-blue-200'
                      : 'hover:bg-white hover:shadow-sm'
                  }`}>
                  <p className="text-sm font-medium text-slate-800 truncate leading-snug">{doc.title}</p>
                  <p className="text-xs text-slate-400 mt-0.5 truncate">
                    {doc.updatedByName ?? 'Sistema'} · {fmt(doc.updatedAt)}
                  </p>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Content area */}
        <div className="flex-1 flex flex-col overflow-hidden bg-white">
          {(editing || creating) ? (
            /* ── Editor ── */
            <div className="flex flex-col flex-1 overflow-hidden">
              <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-200 flex-shrink-0">
                <input type="text" placeholder="Título do documento *" value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  className="flex-1 text-base font-semibold bg-transparent border-0 outline-none text-slate-900 placeholder:text-slate-300" />
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button onClick={cancel} className="btn btn-default text-xs">Cancelar</button>
                  <button onClick={handleSave} disabled={saving || !form.title.trim()} className="btn btn-primary text-xs">
                    {saving ? 'Salvando...' : 'Salvar'}
                  </button>
                </div>
              </div>
              <textarea value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                placeholder="Conteúdo em Markdown...&#10;&#10;## Seção&#10;&#10;Descreva aqui."
                className="flex-1 p-6 font-mono text-sm outline-none resize-none text-slate-700 leading-relaxed"
                style={{ background: '#fafafa' }} />
            </div>
          ) : selected ? (
            /* ── Viewer ── */
            <div className="flex flex-col flex-1 overflow-y-auto">
              <div className="flex items-start justify-between gap-4 px-8 py-5 border-b border-slate-100 flex-shrink-0">
                <div>
                  <h1 className="text-lg font-bold text-slate-900">{selected.title}</h1>
                  <p className="text-xs text-slate-400 mt-1">
                    Última edição por <span className="font-medium text-slate-500">{selected.updatedByName ?? 'Sistema'}</span> · {fmt(selected.updatedAt)}
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
                    <p className="text-slate-400 text-sm">Documento sem conteúdo.</p>
                    <button onClick={openEdit} className="mt-2 text-xs text-blue-600 hover:underline">Clique em Editar para adicionar</button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* ── Empty ── */
            <div className="flex-1 flex items-center justify-center" style={{ background: '#f8fafc' }}>
              <div className="text-center">
                <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4 text-3xl">🌐</div>
                <p className="text-slate-500 font-medium">Selecione um documento</p>
                <p className="text-slate-400 text-sm mt-1 mb-4">ou crie um novo na seção <strong>{section}</strong></p>
                <button onClick={openCreate} className="btn btn-primary text-xs">+ Criar documento</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  )
}
