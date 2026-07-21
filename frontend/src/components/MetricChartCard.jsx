import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

export default function MetricChartCard({ title, valueLabel, color, data, series, yDomain, yFormatter, note }) {
  return (
    <div className="card" style={{ padding: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: note ? 2 : 6 }}>
        <p className="label-caps" style={{ margin: 0 }}>{title}</p>
        {valueLabel && <span style={{ fontSize: 15, fontWeight: 700, fontFamily: 'var(--font-mono)', color }}>{valueLabel}</span>}
      </div>
      {note && <p style={{ fontSize: 10, color: 'var(--text-tertiary)', margin: '0 0 6px' }}>{note}</p>}
      {data.length > 0 ? (
        <ResponsiveContainer width="100%" height={100}>
          <LineChart data={data} margin={{ top: 2, right: 2, left: -24, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-muted)" />
            <XAxis dataKey="time" tick={{ fontSize: 9, fill: 'var(--text-tertiary)' }} interval="preserveStartEnd" minTickGap={24} />
            <YAxis domain={yDomain} tick={{ fontSize: 9, fill: 'var(--text-tertiary)' }} tickFormatter={yFormatter} width={30} />
            <Tooltip
              contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-surface)', boxShadow: 'var(--shadow-md)', color: 'var(--text-primary)' }}
              formatter={(v, name) => [yFormatter ? yFormatter(v) : v, series.find(s => s.dataKey === name)?.label ?? name]}
            />
            {series.map(s => (
              <Line key={s.dataKey} type="monotone" dataKey={s.dataKey} stroke={s.color} strokeDasharray={s.strokeDasharray} dot={false} strokeWidth={s.strokeWidth ?? 1.6} connectNulls />
            ))}
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <p style={{ fontSize: 11.5, color: 'var(--text-tertiary)', textAlign: 'center', padding: '24px 0' }}>Sem dados de histórico.</p>
      )}
    </div>
  )
}
