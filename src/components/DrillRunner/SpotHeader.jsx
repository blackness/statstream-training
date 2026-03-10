export default function SpotHeader({ spot, spotIndex, totalSpots, round, totalRounds, repIndex }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{
        display: 'inline-block',
        background: '#1f2937',
        borderRadius: 999,
        padding: '4px 14px',
        fontSize: 12,
        color: '#9ca3af',
        marginBottom: 16
      }}>
        Round {round} of {totalRounds}
      </div>
      <div style={{ fontSize: 42, fontWeight: 800, color: '#fff', letterSpacing: -1 }}>
        {spot.label}
      </div>
      <div style={{ fontSize: 13, color: '#6b7280', marginTop: 8 }}>
        Spot {spotIndex + 1} of {totalSpots}
        <span style={{ margin: '0 8px', color: '#374151' }}>·</span>
        Rep {repIndex + 1} of {spot.reps}
      </div>
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        gap: 6,
        marginTop: 16
      }}>
        {Array.from({ length: totalSpots }).map((_, i) => (
          <div key={i} style={{
            width: i === spotIndex ? 24 : 8,
            height: 8,
            borderRadius: 999,
            background: i < spotIndex ? '#4ade80' : i === spotIndex ? '#f97316' : '#1f2937',
            transition: 'all 0.3s ease'
          }} />
        ))}
      </div>
    </div>
  )
}