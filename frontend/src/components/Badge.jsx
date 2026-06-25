const COLORS = {
  // status sistema
  ACTIVE:      'bg-green-100 text-green-800',
  INACTIVE:    'bg-slate-100 text-slate-600',
  MAINTENANCE: 'bg-yellow-100 text-yellow-800',
  // categorias
  ERP:          'bg-blue-100 text-blue-800',
  CRM:          'bg-purple-100 text-purple-800',
  INTERNO:      'bg-teal-100 text-teal-800',
  CLOUD:        'bg-sky-100 text-sky-800',
  MONITORAMENTO:'bg-orange-100 text-orange-800',
  OUTRO:        'bg-slate-100 text-slate-600',
  // tipos inventário
  COMPUTADOR:   'bg-blue-100 text-blue-800',
  SERVIDOR:     'bg-violet-100 text-violet-800',
  SWITCH:       'bg-cyan-100 text-cyan-800',
  ROTEADOR:     'bg-indigo-100 text-indigo-800',
  IMPRESSORA:   'bg-pink-100 text-pink-800',
  NOBREAK:      'bg-amber-100 text-amber-800',
}

const LABELS = {
  ACTIVE: 'Ativo', INACTIVE: 'Inativo', MAINTENANCE: 'Manutenção',
  ERP: 'ERP', CRM: 'CRM', INTERNO: 'Interno', CLOUD: 'Cloud',
  MONITORAMENTO: 'Monitoramento', OUTRO: 'Outro',
  COMPUTADOR: 'Computador', SERVIDOR: 'Servidor', SWITCH: 'Switch',
  ROTEADOR: 'Roteador', IMPRESSORA: 'Impressora', NOBREAK: 'Nobreak',
}

export default function Badge({ value }) {
  const cls = COLORS[value] ?? 'bg-slate-100 text-slate-600'
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${cls}`}>
      {LABELS[value] ?? value}
    </span>
  )
}
