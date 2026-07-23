const COLORS = {
  // status sistema
  ACTIVE:      'badge-green',
  INACTIVE:    'badge-gray',
  MAINTENANCE: 'badge-amber',
  // categorias
  ERP:          'badge-blue',
  CRM:          'badge-purple',
  INTERNO:      'badge-cyan',
  CLOUD:        'badge-red',
  MONITORAMENTO:'badge-orange',
  OUTRO:        'badge-gray',
  // tipos inventário
  COMPUTADOR:   'badge-blue',
  SERVIDOR:     'badge-purple',
  SWITCH:       'badge-cyan',
  ROTEADOR:     'badge-amber',
  IMPRESSORA:   'badge-red',
  NOBREAK:      'badge-orange',
  MONITOR:      'badge-blue',
  DVR:          'badge-purple',
  COLETOR:      'badge-cyan',
  UNIFI:        'badge-green',
  // status cartucho
  EM_ESTOQUE:    'badge-blue',
  EM_USO:        'badge-green',
  EM_MANUTENCAO: 'badge-amber',
  DESCARTADO:    'badge-gray',
}

const LABELS = {
  ACTIVE: 'Ativo', INACTIVE: 'Inativo', MAINTENANCE: 'Manutenção',
  ERP: 'ERP', CRM: 'CRM', INTERNO: 'Interno', CLOUD: 'Cloud',
  MONITORAMENTO: 'Monitoramento', OUTRO: 'Outro',
  COMPUTADOR: 'Computador', SERVIDOR: 'Servidor', SWITCH: 'Switch',
  ROTEADOR: 'Roteador', IMPRESSORA: 'Impressora', NOBREAK: 'Nobreak',
  MONITOR: 'Monitor', DVR: 'DVR', COLETOR: 'Coletor', UNIFI: 'UniFi',
  EM_ESTOQUE: 'Em estoque', EM_USO: 'Em uso', EM_MANUTENCAO: 'Em manutenção', DESCARTADO: 'Descartado',
}

export default function Badge({ value }) {
  const cls = COLORS[value] ?? 'badge-gray'
  return (
    <span className={`badge ${cls}`}>
      {LABELS[value] ?? value}
    </span>
  )
}
