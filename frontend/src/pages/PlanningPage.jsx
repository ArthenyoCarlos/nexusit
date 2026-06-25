import { useState, useEffect, useCallback } from 'react'
import {
  DndContext, DragOverlay, PointerSensor,
  useSensor, useSensors, useDroppable, useDraggable
} from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { getTasks, createTask, updateTask, moveTask, deleteTask } from '../services/planning'
import { getUsers } from '../services/users'
import Layout from '../components/Layout'
import Modal from '../components/Modal'

const COLUMNS = [
  { id: 'Backlog',       label: 'Backlog',       color: '#64748b', bg: '#f1f5f9' },
  { id: 'Em andamento',  label: 'Em andamento',  color: '#1a56db', bg: '#eef4ff' },
  { id: 'Em revisão',    label: 'Em revisão',    color: '#d97706', bg: '#fffbeb' },
  { id: 'Concluído',     label: 'Concluído',     color: '#0e9f6e', bg: '#f0fdf8' },
]

const EMPTY_FORM = { title: '', description: '', columnName: 'Backlog', dueDate: '', assigneeId: '' }

const today = new Date().toISOString().split('T')[0]

function isOverdue(dueDate, columnId) {
  return dueDate && dueDate < today && columnId !== 'Concluído'
}

// ── Drag-and-Drop components ──────────────────────────────────────────────

function DroppableColumn({ column, children, count }) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id })
  return (
    <div ref={setNodeRef}
      style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 220, borderRadius: 12, border: `2px solid ${isOver ? column.color : 'transparent'}`, background: 'var(--bg-page)', transition: 'border-color 0.15s' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 12px', borderRadius: '10px 10px 0 0', background: column.bg, borderBottom: `2px solid ${column.color}20` }}>
        <span style={{ fontSize: 12.5, fontWeight: 700, color: column.color, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{column.label}</span>
        <span style={{ fontSize: 11, fontWeight: 600, color: column.color, background: `${column.color}18`, padding: '2px 7px', borderRadius: 20 }}>{count}</span>
      </div>
      <div style={{ flex: 1, padding: 8, display: 'flex', flexDirection: 'column', gap: 7, minHeight: 96 }}>
        {children}
      </div>
    </div>
  )
}

function DraggableCard({ task, onEdit, onDelete }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: task.id })
  const style = { transform: CSS.Translate.toString(transform), opacity: isDragging ? 0.3 : 1 }
  const overdue = isOverdue(task.dueDate, task.columnName)

  return (
    <div ref={setNodeRef} style={{ ...style, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, padding: 11, cursor: 'default' }}
      className="card-group"
    >
      <style>{`.card-group:hover { border-color: var(--accent) !important; box-shadow: var(--shadow-sm); } .card-group .card-actions { opacity: 0; transition: opacity 0.12s; } .card-group:hover .card-actions { opacity: 1; }`}</style>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
        <span {...listeners} {...attributes}
          style={{ cursor: 'grab', color: 'var(--text-disabled)', fontSize: 14, flexShrink: 0, marginTop: 1, userSelect: 'none' }}
          title="Arrastar">⣿</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1.35, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{task.title}</p>
          {task.description && (
            <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 3, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{task.description}</p>
          )}
        </div>
        <div className="card-actions" style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
          <button onClick={() => onEdit(task)} style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', fontSize: 12, padding: '2px 4px' }}>✏</button>
          <button onClick={() => onDelete(task.id)} style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', fontSize: 14, padding: '2px 4px' }}>×</button>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, gap: 6 }}>
        {task.assigneeName && (
          <span style={{ fontSize: 11.5, color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.assigneeName}</span>
        )}
        {task.dueDate && (
          <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 20, fontWeight: 500, flexShrink: 0, background: overdue ? 'var(--red-bg)' : 'var(--bg-muted)', color: overdue ? 'var(--red)' : 'var(--text-secondary)' }}>
            {overdue ? '⚠ ' : ''}{new Date(task.dueDate + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
          </span>
        )}
      </div>
    </div>
  )
}

function CardOverlay({ task }) {
  const overdue = isOverdue(task.dueDate, task.columnName)
  return (
    <div className="bg-white border-2 border-blue-400 rounded-lg p-3 shadow-xl w-56">
      <p className="text-sm font-medium text-slate-800">{task.title}</p>
      {task.dueDate && (
        <span className={`text-xs px-1.5 py-0.5 rounded font-medium mt-1 inline-block ${
          overdue ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'
        }`}>
          {new Date(task.dueDate + 'T00:00:00').toLocaleDateString('pt-BR')}
        </span>
      )}
    </div>
  )
}

// ── Mini Calendar ─────────────────────────────────────────────────────────

const MONTH_NAMES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
const WEEK_DAYS   = ['D','S','T','Q','Q','S','S']

function MiniCalendar({ tasks }) {
  const [ref, setRef] = useState(new Date())
  const year  = ref.getFullYear()
  const month = ref.getMonth()
  const firstDay    = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const datesWithTasks = new Set(
    tasks.filter(t => t.dueDate).map(t => t.dueDate)
  )

  const cells = []
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  const pad = n => String(n).padStart(2, '0')
  const dateStr = d => `${year}-${pad(month + 1)}-${pad(d)}`

  const prev = () => setRef(new Date(year, month - 1, 1))
  const next = () => setRef(new Date(year, month + 1, 1))

  // Tasks for this month
  const monthPrefix = `${year}-${pad(month + 1)}-`
  const upcoming = tasks
    .filter(t => t.dueDate?.startsWith(monthPrefix) && t.columnName !== 'Concluído')
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, 5)

  return (
    <div className="card" style={{ padding: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <button onClick={prev} style={{ padding: '4px 8px', borderRadius: 6, border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 16 }}>‹</button>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{MONTH_NAMES[month]} {year}</span>
        <button onClick={next} style={{ padding: '4px 8px', borderRadius: 6, border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 16 }}>›</button>
      </div>

      <div className="grid grid-cols-7 gap-0.5 mb-2">
        {WEEK_DAYS.map((d, i) => (
          <div key={i} className="text-center text-xs font-medium text-slate-400 py-1">{d}</div>
        ))}
        {cells.map((d, i) => {
          if (!d) return <div key={i} />
          const ds = dateStr(d)
          const isToday = ds === today
          const hasTasks = datesWithTasks.has(ds)
          const isOverdueDate = ds < today && hasTasks
          return (
            <div key={i}
              className={`relative text-center text-xs py-1 rounded cursor-default ${
                isToday ? 'bg-blue-600 text-white font-bold' :
                isOverdueDate ? 'bg-red-50 text-red-700 font-medium' :
                hasTasks ? 'bg-blue-50 text-blue-700 font-medium' :
                'text-slate-600 hover:bg-slate-50'
              }`}
            >
              {d}
              {hasTasks && !isToday && (
                <div className={`absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full ${
                  isOverdueDate ? 'bg-red-400' : 'bg-blue-400'
                }`} />
              )}
            </div>
          )
        })}
      </div>

      {upcoming.length > 0 && (
        <div className="mt-3 border-t border-slate-100 pt-3">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Este mês</p>
          <div className="space-y-1">
            {upcoming.map(t => (
              <div key={t.id} className="flex items-center gap-2 text-xs">
                <span className={`flex-shrink-0 font-medium ${
                  isOverdue(t.dueDate, t.columnName) ? 'text-red-600' : 'text-slate-500'
                }`}>
                  {new Date(t.dueDate + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                </span>
                <span className="text-slate-700 truncate">{t.title}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────

export default function PlanningPage() {
  const [tasks, setTasks] = useState([])
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTask, setActiveTask] = useState(null)

  const [modalOpen, setModalOpen] = useState(false)
  const [editingTask, setEditingTask] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  )

  const fetch = useCallback(async () => {
    setLoading(true)
    try {
      const [tasksRes, usersRes] = await Promise.all([getTasks(), getUsers()])
      setTasks(tasksRes.data)
      setUsers(usersRes)
    } catch { /* silent */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetch() }, [fetch])

  function openCreate(columnName = 'Backlog') {
    setEditingTask(null)
    setForm({ ...EMPTY_FORM, columnName })
    setModalOpen(true)
  }

  function openEdit(task) {
    setEditingTask(task)
    setForm({
      title: task.title,
      description: task.description || '',
      columnName: task.columnName,
      dueDate: task.dueDate || '',
      assigneeId: task.assigneeId || '',
    })
    setModalOpen(true)
  }

  async function handleSave() {
    if (!form.title.trim()) return
    setSaving(true)
    const payload = {
      ...form,
      dueDate: form.dueDate || null,
      assigneeId: form.assigneeId || null,
    }
    try {
      if (editingTask) {
        await updateTask(editingTask.id, payload)
      } else {
        // Determine column order
        const colCount = tasks.filter(t => t.columnName === form.columnName).length
        await createTask({ ...payload, columnOrder: colCount })
      }
      setModalOpen(false)
      fetch()
    } catch { /* silent */ }
    finally { setSaving(false) }
  }

  async function handleDelete(id) {
    if (!window.confirm('Excluir esta tarefa?')) return
    await deleteTask(id)
    fetch()
  }

  function handleDragStart({ active }) {
    setActiveTask(tasks.find(t => t.id === active.id) || null)
  }

  async function handleDragEnd({ active, over }) {
    setActiveTask(null)
    if (!over || active.id === over.id) return
    const targetCol = COLUMNS.find(c => c.id === over.id)
    if (!targetCol) return
    const task = tasks.find(t => t.id === active.id)
    if (!task || task.columnName === targetCol.id) return
    const colCount = tasks.filter(t => t.columnName === targetCol.id).length
    // Optimistic update
    setTasks(prev => prev.map(t => t.id === active.id
      ? { ...t, columnName: targetCol.id, columnOrder: colCount } : t))
    try {
      await moveTask(active.id, { columnName: targetCol.id, columnOrder: colCount })
    } catch {
      fetch() // revert on error
    }
  }

  return (
    <Layout>
      <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid var(--border-muted)', flexShrink: 0 }}>
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>Planejamento</h1>
            <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 2 }}>{tasks.length} tarefa(s) no quadro</p>
          </div>
          <button onClick={() => openCreate()} className="btn btn-primary">+ Nova Tarefa</button>
        </div>

        {loading ? (
          <div style={{ display: 'flex', gap: 14, flex: 1 }}>
            {[...Array(4)].map((_, i) => <div key={i} className="skeleton" style={{ flex: 1, borderRadius: 12 }} />)}
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 16, flex: 1, overflow: 'hidden' }}>
            {/* Kanban */}
            <div style={{ flex: 1, overflowX: 'auto', overflowY: 'hidden' }}>
              <DndContext
                sensors={sensors}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
              >
                <div style={{ display: 'flex', gap: 12, height: '100%', minWidth: 'fit-content' }}>
                  {COLUMNS.map(col => {
                    const colTasks = tasks
                      .filter(t => t.columnName === col.id)
                      .sort((a, b) => a.columnOrder - b.columnOrder || a.title.localeCompare(b.title))
                    return (
                      <DroppableColumn key={col.id} column={col} count={colTasks.length}>
                        {colTasks.map(task => (
                          <DraggableCard key={task.id} task={task} onEdit={openEdit} onDelete={handleDelete} />
                        ))}
                        <button
                          onClick={() => openCreate(col.id)}
                          style={{ width: '100%', textAlign: 'left', fontSize: 12, color: 'var(--text-tertiary)', padding: '5px 8px', borderRadius: 6, background: 'none', border: 'none', cursor: 'pointer', transition: 'background 0.1s, color 0.1s' }}
                          onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-muted)'; e.currentTarget.style.color = 'var(--text-primary)' }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--text-tertiary)' }}
                        >
                          + Adicionar tarefa
                        </button>
                      </DroppableColumn>
                    )
                  })}
                </div>
                <DragOverlay>
                  {activeTask && <CardOverlay task={activeTask} />}
                </DragOverlay>
              </DndContext>
            </div>

            {/* Calendar sidebar */}
            <div style={{ flexShrink: 0, width: 220, overflowY: 'auto' }}>
              <MiniCalendar tasks={tasks} />
            </div>
          </div>
        )}
      </div>

      {/* Task Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingTask ? 'Editar Tarefa' : 'Nova Tarefa'}
        size="md"
      >
        <div className="space-y-4">
          <input
            type="text" placeholder="Título *" value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <textarea
            placeholder="Descrição (opcional)" value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            rows={3}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Coluna</label>
              <select value={form.columnName}
                onChange={e => setForm(f => ({ ...f, columnName: e.target.value }))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                {COLUMNS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Data limite</label>
              <input type="date" value={form.dueDate}
                onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Responsável</label>
            <select value={form.assigneeId}
              onChange={e => setForm(f => ({ ...f, assigneeId: e.target.value }))}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Sem responsável</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setModalOpen(false)}
              className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">
              Cancelar
            </button>
            <button onClick={handleSave} disabled={!form.title.trim() || saving}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
              {saving ? 'Salvando...' : editingTask ? 'Salvar' : 'Criar'}
            </button>
          </div>
        </div>
      </Modal>
    </Layout>
  )
}
