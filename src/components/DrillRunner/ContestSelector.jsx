const levels = [
  { key: 'open', label: 'Open', color: '#4ade80' },
  { key: 'light', label: 'Light', color: '#facc15' },
  { key: 'contested', label: 'Contested', color: '#f87171' },
]

export default function ContestSelector({ value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
      {levels.map(({ key, label, color }) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          style={{
            padding: '8px 18px',
            borderRadius: 999,
            border: value === key ? `2px solid ${color}` : '2px solid #1f2937',
            background: value === key ? `${color}22` : '#111827',
            color: value === key ? color : '#6b7280',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          {label}
        </button>
      ))}
    </div>
  )
}