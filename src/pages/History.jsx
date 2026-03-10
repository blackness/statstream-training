import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'

// Tiny sparkline / line chart — no dependencies
function LineChart({ data, isQuota, color = '#f97316' }) {
  const width = 280
  const height = 80
  const pad = 8

  if (!data || data.length < 2) {
    return (
      <div style={{ width, height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: 12, color: '#4b5563' }}>Not enough data</span>
      </div>
    )
  }

  const values = data.map(d => d.value)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1

  const points = data.map((d, i) => {
    const x = pad + (i / (data.length - 1)) * (width - pad * 2)
    // For quota: lower is better, so invert y
    const normalized = isQuota
      ? 1 - (d.value - min) / range
      : (d.value - min) / range
    const y = pad + (1 - normalized) * (height - pad * 2)
    return { x, y, ...d }
  })

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
  const areaD = `${pathD} L ${points[points.length - 1].x} ${height} L ${points[0].x} ${height} Z`

  return (
    <svg width={width} height={height} style={{ overflow: 'visible' }}>
      <defs>
        <linearGradient id={`grad-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaD} fill={`url(#grad-${color.replace('#', '')})`} />
      <path d={pathD} stroke={color} strokeWidth="2" fill="none" strokeLinejoin="round" strokeLinecap="round" />
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="3" fill={color} />
      ))}
    </svg>
  )
}

function DrillHistoryDrawer({ drill, playerId, onClose }) {
  const [attempts, setAttempts] = useState([])
  const [loading, setLoading] = useState(true)
  const isQuota = drill.drill_type === 'quota'

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('drill_attempts')
        .select('*')
        .eq('drill_id', drill.id)
        .eq('player_id', playerId)
        .not('completed_at', 'is', null)
        .order('completed_at', { ascending: true })
      setAttempts(data ?? [])
      setLoading(false)
    }
    load()
  }, [drill.id, playerId])

  const scores = attempts.map(a => ({
    value: isQuota ? a.total_reps : a.score,
    date: new Date(a.completed_at)
  }))

  const bestScore = isQuota
    ? Math.min(...scores.map(s => s.value))
    : Math.max(...scores.map(s => s.value))

  const last30 = scores.filter(s => {
    const days = (Date.now() - s.date) / (1000 * 60 * 60 * 24)
    return days <= 30
  })
  const avg30 = last30.length > 0
    ? Math.round(last30.reduce((sum, s) => sum + s.value, 0) / last30.length)
    : null

  const overlay = {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
    display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 50
  }
  const drawer = {
    background: '#0d1117', borderRadius: '20px 20px 0 0',
    width: '100%', maxWidth: 600, maxHeight: '85vh',
    overflowY: 'auto', padding: 24, boxSizing: 'border-box'
  }

  return (
    <div style={overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={drawer}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <h2 style={{ color: '#fff', fontSize: 20, fontWeight: 700, margin: 0 }}>{drill.name}</h2>
            <span style={{ fontSize: 12, color: '#6b7280' }}>
              {isQuota ? '✅ Quota drill' : '🎯 Fixed drill'}
            </span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#6b7280', fontSize: 22, cursor: 'pointer' }}>✕</button>
        </div>

        {loading ? (
          <p style={{ color: '#4b5563', textAlign: 'center', marginTop: 40 }}>Loading...</p>
        ) : attempts.length === 0 ? (
          <p style={{ color: '#4b5563', textAlign: 'center', marginTop: 40 }}>No attempts yet</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* Stats row */}
            <div style={{ display: 'flex', gap: 12 }}>
              {[
                {
                  label: isQuota ? 'Best (fewest shots)' : 'Best Score',
                  value: scores.length > 0 ? bestScore : '—',
                  color: '#4ade80'
                },
                {
                  label: 'Avg (30 days)',
                  value: avg30 ?? '—',
                  color: '#f97316'
                },
                {
                  label: 'Attempts',
                  value: attempts.length,
                  color: '#fff'
                },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ flex: 1, background: '#111827', borderRadius: 12, padding: '12px 8px', textAlign: 'center' }}>
                  <div style={{ fontSize: 24, fontWeight: 700, color }}>{value}</div>
                  <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>{label}</div>
                </div>
              ))}
            </div>

            {/* Chart */}
            {scores.length >= 2 && (
              <div style={{ background: '#111827', borderRadius: 12, padding: 16 }}>
                <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 12 }}>
                  {isQuota ? 'Total shots taken (lower = better)' : 'Makes over time'}
                </div>
                <LineChart data={scores} isQuota={isQuota} />
              </div>
            )}

            {/* Attempt list */}
            <div>
              <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>All Attempts</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[...attempts].reverse().map(a => {
                  const pct = a.total_reps > 0 ? Math.round((a.score / a.total_reps) * 100) : 0
                  const displayScore = isQuota ? a.total_reps : a.score
                  const displayLabel = isQuota ? 'shots' : `/ ${a.total_reps}`
                  return (
                    <div key={a.id} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      background: '#111827', borderRadius: 10, padding: '10px 14px'
                    }}>
                      <div>
                        <div style={{ fontSize: 14, color: '#fff', fontWeight: 600 }}>
                          {displayScore} {displayLabel}
                          {!isQuota && <span style={{ fontSize: 12, color: '#6b7280', marginLeft: 6 }}>{pct}%</span>}
                        </div>
                        <div style={{ fontSize: 12, color: '#4b5563', marginTop: 2 }}>
                          {new Date(a.completed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </div>
                      </div>
                      <div style={{
                        fontSize: 12, fontWeight: 600, padding: '4px 10px',
                        borderRadius: 999,
                        background: a.passed ? '#14532d' : '#1f2937',
                        color: a.passed ? '#4ade80' : '#6b7280'
                      }}>
                        {a.passed ? 'Pass' : 'Miss'}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function History() {
  const { user, profile, isCoach } = useAuth()
  const navigate = useNavigate()
  const [drills, setDrills] = useState([])
  const [players, setPlayers] = useState([])
  const [selectedPlayer, setSelectedPlayer] = useState(null)
  const [summaries, setSummaries] = useState({})
  const [loading, setLoading] = useState(true)
  const [selectedDrill, setSelectedDrill] = useState(null)

  const viewingId = selectedPlayer ?? user.id

  useEffect(() => {
    if (isCoach) loadPlayers()
  }, [isCoach])

  useEffect(() => {
    loadHistory()
  }, [viewingId])

  async function loadPlayers() {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .eq('team_id', profile?.team_id)
      .eq('role', 'player')
      .order('full_name')
    setPlayers(data ?? [])
  }

  async function loadHistory() {
    setLoading(true)

    // Get all attempts for this player
    const { data: attempts } = await supabase
      .from('drill_attempts')
      .select('drill_id, score, total_reps, completed_at, passed')
      .eq('player_id', viewingId)
      .not('completed_at', 'is', null)
      .order('completed_at', { ascending: false })

    if (!attempts?.length) { setLoading(false); setDrills([]); return }

    // Get unique drill ids
    const drillIds = [...new Set(attempts.map(a => a.drill_id))]

    const { data: drillData } = await supabase
      .from('drills')
      .select('*')
      .in('id', drillIds)

    // Build summary per drill
    const summaryMap = {}
    drillIds.forEach(id => {
      const drill = drillData?.find(d => d.id === id)
      if (!drill) return
      const drillAttempts = attempts.filter(a => a.drill_id === id)
      const isQuota = drill.drill_type === 'quota'
      const scores = drillAttempts.map(a => isQuota ? a.total_reps : a.score)
      const last30 = drillAttempts.filter(a => {
        const days = (Date.now() - new Date(a.completed_at)) / (1000 * 60 * 60 * 24)
        return days <= 30
      })
      const avg30scores = last30.map(a => isQuota ? a.total_reps : a.score)

      summaryMap[id] = {
        attempts: drillAttempts.length,
        best: isQuota ? Math.min(...scores) : Math.max(...scores),
        avg30: avg30scores.length > 0
          ? Math.round(avg30scores.reduce((a, b) => a + b, 0) / avg30scores.length)
          : null,
        lastAttempt: drillAttempts[0],
        recentScores: [...drillAttempts].reverse().slice(-8).map(a => ({
          value: isQuota ? a.total_reps : a.score,
          date: new Date(a.completed_at)
        }))
      }
    })

    setDrills(drillData ?? [])
    setSummaries(summaryMap)
    setLoading(false)
  }

  return (
    <div style={{ minHeight: '100dvh', background: '#030712', padding: 20, boxSizing: 'border-box' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <button onClick={() => navigate('/')} style={{
            background: 'none', border: 'none', color: '#6b7280',
            fontSize: 13, cursor: 'pointer', padding: 0, marginBottom: 4
          }}>← Today</button>
          <h1 style={{ color: '#fff', fontSize: 24, fontWeight: 800, margin: 0 }}>History</h1>
        </div>
      </div>

      {/* Coach player selector */}
      {isCoach && players.length > 0 && (
        <div style={{ marginBottom: 16, overflowX: 'auto' }}>
          <div style={{ display: 'flex', gap: 8, paddingBottom: 4 }}>
            <button
              onClick={() => setSelectedPlayer(null)}
              style={{
                padding: '6px 14px', borderRadius: 999, border: 'none', whiteSpace: 'nowrap',
                background: selectedPlayer === null ? '#f97316' : '#111827',
                color: selectedPlayer === null ? '#fff' : '#6b7280',
                fontSize: 13, fontWeight: 600, cursor: 'pointer'
              }}
            >
              My History
            </button>
            {players.map(p => (
              <button
                key={p.id}
                onClick={() => setSelectedPlayer(p.id)}
                style={{
                  padding: '6px 14px', borderRadius: 999, border: 'none', whiteSpace: 'nowrap',
                  background: selectedPlayer === p.id ? '#f97316' : '#111827',
                  color: selectedPlayer === p.id ? '#fff' : '#6b7280',
                  fontSize: 13, fontWeight: 600, cursor: 'pointer'
                }}
              >
                {p.full_name || p.email}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Drill history cards */}
      {loading ? (
        <p style={{ color: '#4b5563', textAlign: 'center', marginTop: 60 }}>Loading...</p>
      ) : drills.length === 0 ? (
        <div style={{ textAlign: 'center', marginTop: 60 }}>
          <p style={{ color: '#4b5563' }}>No attempts yet</p>
          <button onClick={() => navigate('/library')} style={{
            background: '#f97316', border: 'none', borderRadius: 10,
            color: '#fff', fontSize: 14, fontWeight: 700,
            padding: '12px 24px', cursor: 'pointer', marginTop: 12
          }}>Go to Drill Library</button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {drills.map(drill => {
            const s = summaries[drill.id]
            if (!s) return null
            const isQuota = drill.drill_type === 'quota'
            return (
              <div
                key={drill.id}
                onClick={() => setSelectedDrill(drill)}
                style={{
                  background: '#0d1117', borderRadius: 16, padding: 18,
                  border: '1.5px solid #1f2937', cursor: 'pointer'
                }}
              >
                {/* Title row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div>
                    <h3 style={{ color: '#fff', fontSize: 17, fontWeight: 700, margin: '0 0 2px' }}>{drill.name}</h3>
                    <span style={{ fontSize: 11, color: '#4b5563' }}>
                      {isQuota ? '✅ Quota' : '🎯 Fixed'} · {s.attempts} attempt{s.attempts !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <span style={{ fontSize: 12, color: '#4b5563' }}>
                    {new Date(s.lastAttempt.completed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                </div>

                {/* Stats */}
                <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
                  <div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: '#4ade80' }}>{s.best}</div>
                    <div style={{ fontSize: 11, color: '#6b7280' }}>{isQuota ? 'Best (shots)' : 'Best'}</div>
                  </div>
                  {s.avg30 !== null && (
                    <div>
                      <div style={{ fontSize: 20, fontWeight: 700, color: '#f97316' }}>{s.avg30}</div>
                      <div style={{ fontSize: 11, color: '#6b7280' }}>Avg 30d</div>
                    </div>
                  )}
                </div>

                {/* Mini sparkline */}
                {s.recentScores.length >= 2 && (
                  <LineChart data={s.recentScores} isQuota={isQuota} color="#f97316" />
                )}

                <div style={{ fontSize: 12, color: '#374151', marginTop: 8, textAlign: 'right' }}>
                  Tap for full history →
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Drill detail drawer */}
      {selectedDrill && (
        <DrillHistoryDrawer
          drill={selectedDrill}
          playerId={viewingId}
          onClose={() => setSelectedDrill(null)}
        />
      )}
    </div>
  )
}
