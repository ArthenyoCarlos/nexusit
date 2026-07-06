// Zabbix severity levels → design-system tokens (kept distinct from --accent).
export const SEVERITY = {
  5: { label: 'Disaster', color: 'var(--red)',    bg: 'var(--red-bg)',    border: 'var(--red-border)'    },
  4: { label: 'High',     color: 'var(--orange)', bg: 'var(--orange-bg)', border: 'var(--orange-border)' },
  3: { label: 'Average',  color: 'var(--amber)',  bg: 'var(--amber-bg)',  border: 'var(--amber-border)'  },
  2: { label: 'Warning',  color: 'var(--cyan)',   bg: 'var(--cyan-bg)',   border: 'var(--cyan-border)'   },
  1: { label: 'Info',     color: 'var(--text-tertiary)', bg: 'var(--bg-muted)', border: 'var(--border)' },
}

export function severityOf(level) {
  return SEVERITY[level] ?? SEVERITY[1]
}
