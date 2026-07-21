import { useState, useEffect, useCallback } from 'react'
import Layout from '../components/Layout'
import Modal from '../components/Modal'
import Badge from '../components/Badge'
import ConfirmDialog from '../components/ConfirmDialog'
import QrScannerModal from '../components/QrScannerModal'
import {
  getCartridges, getCartridge, createCartridge,
  startMaintenance, finishMaintenance, discardCartridge, getCartridgeEtiqueta,
} from '../services/cartridges'

const STATUSES = ['EM_ESTOQUE', 'EM_USO', 'EM_MANUTENCAO', 'DESCARTADO']
const EMPTY_FORM = { model: '', printerModel: '', initialSector: '' }

const EVENT_ICON = {
  CADASTRO: '📦', INICIO_MANUTENCAO: '🔧', FIM_MANUTENCAO: '✅', DESCARTE: '🗑️',
}

export default function CartridgesPage() {
  const [cartridges, setCartridges] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')

  const [createOpen, setCreateOpen] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  const [detail, setDetail] = useState(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [actionError, setActionError] = useState('')

  const [sectorInput, setSectorInput] = useState('')
  const [notesInput, setNotesInput] = useState('')
  const [discardTarget, setDiscardTarget] = useState(null)
  const [printLoading, setPrintLoading] = useState(false)

  const [scannerOpen, setScannerOpen] = useState(false)
  const [scanError, setScanError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = {}
      if (filterStatus) params.status = filterStatus
      if (search) params.search = search
      setCartridges(await getCartridges(params))
    } finally {
      setLoading(false)
    }
  }, [filterStatus, search])

  useEffect(() => { load() }, [load])

  const openCreate = () => {
    setForm(EMPTY_FORM)
    setFormError('')
    setCreateOpen(true)
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    setSaving(true)
    setFormError('')
    try {
      await createCartridge({
        model: form.model,
        printerModel: form.printerModel || null,
        initialSector: form.initialSector || null,
      })
      setCreateOpen(false)
      load()
    } catch (err) {
      setFormError(err.response?.data?.detail ?? 'Erro ao cadastrar cartucho.')
    } finally {
      setSaving(false)
    }
  }

  const openDetail = async (id) => {
    setDetailOpen(true)
    setDetailLoading(true)
    setActionError('')
    setSectorInput('')
    setNotesInput('')
    try {
      setDetail(await getCartridge(id))
    } catch {
      setActionError('Não foi possível carregar o cartucho.')
    } finally {
      setDetailLoading(false)
    }
  }

  const closeDetail = () => {
    setDetailOpen(false)
    setDetail(null)
    load()
  }

  const handleStartMaintenance = async () => {
    setActionLoading(true)
    setActionError('')
    try {
      const updated = await startMaintenance(detail.cartridge.id, { sector: sectorInput || null })
      setDetail(updated)
      setSectorInput('')
    } catch (err) {
      setActionError(err.response?.data?.detail ?? 'Erro ao iniciar manutenção.')
    } finally {
      setActionLoading(false)
    }
  }

  const handleFinishMaintenance = async () => {
    setActionLoading(true)
    setActionError('')
    try {
      const updated = await finishMaintenance(detail.cartridge.id, { notes: notesInput || null })
      setDetail(updated)
      setNotesInput('')
    } catch (err) {
      setActionError(err.response?.data?.detail ?? 'Erro ao finalizar manutenção.')
    } finally {
      setActionLoading(false)
    }
  }

  const handleDiscard = async () => {
    setActionLoading(true)
    try {
      const updated = await discardCartridge(discardTarget.id, { notes: notesInput || null })
      setDetail(updated)
      setDiscardTarget(null)
      setNotesInput('')
    } catch (err) {
      setActionError(err.response?.data?.detail ?? 'Erro ao descartar cartucho.')
    } finally {
      setActionLoading(false)
    }
  }

  const handlePrint = async (id) => {
    setPrintLoading(true)
    try {
      const blob = await getCartridgeEtiqueta(id)
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank')
      setTimeout(() => URL.revokeObjectURL(url), 10000)
    } catch {
      alert('Erro ao gerar etiqueta. Tente novamente.')
    } finally {
      setPrintLoading(false)
    }
  }

  const handleScanResult = (data) => {
    setScannerOpen(false)
    const match = data.match(/\/cartridges\/([0-9a-fA-F-]{36})/)
    const id = match ? match[1] : null
    if (!id) {
      setScanError('QR code não reconhecido. Tente novamente ou busque pelo nome.')
      return
    }
    setScanError('')
    openDetail(id)
  }

  const f = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.value }))

  const statusLabel = {
    EM_ESTOQUE: 'Em estoque', EM_USO: 'Em uso', EM_MANUTENCAO: 'Em manutenção', DESCARTADO: 'Descartado',
  }

  return (
    <Layout>
      <div className="page fade-up">
        <div className="page-header">
          <div className="page-header-left">
            <h1>Cartuchos de Impressora</h1>
            <p>{cartridges.length} cartucho(s) encontrado(s)</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setScannerOpen(true)} className="btn btn-default">📷 Escanear QR</button>
            <button onClick={openCreate} className="btn btn-primary">+ Novo Cartucho</button>
          </div>
        </div>

        {scanError && (
          <div className="alert alert-red" style={{ marginBottom: 12 }}>
            <p>{scanError}</p>
          </div>
        )}

        <div className="filter-bar">
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por código, modelo ou setor..."
            className="input" style={{ width: 240, height: 32 }}
          />
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="input" style={{ width: 'auto', height: 32 }}>
            <option value="">Todos os status</option>
            {STATUSES.map(s => <option key={s} value={s}>{statusLabel[s]}</option>)}
          </select>
        </div>

        <div className="card" style={{ overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[...Array(5)].map((_, i) => <div key={i} className="skeleton" style={{ height: 36, borderRadius: 6 }} />)}
            </div>
          ) : cartridges.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">🖨️</div>
              <h3>Nenhum cartucho encontrado</h3>
              <p>Clique em "Novo Cartucho" para cadastrar.</p>
            </div>
          ) : (
            <div className="scroll-x">
              <table className="data-table">
                <thead>
                  <tr>
                    {['Código', 'Modelo', 'Impressora', 'Setor atual', 'Status', 'Atualizado em', ''].map(h => (
                      <th key={h}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {cartridges.map(c => (
                    <tr key={c.id}>
                      <td className="mono" style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 600 }}>{c.code}</td>
                      <td style={{ fontWeight: 500 }}>{c.model}</td>
                      <td className="muted">{c.printerModel || '—'}</td>
                      <td className="muted">{c.currentSector || '—'}</td>
                      <td><Badge value={c.status} /></td>
                      <td className="muted">{new Date(c.updatedAt).toLocaleString('pt-BR')}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                          <button onClick={() => openDetail(c.id)} className="btn btn-default btn-sm">Detalhes</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modal de criação */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Novo Cartucho" size="md">
        <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label className="input-label">Modelo do cartucho *</label>
            <input required value={form.model} onChange={f('model')} className="input" placeholder="Ex: HP 664 Preto" />
          </div>
          <div>
            <label className="input-label">Modelo da impressora</label>
            <input value={form.printerModel} onChange={f('printerModel')} className="input" placeholder="Ex: HP DeskJet 2136" />
          </div>
          <div>
            <label className="input-label">Setor inicial (opcional)</label>
            <input value={form.initialSector} onChange={f('initialSector')} className="input" placeholder="Ex: Recepção, Financeiro..." />
          </div>

          {formError && <div className="alert alert-red"><p>{formError}</p></div>}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button type="button" onClick={() => setCreateOpen(false)} className="btn btn-default">Cancelar</button>
            <button type="submit" disabled={saving} className="btn btn-primary">{saving ? 'Salvando...' : 'Cadastrar'}</button>
          </div>
        </form>
      </Modal>

      {/* Modal de detalhe / movimentação */}
      <Modal open={detailOpen} onClose={closeDetail} title={detail ? detail.cartridge.code : 'Carregando...'} size="lg">
        {!detail && detailLoading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[...Array(3)].map((_, i) => <div key={i} className="skeleton" style={{ height: 28, borderRadius: 6 }} />)}
          </div>
        )}
        {!detail && !detailLoading && actionError && (
          <div className="alert alert-red"><p>{actionError}</p></div>
        )}
        {detail && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
              <Badge value={detail.cartridge.status} />
              <span style={{ fontWeight: 600, fontSize: 15 }}>{detail.cartridge.model}</span>
              {detail.cartridge.printerModel && (
                <span className="muted" style={{ fontSize: 13 }}>🖨️ {detail.cartridge.printerModel}</span>
              )}
              {detail.cartridge.currentSector && (
                <span className="muted" style={{ fontSize: 13 }}>📍 {detail.cartridge.currentSector}</span>
              )}
            </div>

            {actionError && <div className="alert alert-red"><p>{actionError}</p></div>}

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              <button onClick={() => handlePrint(detail.cartridge.id)} disabled={printLoading} className="btn btn-default btn-sm">
                {printLoading ? 'Gerando...' : '🏷️ Imprimir etiqueta'}
              </button>

              {detail.cartridge.status !== 'EM_MANUTENCAO' && detail.cartridge.status !== 'DESCARTADO' && (
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input
                    value={sectorInput} onChange={e => setSectorInput(e.target.value)}
                    placeholder="Setor (opcional)" className="input" style={{ width: 160, height: 32 }}
                  />
                  <button onClick={handleStartMaintenance} disabled={actionLoading} className="btn btn-primary btn-sm">
                    🔧 Iniciar manutenção
                  </button>
                </div>
              )}

              {detail.cartridge.status === 'EM_MANUTENCAO' && (
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input
                    value={notesInput} onChange={e => setNotesInput(e.target.value)}
                    placeholder="Observações (opcional)" className="input" style={{ width: 200, height: 32 }}
                  />
                  <button onClick={handleFinishMaintenance} disabled={actionLoading} className="btn btn-primary btn-sm">
                    ✅ Finalizar manutenção
                  </button>
                </div>
              )}

              {detail.cartridge.status !== 'DESCARTADO' && (
                <button onClick={() => setDiscardTarget(detail.cartridge)} className="btn btn-danger btn-sm">
                  🗑️ Descartar
                </button>
              )}
            </div>

            <div>
              <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                Histórico
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {detail.events.map((ev, i) => (
                  <div key={ev.id} style={{ display: 'flex', gap: 10, position: 'relative', paddingBottom: i === detail.events.length - 1 ? 0 : 14 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: '50%', background: 'var(--bg-subtle)',
                        border: '1px solid var(--border-muted)', display: 'flex', alignItems: 'center',
                        justifyContent: 'center', fontSize: 13, flexShrink: 0,
                      }}>
                        {EVENT_ICON[ev.type] ?? '•'}
                      </div>
                      {i !== detail.events.length - 1 && (
                        <div style={{ width: 2, flex: 1, background: 'var(--border-muted)', marginTop: 2 }} />
                      )}
                    </div>
                    <div style={{ paddingTop: 3 }}>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{ev.typeLabel}</div>
                      <div className="muted" style={{ fontSize: 12 }}>
                        {new Date(ev.createdAt).toLocaleString('pt-BR')}
                        {ev.performedByName && ` · ${ev.performedByName}`}
                        {ev.sector && ` · 📍 ${ev.sector}`}
                      </div>
                      {ev.notes && <div style={{ fontSize: 12, marginTop: 2 }}>{ev.notes}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!discardTarget}
        onClose={() => setDiscardTarget(null)}
        onConfirm={handleDiscard}
        loading={actionLoading}
        title="Descartar Cartucho"
        message={`Deseja descartar o cartucho "${discardTarget?.code}"? Esta ação não pode ser desfeita.`}
      />

      <QrScannerModal
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onResult={handleScanResult}
      />
    </Layout>
  )
}
