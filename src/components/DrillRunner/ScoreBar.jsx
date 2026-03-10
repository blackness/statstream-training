export default function ScoreBar({ isQuota, makes, shotsTaken, totalMinShots, makeTarget, overQuota }) {
  const pct = shotsTaken > 0 ? Math.round((makes / shotsTaken) * 100) : 0
  const remaining = (makeTarget ?? 0) - makes
  const progress = isQuota
    ? Math.min((makes / (totalMinShots ?? 1)) * 100, 100)
    : Math.min((makes / (makeTarget ?? 1)) * 100, 100)
  const overColor = overQuota === 0 ? '#4ade80' : overQuota <= 5 ? '#facc15' : '#f87171'

  const stats = isQuota ? [
    { label: 'Shots', value: shotsTaken, color: '#fff' },
    { label: 'Makes', value: makes, color: '#fff' },
    { label: 'FG%', value: `${pct}%`, color: '#fff' },
    { label: 'Over', value: overQuota, color: overColor },
  ] : [
    { label: 'Makes', value: makes, color: '#fff' },
    { label: 'FG%', value: `${pct}%`, color: '#fff' },
    { label: 'Shots', value: shotsTaken, color: '#fff' },
    { label: 'To Go', value: remaining <= 0 ? '✓' : remaining, color: remaining <= 0 ? '#4ade80' : '#f97316' },
  ]

  return (
    <div style={{ background: '#111827', borderRadius: 16, padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        {stats.map(({ label, value, color }) => (
          <div key={label} style={{ textAlign: 'center', flex: 1 }}>
            <div style={{ fontSize: 28, fontWeight: 700, color }}>{value}</div>
            <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>{label}</div>
          </div>
        ))}
      </div>
      <div style={{ background: '#1f2937', borderRadius: 999, height: 6, overflow: 'hidden' }}>
        <div style={{
          height: '100%', width: `${progress}%`,
          background: progress >= 100 ? '#4ade80' : '#f97316',
          borderRadius: 999, transition: 'width 0.3s ease'
        }} />
      </div>
    </div>
  )
}
