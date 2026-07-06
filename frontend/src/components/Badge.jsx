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
}

const LABELS = {
  ACTIVE: 'Ativo', INACTIVE: 'Inativo', MAINTENANCE: 'Manutenção',
  ERP: 'ERP', CRM: 'CRM', INTERNO: 'Interno', CLOUD: 'Cloud',
  MONITORAMENTO: 'Monitoramento', OUTRO: 'Outro',
  COMPUTADOR: 'Computador', SERVIDOR: 'Servidor', SWITCH: 'Switch',
  ROTEADOR: 'Roteador', IMPRESSORA: 'Impressora', NOBREAK: 'Nobreak',
}

export default function Badge({ value }) {
  const cls = COLORS[value] ?? 'badge-gray'
  return (
    <span className={`badge ${cls}`}>
      {LABELS[value] ?? value}
    </span>
  )
}
