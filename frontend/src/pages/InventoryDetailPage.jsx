import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import Layout from '../components/Layout'
import Badge from '../components/Badge'
import { getInventoryItem, getEtiqueta } from '../services/inventory'
import { getMaintenance, createMaintenance, deleteMaintenance } from '../services/maintenance'
import { getHosts } from '../services/monitoring'
import { getNexusDeskDevices, connectNexusDeskDevice } from '../services/nexusdesk'
import { buildRustDeskUri } from '../utils/rustdesk'
import { useAuth } from '../contexts/AuthContext'

function QrCode({ value, size = 160 }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    if (!canvasRef.current || !value) return
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    canvas.width = size
    canvas.height = size

    // Simple QR placeholder: encode value as a URL to a QR generator image
    // Using an inline approach: draw checkerboard pattern as placeholder,
    // and render the actual QR via an img tag approach
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => ctx.drawImage(img, 0, 0, size, size)
    img.onerror = () => {
      ctx.fillStyle = '#f8fafc'
      ctx.fillRect(0, 0, size, size)
      ctx.fillStyle = '#94a3b8'
      ctx.font = '11px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('QR Code', size / 2, size / 2)
    }
  }, [value, size])

  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(value)}`

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      <img
        src={qrUrl}
        alt="QR Code"
        width={size}
        height={size}
        style={{ borderRadius: 8, border: '1px solid var(--border-muted)' }}
      />
      <p style={{ fontSize: 11, color: 'var(--text-tertiary)', textAlign: 'center', maxWidth: size, wordBreak: 'break-all' }}>
        {value}
      </p>
      <a
        href={qrUrl}
        download="qrcode.png"
        target="_blank"
        rel="noopener noreferrer"
        className="btn btn-default btn-sm"
      >
        Baixar QR Code
      </a>
    </div>
  )
}

const TYPE_ICON = {
  COMPUTADOR: '🖥️', SERVIDOR: '🖥️', SWITCH: '🔀', ROTEADOR: '📡',
  IMPRESSORA: '🖨️', NOBREAK: '🔋', OUTRO: '📦',
}

export default function InventoryDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const isAdmin = user?.role === 'ADMIN'

  const [item, setItem]           = useState(null)
  const [hosts, setHosts]         = useState([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState('')
  const [printLoading, setPrintLoading] = useState(false)

  const [records, setRecords]     = useState([])
  const [mForm, setMForm]         = useState({ title: '', description: '', performedAt: '', cost: '' })
  const [mSaving, setMSaving]     = useState(false)
  const [mOpen, setMOpen]         = useState(false)

  const [nexusDeskDevice, setNexusDeskDevice] = useState(null)
  const [connecting, setConnecting] = useState(false)

  useEffect(() => {
    setLoading(true)
    Promise.allSettled([getInventoryItem(id), getHosts(), getMaintenance(id)])
      .then(([itemRes, hostsRes, mRes]) => {
        if (itemRes.status === 'fulfilled') setItem(itemRes.value)
        else setError('Item não encontrado.')
        if (hostsRes.status === 'fulfilled') setHosts(hostsRes.value?.data ?? [])
        if (mRes.status === 'fulfilled') setRecords(mRes.value)
      })
      .finally(() => setLoading(false))
  }, [id])

  useEffect(() => {
    if (!isAdmin) return
    getNexusDeskDevices()
      .then(devices => setNexusDeskDevice(devices.find(d => d.inventoryItemId === id) ?? null))
      .catch(() => setNexusDeskDevice(null))
  }, [id, isAdmin])

  const handleNexusDeskConnect = async () => {
    if (!nexusDeskDevice) return
    setConnecting(true)
    try {
      const { rustdeskId, password } = await connectNexusDeskDevice(nexusDeskDevice.id)
      window.location.href = buildRustDeskUri(rustdeskId, password)
    } finally { setConnecting(false) }
  }

  const handleAddMaintenance = async (e) => {
    e.preventDefault(); setMSaving(true)
    try {
      const payload = { title: mForm.title, description: mForm.description || null, performedAt: mForm.performedAt, cost: mForm.cost !== '' ? parseFloat(mForm.cost) : null }
      const rec = await createMaintenance(id, payload)
      setRecords(r => [rec, ...r])
      setMForm({ title: '', description: '', performedAt: '', cost: '' })
      setMOpen(false)
    } finally { setMSaving(false) }
  }

  const handleDeleteMaintenance = async (recId) => {
    await deleteMaintenance(id, recId)
    setRecords(r => r.filter(x => x.id !== recId))
  }

  const zabbixHost = item
    ? hosts.find(h => h.name?.toLowerCase() === item.name?.toLowerCase() || h.ip === item.ip)
    : null

  const statusLabel = { ACTIVE: 'Ativo', INACTIVE: 'Inativo', MAINTENANCE: 'Manutenção' }
  const typeLabel   = {
    COMPUTADOR: 'Computador', SERVIDOR: 'Servidor', SWITCH: 'Switch',
    ROTEADOR: 'Roteador', IMPRESSORA: 'Impressora', NOBREAK: 'Nobreak', OUTRO: 'Outro',
  }

  const handlePrint = async () => {
    setPrintLoading(true)
    try {
      const blob = await getEtiqueta(id)
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank')
      setTimeout(() => URL.revokeObjectURL(url), 10000)
    } catch {
      alert('Erro ao gerar etiqueta. Tente novamente.')
    } finally {
      setPrintLoading(false)
    }
  }

  function formatUptime(seconds) {
    if (!seconds) return null
    const d = Math.floor(seconds / 86400)
    const h = Math.floor((seconds % 86400) / 3600)
    return d > 0 ? `${d}d ${h}h` : `${h}h`
  }

  if (loading) return (
    <Layout>
      <div className="page fade-up">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[...Array(4)].map((_, i) => <div key={i} className="skeleton" style={{ height: 60, borderRadius: 8 }} />)}
        </div>
      </div>
    </Layout>
  )

  if (error || !item) return (
    <Layout>
      <div className="page">
        <button onClick={() => navigate(-1)} className="btn btn-default btn-sm" style={{ marginBottom: 16 }}>← Voltar</button>
        <div className="card empty-state"><h3>{error || 'Item não encontrado.'}</h3></div>
      </div>
    </Layout>
  )

  const qrValue = `${window.location.origin}/inventory/${item.id}`

  return (
    <Layout>
      <div className="page fade-up">
        {/* Header */}
        <div className="page-header">
          <div className="page-header-left">
            <button onClick={() => navigate(-1)} className="btn btn-default btn-sm" style={{ marginBottom: 8 }}>← Voltar</button>
            <h1 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span>{TYPE_ICON[item.type] || '📦'}</span>
              {item.name}
              <Badge value={item.status} />
            </h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
              <Badge value={item.type} />
              {item.tombamento && (
                <span style={{
                  fontFamily: 'monospace', fontSize: 13, fontWeight: 700,
                  color: 'var(--accent)', background: 'var(--accent-subtle)',
                  padding: '2px 8px', borderRadius: 6,
                }}>
                  {item.tombamento}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={handlePrint}
            disabled={printLoading}
            className="btn btn-primary"
          >
            {printLoading ? 'Gerando...' : 'Gerar Etiqueta PDF'}
          </button>
        </div>

        <div className="inventory-detail-grid">

          {/* Especificações */}
          <div className="card" style={{ padding: '20px 24px' }}>
            <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 16 }}>Especificações</h3>
            <dl style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                ['Tombamento', item.tombamento ? <span key="tomb" className="mono" style={{ color: 'var(--accent)', fontWeight: 700 }}>{item.tombamento}</span> : '—'],
                ['Tipo', typeLabel[item.type] ?? item.type],
                ['Marca', item.brand || '—'],
                ['Modelo', item.model || '—'],
                ['Número de Série', item.serialNumber ? <span key="sn" className="mono">{item.serialNumber}</span> : '—'],
                ['Localização', item.location || '—'],
                ['Responsável', item.responsible?.name ?? '—'],
                ['Data de Compra', item.purchaseDate ? new Date(item.purchaseDate + 'T00:00:00').toLocaleDateString('pt-BR') : '—'],
                ['Garantia até', item.warrantyUntil ? new Date(item.warrantyUntil + 'T00:00:00').toLocaleDateString('pt-BR') : '—'],
                ['Valor', item.value != null ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.value) : '—'],
                ['Status', <Badge key="st" value={item.status} />],
              ].map(([label, value]) => (
                <div key={label} style={{ display: 'flex', gap: 8 }}>
                  <dt style={{ fontSize: 12.5, color: 'var(--text-tertiary)', minWidth: 140, flexShrink: 0 }}>{label}</dt>
                  <dd style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>{value}</dd>
                </div>
              ))}
            </dl>
          </div>

          {/* QR Code */}
          <div className="card" style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 20, alignSelf: 'flex-start' }}>Identificação Física</h3>
            <QrCode value={qrValue} size={160} />
          </div>

          {/* Status Zabbix */}
          <div className="card" style={{ padding: '20px 24px' }}>
            <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 16 }}>Status Zabbix</h3>
            {!zabbixHost ? (
              <p style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>Nenhum host Zabbix encontrado para este equipamento.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 10, height: 10, borderRadius: '50%',
                    background: zabbixHost.available ? 'var(--success)' : 'var(--danger)',
                  }} />
                  <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                    {zabbixHost.available ? 'Online' : 'Offline'}
                  </span>
                </div>
                {zabbixHost.ip && (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <span style={{ fontSize: 12.5, color: 'var(--text-tertiary)', minWidth: 100 }}>IP</span>
                    <span className="mono" style={{ fontSize: 13 }}>{zabbixHost.ip}</span>
                  </div>
                )}
                {zabbixHost.uptimeSeconds != null && (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <span style={{ fontSize: 12.5, color: 'var(--text-tertiary)', minWidth: 100 }}>Uptime</span>
                    <span style={{ fontSize: 13, fontWeight: 500 }}>{formatUptime(zabbixHost.uptimeSeconds)}</span>
                  </div>
                )}
                {zabbixHost.cpuPercent != null && (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <span style={{ fontSize: 12.5, color: 'var(--text-tertiary)', minWidth: 100 }}>CPU</span>
                    <span style={{ fontSize: 13, fontWeight: 500 }}>{zabbixHost.cpuPercent.toFixed(1)}%</span>
                  </div>
                )}
                {zabbixHost.memPercent != null && (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <span style={{ fontSize: 12.5, color: 'var(--text-tertiary)', minWidth: 100 }}>Memória</span>
                    <span style={{ fontSize: 13, fontWeight: 500 }}>{zabbixHost.memPercent.toFixed(1)}%</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* NexusDesk */}
          {isAdmin && (
            <div className="card" style={{ padding: '20px 24px' }}>
              <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 16 }}>NexusDesk</h3>
              {!nexusDeskDevice ? (
                <div>
                  <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 10 }}>Nenhuma máquina NexusDesk vinculada a este equipamento.</p>
                  <Link to="/nexusdesk" className="btn btn-default btn-sm">Cadastrar no NexusDesk</Link>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{nexusDeskDevice.name}</p>
                    <p style={{ fontSize: 12.5, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>ID {nexusDeskDevice.rustdeskId}</p>
                  </div>
                  <button onClick={handleNexusDeskConnect} disabled={connecting} className="btn btn-primary btn-sm">
                    {connecting ? 'Conectando...' : 'Conectar'}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Observações */}
          {item.notes && (
            <div className="card" style={{ padding: '20px 24px' }}>
              <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>Observações</h3>
              <p style={{ fontSize: 13.5, color: 'var(--text-primary)', lineHeight: 1.7 }}>{item.notes}</p>
            </div>
          )}

          {/* Histórico de Manutenção */}
          <div className="card" style={{ padding: '20px 24px', gridColumn: '1 / -1' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Histórico de Manutenção</h3>
              <button onClick={() => setMOpen(o => !o)} className="btn btn-default btn-sm">+ Registrar</button>
            </div>

            {mOpen && (
              <form onSubmit={handleAddMaintenance} style={{ background: 'var(--bg-muted)', borderRadius: 10, padding: '16px', marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div className="form-grid-2" style={{ gap: 10 }}>
                  <div style={{ gridColumn: '1/-1' }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Título *</label>
                    <input required value={mForm.title} onChange={e => setMForm(f => ({...f, title: e.target.value}))} className="input" style={{ marginTop: 4 }} placeholder="Ex: Troca de HD" />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Data *</label>
                    <input required type="date" value={mForm.performedAt} onChange={e => setMForm(f => ({...f, performedAt: e.target.value}))} className="input" style={{ marginTop: 4 }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Custo (R$)</label>
                    <input type="number" step="0.01" value={mForm.cost} onChange={e => setMForm(f => ({...f, cost: e.target.value}))} className="input" style={{ marginTop: 4 }} placeholder="0,00" />
                  </div>
                  <div style={{ gridColumn: '1/-1' }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Descrição</label>
                    <textarea value={mForm.description} onChange={e => setMForm(f => ({...f, description: e.target.value}))} className="input" rows={2} style={{ marginTop: 4, resize: 'none' }} />
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                  <button type="button" onClick={() => setMOpen(false)} className="btn btn-default btn-sm">Cancelar</button>
                  <button type="submit" disabled={mSaving} className="btn btn-primary btn-sm">{mSaving ? 'Salvando...' : 'Salvar'}</button>
                </div>
              </form>
            )}

            {records.length === 0 ? (
              <p style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>Nenhuma manutenção registrada.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {records.map(r => (
                  <div key={r.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '10px 14px', background: 'var(--bg-muted)', borderRadius: 8 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <p style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>{r.title}</p>
                        <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{new Date(r.performedAt + 'T00:00').toLocaleDateString('pt-BR')}</span>
                        {r.cost != null && <span style={{ fontSize: 12, color: 'var(--accent)' }}>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(r.cost)}</span>}
                      </div>
                      {r.description && <p style={{ fontSize: 12.5, color: 'var(--text-tertiary)', marginTop: 4 }}>{r.description}</p>}
                      {r.performedBy && <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>Por {r.performedBy}</p>}
                    </div>
                    {isAdmin && <button onClick={() => handleDeleteMaintenance(r.id)} className="btn btn-danger btn-sm" style={{ flexShrink: 0 }}>✕</button>}
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
