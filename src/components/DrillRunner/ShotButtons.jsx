export default function ShotButtons({ onMade, onMissed }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
      <button
        onClick={onMissed}
        style={{
          background: '#1f2937',
          border: '2px solid #374151',
          borderRadius: 20,
          color: '#fff',
          fontSize: 22,
          fontWeight: 700,
          padding: '40px 0',
          cursor: 'pointer',
          transition: 'all 0.1s ease',
          letterSpacing: 0.5
        }}
        onPointerDown={e => e.currentTarget.style.transform = 'scale(0.97)'}
        onPointerUp={e => e.currentTarget.style.transform = 'scale(1)'}
      >
        Miss
      </button>
      <button
        onClick={onMade}
        style={{
          background: 'linear-gradient(135deg, #16a34a, #22c55e)',
          border: '2px solid #16a34a',
          borderRadius: 20,
          color: '#fff',
          fontSize: 22,
          fontWeight: 700,
          padding: '40px 0',
          cursor: 'pointer',
          transition: 'all 0.1s ease',
          letterSpacing: 0.5
        }}
        onPointerDown={e => e.currentTarget.style.transform = 'scale(0.97)'}
        onPointerUp={e => e.currentTarget.style.transform = 'scale(1)'}
      >
        Make
      </button>
    </div>
  )
}