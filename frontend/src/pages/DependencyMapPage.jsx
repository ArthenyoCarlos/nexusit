import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import Layout from '../components/Layout'
import Badge from '../components/Badge'
import { getSystems } from '../services/systems'
import { getAllInventory } from '../services/inventory'

export default function DependencyMapPage() {
  const [systems, setSystems] = useState([])
  const [inventory, setInventory] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([getSystems(), getAllInventory()])
      .then(([sys, inv]) => { setSystems(sys); setInventory(inv) })
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <Layout>
        <div className="page fade-up">
          <div className="page-header"><div className="page-header-left"><h1>Mapa de Dependências</h1><p>Sistemas e os servidores/ativos dos quais dependem</p></div></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[...Array(3)].map((_, i) => <div key={i} className="skeleton" style={{ height: 110, borderRadius: 'var(--r-lg)' }} />)}
          </div>
        </div>
      </Layout>
    )
  }

  const inventoryById = new Map(inventory.map(i => [i.id, i]))
  const groups = new Map()
  const orphanSystems = []

  systems.forEach(s => {
    if (!s.server) { orphanSystems.push(s); return }
    if (!groups.has(s.server.id)) groups.set(s.server.id, [])
    groups.get(s.server.id).push(s)
  })

  const serverGroups = [...groups.entries()]
    .map(([serverId, sysList]) => ({ server: inventoryById.get(serverId), serverId, systems: sysList }))
    .sort((a, b) => (a.server?.name ?? '').localeCompare(b.server?.name ?? ''))

  return (
    <Layout>
      <div className="page fade-up">
        <div className="page-header">
          <div className="page-header-left">
            <h1>Mapa de Dependências</h1>
            <p>{serverGroups.length} servidor(es)/ativo(s) com sistemas dependentes · {orphanSystems.length} sistema(s) sem servidor definido</p>
          </div>
        </div>

        {serverGroups.length === 0 && orphanSystems.length === 0 ? (
          <div className="card empty-state">
            <div className="empty-state-icon">🗺️</div>
            <h3>Nenhum sistema cadastrado</h3>
            <p>Cadastre sistemas e vincule um servidor/ativo pra ver as dependências aqui.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {serverGroups.map(({ server, serverId, systems: sysList }) => (
              <div key={serverId} className="card" style={{ padding: '18px 20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, paddingBottom: 12, borderBottom: '1px solid var(--border-muted)' }}>
                  <span style={{ fontSize: 20 }}>🖥️</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Link to={`/inventory/${serverId}`} style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)', textDecoration: 'none' }}>
                      {server?.name ?? '(ativo removido)'}
                    </Link>
                    {server?.location && <p style={{ fontSize: 11.5, color: 'var(--text-tertiary)' }}>{server.location}</p>}
                  </div>
                  {server && <Badge value={server.status} />}
                  <span className="badge bg-[var(--bg-muted)] text-[var(--text-secondary)]">{sysList.length} sistema(s)</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
                  {sysList.map(s => (
                    <Link key={s.id} to={`/systems/${s.id}`}
                      className="card-hover"
                      style={{ display: 'block', padding: '10px 14px', borderRadius: 'var(--r-md)', border: '1px solid var(--border-muted)', textDecoration: 'none' }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>{s.name}</p>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <Badge value={s.category} />
                        <Badge value={s.status} />
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            ))}

            {orphanSystems.length > 0 && (
              <div className="card" style={{ padding: '18px 20px' }}>
                <p className="label-caps" style={{ marginBottom: 12 }}>Sistemas sem servidor definido</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
                  {orphanSystems.map(s => (
                    <Link key={s.id} to={`/systems/${s.id}`}
                      className="card-hover"
                      style={{ display: 'block', padding: '10px 14px', borderRadius: 'var(--r-md)', border: '1px solid var(--border-muted)', textDecoration: 'none' }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>{s.name}</p>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <Badge value={s.category} />
                        <Badge value={s.status} />
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  )
}
