import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import DrillRunner from '../components/DrillRunner/DrillRunner'
import BottomNav from '../components/BottomNav'

export default function Today() {
  const { user, profile } = useAuth()
  async function handleSignOut() {
    await supabase.auth.signOut()
    navigate('/login')
  }
  const navigate = useNavigate()
  const [recentAttempts, setRecentAttempts] = useState([])
  const [recentPRs, setRecentPRs] = useState([])
  const [activeDrill, setActiveDrill] = useState(null)
  const [activeSpots, setActiveSpots] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadDashboard() }, [])

  async function loadDashboard() {
    setLoading(true)
    const [{ data: attempts }, { data: entries }] = await Promise.all([
      supabase
        .from('drill_attempts')
        .select('*, drills(name, drill_type)')
        .eq('player_id', user.id)
        .not('completed_at', 'is', null)
        .order('completed_at', { ascending: false })
        .limit(5),
      supabase
        .from('pr_entries')
        .select('*, pr_events(event_name, sport, result_type, unit)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(4)
    ])
    setRecentAttempts(attempts ?? [])
    setRecentPRs(entries ?? [])
    setLoading(false)
  }

  function formatResult(entry) {
    const type = entry.pr_events?.result_type
    if (type === 'time' && entry.time_ms != null) {
      const ms = entry.time_ms
      const h = Math.floor(ms / 3600000)
      const m = Math.floor((ms % 3600000) / 60000)
      const s = Math.floor((ms % 60000) / 1000)
      const cs = Math.floor((ms % 1000) / 10)
      if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
      return `${m}:${String(s).padStart(2,'0')}.${String(cs).padStart(2,'0')}`
    }
    if (type === 'weight_reps') return `${entry.weight}lb × ${entry.reps}`
    if (type === 'score') return `${entry.score}${entry.pr_events?.unit ? ' ' + entry.pr_events.unit : ''}`
    if (type === 'custom') return `${entry.custom_val}`
    return '—'
  }

  if (activeDrill && activeSpots.length) {
    return (
      <DrillRunner
        drill={activeDrill}
        spots={activeSpots}
        playerId={user.id}
        onComplete={() => { setActiveDrill(null); setActiveSpots([]); loadDashboard() }}
      />
    )
  }

  const greeting = () => {
    const h = new Date().getHours()
    if (h < 12) return 'Good morning'
    if (h < 17) return 'Good afternoon'
    return 'Good evening'
  }

  return (
    <div style={{ minHeight: '100dvh', background: '#030712', paddingBottom: 80, boxSizing: 'border-box' }}>
      {/* Header */}
      <div style={{ padding: '28px 20px 16px', background: 'linear-gradient(180deg, #0d1117 0%, #030712 100%)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <p style={{ color: '#6b7280', margin: '0 0 2px', fontSize: 14 }}>{greeting()},</p>
          <h1 style={{ color: '#fff', fontSize: 26, fontWeight: 800, margin: 0 }}>
            {profile?.full_name?.split(' ')[0] || 'Player'}
          </h1>
        </div>
        <button
          onClick={handleSignOut}
          style={{ background: 'none', border: '1.5px solid #1f2937', borderRadius: 8, color: '#4b5563', fontSize: 12, fontWeight: 600, padding: '6px 12px', cursor: 'pointer', marginTop: 4 }}
        >
          Sign Out
        </button>
      </div>

      <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 24 }}>

        {/* Quick Actions */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {[
            { label: 'Drill Library', sub: 'Browse & start drills', icon: '🏀', path: '/library', color: '#f97316' },
            { label: 'PR Tracker', sub: 'Log a new PR', icon: '🏆', path: '/prs', color: '#3b82f6' },
            { label: 'History', sub: 'View your trends', icon: '📈', path: '/history', color: '#8b5cf6' },
            { label: 'Log PR', sub: 'Quick entry', icon: '➕', path: '/prs?new=1', color: '#10b981' },
            { label: 'Stopwatch', sub: 'Race & time splits', icon: '⏱', path: '/stopwatch', color: '#f43f5e' },
            { label: 'Race Results', sub: 'Meets, times & splits', icon: '🏁', path: '/results', color: '#22c55e' },
            { label: 'Pace Calc', sub: 'Time, pace & distance', icon: '📐', path: '/pace', color: '#06b6d4' },
          ].map(({ label, sub, icon, path, color }) => (
            <button
              key={path}
              onClick={() => navigate(path)}
              style={{
                background: '#0d1117', border: `1.5px solid ${color}44`,
                borderRadius: 16, padding: '16px 14px', cursor: 'pointer',
                textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 8
              }}
            >
              <span style={{ fontSize: 26, background: `${color}22`, borderRadius: 10, width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{icon}</span>
              <div>
                <div style={{ color: '#fff', fontSize: 14, fontWeight: 700 }}>{label}</div>
                <div style={{ color: '#4b5563', fontSize: 12, marginTop: 1 }}>{sub}</div>
              </div>
            </button>
          ))}
        </div>

        {/* Recent Drill Activity */}
        {!loading && recentAttempts.length > 0 && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontSize: 12, color: '#6b7280', fontWeight: 600, letterSpacing: 0.5 }}>RECENT DRILLS</span>
              <button onClick={() => navigate('/history')} style={{ background: 'none', border: 'none', color: '#f97316', fontSize: 12, cursor: 'pointer', padding: 0 }}>See all →</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {recentAttempts.map(a => {
                const isQuota = a.drills?.drill_type === 'quota'
                const pct = a.total_reps > 0 ? Math.round((a.score / a.total_reps) * 100) : 0
                return (
                  <div key={a.id} style={{
                    background: '#0d1117', borderRadius: 12, padding: '12px 16px',
                    border: '1.5px solid #1f2937', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                  }}>
                    <div>
                      <div style={{ color: '#fff', fontSize: 14, fontWeight: 600 }}>{a.drills?.name ?? 'Drill'}</div>
                      <div style={{ color: '#4b5563', fontSize: 12, marginTop: 2 }}>
                        {new Date(a.completed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ color: '#f97316', fontSize: 16, fontWeight: 700 }}>
                        {isQuota ? `${a.total_reps} shots` : `${a.score}/${a.total_reps}`}
                      </div>
                      {!isQuota && <div style={{ color: '#6b7280', fontSize: 11 }}>{pct}%</div>}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Recent PRs */}
        {!loading && recentPRs.length > 0 && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontSize: 12, color: '#6b7280', fontWeight: 600, letterSpacing: 0.5 }}>RECENT PRs</span>
              <button onClick={() => navigate('/prs')} style={{ background: 'none', border: 'none', color: '#3b82f6', fontSize: 12, cursor: 'pointer', padding: 0 }}>See all →</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {recentPRs.map(entry => (
                <div key={entry.id} style={{
                  background: '#0d1117', borderRadius: 12, padding: '12px 16px',
                  border: '1.5px solid #1f2937', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                }}>
                  <div>
                    <div style={{ color: '#fff', fontSize: 14, fontWeight: 600 }}>{entry.pr_events?.event_name}</div>
                    <div style={{ color: '#4b5563', fontSize: 12, marginTop: 2 }}>
                      {entry.pr_events?.sport} · {new Date(entry.event_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </div>
                  </div>
                  <div style={{ color: '#3b82f6', fontSize: 16, fontWeight: 700 }}>{formatResult(entry)}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {!loading && recentAttempts.length === 0 && recentPRs.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🏀</div>
            <p style={{ color: '#4b5563', fontSize: 15, marginBottom: 20 }}>No activity yet — start a drill or log a PR</p>
            <button onClick={() => navigate('/library')} style={{
              background: '#f97316', border: 'none', borderRadius: 12,
              color: '#fff', fontSize: 15, fontWeight: 700,
              padding: '13px 28px', cursor: 'pointer'
            }}>Go to Drill Library</button>
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  )
}
