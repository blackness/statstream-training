import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import BottomNav from '../components/BottomNav'

// ── Formatters ─────────────────────────────────────────────────
function formatMs(ms) {
  if (ms == null || ms < 0) return '—'
  const h  = Math.floor(ms / 3600000)
  const m  = Math.floor((ms % 3600000) / 60000)
  const s  = Math.floor((ms % 60000) / 1000)
  const cs = Math.floor((ms % 1000) / 10)
  if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}.${String(cs).padStart(2,'0')}`
  return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}.${String(cs).padStart(2,'0')}`
}

function formatPace(ms, distM) {
  if (!ms || !distM) return null
  const paceMs = (ms / distM) * 1000
  const m = Math.floor(paceMs / 60000)
  const s = Math.floor((paceMs % 60000) / 1000)
  return `${m}:${String(s).padStart(2,'0')}/km`
}

function formatDate(str) {
  if (!str) return '—'
  return new Date(str).toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric', year:'numeric' })
}

function formatDateShort(str) {
  if (!str) return '—'
  return new Date(str).toLocaleDateString('en-US', { month:'short', day:'numeric' })
}

const MEDALS = ['🥇','🥈','🥉']
const PLACE_COLORS = ['#ca8a04','#9ca3af','#b45309']

// ── Split bar visual ───────────────────────────────────────────
function SplitBar({ lapMs, maxLapMs, color }) {
  const pct = maxLapMs > 0 ? (lapMs / maxLapMs) * 100 : 0
  return (
    <div style={{ flex: 1, height: 3, background: '#1f2937', borderRadius: 2, overflow: 'hidden' }}>
      <div style={{
        height: '100%', borderRadius: 2,
        width: `${pct}%`,
        background: color,
        transition: 'width 0.4s ease'
      }} />
    </div>
  )
}

// ── Runner row ─────────────────────────────────────────────────
function RunnerRow({ athlete, splitDistances, totalDistance, isFirst }) {
  const [open, setOpen] = useState(false)
  const place = athlete.place
  const medal = place && place <= 3 ? MEDALS[place - 1] : null
  const placeColor = place && place <= 3 ? PLACE_COLORS[place - 1] : '#4b5563'
  const splits = athlete.splits || []

  // Calculate lap times - splits stored as [{lap, time_ms, split_ms}]
  const lapTimes = splits.map((s, i) => {
    const cumMs = typeof s === 'object' ? (s.time_ms ?? s) : s
    const prevCumMs = i === 0 ? 0 : (typeof splits[i-1] === 'object' ? (splits[i-1].time_ms ?? splits[i-1]) : splits[i-1])
    const lapMs = cumMs - prevCumMs
    const dist = splitDistances?.[i] ?? (typeof s === 'object' ? s.split_ms : null) ?? 0
    return {
      lapMs,
      cumMs,
      dist,
      cumDist: splitDistances ? splitDistances.slice(0, i+1).reduce((a,b)=>a+b,0) : 0,
      isFinal: i === splits.length - 1
    }
  })

  const maxLapMs = lapTimes.length > 0 ? Math.max(...lapTimes.map(l => l.lapMs)) : 0

  return (
    <div style={{
      borderBottom: '1px solid #1f2937',
      background: open ? '#0d1117' : 'transparent',
      transition: 'background 0.15s'
    }}>
      {/* Runner header row */}
      <div
        onClick={() => lapTimes.length > 0 && setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '11px 16px',
          cursor: lapTimes.length > 0 ? 'pointer' : 'default',
        }}
      >
        {/* Place */}
        <div style={{
          width: 32, height: 32, borderRadius: 8, flexShrink: 0,
          background: place ? `${placeColor}22` : '#111827',
          border: `1.5px solid ${place ? placeColor : '#1f2937'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: "'Barlow Condensed', sans-serif",
          fontSize: medal ? 16 : 13, fontWeight: 800,
          color: placeColor
        }}>
          {medal || (place ? `${place}` : '—')}
        </div>

        {/* Name + status */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: 16, fontWeight: 700,
            color: athlete.status === 'dnf' ? '#4b5563' : '#f0f4f8',
            letterSpacing: 0.3,
            display: 'flex', alignItems: 'center', gap: 6
          }}>
            {athlete.name}
            {athlete.status === 'dnf' && (
              <span style={{ fontSize: 10, color: '#ef4444', fontWeight: 700, letterSpacing: 1 }}>DNF</span>
            )}
          </div>
          {isFirst && athlete.final_time_ms && (
            <div style={{ fontSize: 11, color: '#4b5563', marginTop: 1 }}>
              {formatPace(athlete.final_time_ms, totalDistance)}
            </div>
          )}
          {!isFirst && athlete.final_time_ms && (
            <div style={{ fontSize: 11, color: '#4b5563', marginTop: 1 }}>
              +{formatMs(athlete.final_time_ms - (lapTimes.length > 0 ? 0 : 0))}
            </div>
          )}
        </div>

        {/* Time */}
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: 20, fontWeight: 800,
            color: isFirst ? '#4ade80' : '#f0f4f8',
            letterSpacing: -0.5,
            fontVariantNumeric: 'tabular-nums'
          }}>
            {athlete.final_time_ms ? formatMs(athlete.final_time_ms) : '—'}
          </div>
        </div>

        {/* Chevron */}
        {lapTimes.length > 0 && (
          <div style={{
            color: '#374151', fontSize: 12, flexShrink: 0,
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s'
          }}>▼</div>
        )}
      </div>

      {/* Splits panel */}
      {open && lapTimes.length > 0 && (
        <div style={{ padding: '0 16px 14px 60px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {lapTimes.map((lap, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 48, flexShrink: 0 }}>
                  <div style={{
                    fontFamily: "'Barlow Condensed', sans-serif",
                    fontSize: 10, fontWeight: 700, letterSpacing: 1,
                    color: lap.isFinal ? '#4ade80' : '#4b5563',
                    textTransform: 'uppercase'
                  }}>
                    {lap.isFinal ? '🏁' : `S${i+1}`}
                  </div>
                  {lap.dist > 0 && (
                    <div style={{ fontSize: 9, color: '#374151' }}>{lap.dist}m</div>
                  )}
                </div>
                <SplitBar lapMs={lap.lapMs} maxLapMs={maxLapMs} color={lap.isFinal ? '#4ade80' : '#f97316'} />
                <div style={{ textAlign: 'right', flexShrink: 0, minWidth: 64 }}>
                  <div style={{
                    fontFamily: "'Barlow Condensed', sans-serif",
                    fontSize: 14, fontWeight: 700,
                    color: lap.isFinal ? '#4ade80' : '#f0f4f8',
                    fontVariantNumeric: 'tabular-nums'
                  }}>
                    {formatMs(lap.lapMs)}
                  </div>
                  <div style={{ fontSize: 9, color: '#374151', fontVariantNumeric: 'tabular-nums' }}>
                    {formatMs(lap.cumMs)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Race card ──────────────────────────────────────────────────
function RaceCard({ race }) {
  const [open, setOpen] = useState(false)
  const [athletes, setAthletes] = useState([])
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)

  const finishers = athletes
    .filter(a => a.status !== 'dnf')
    .sort((a,b) => {
      if (a.place && b.place) return a.place - b.place
      if (a.place && !b.place) return -1
      if (!a.place && b.place) return 1
      return (a.final_time_ms || 0) - (b.final_time_ms || 0)
    })
  const dnf = athletes.filter(a => a.status === 'dnf')
  const winner = finishers[0]

  async function load() {
    if (loaded) { setOpen(o => !o); return }
    setOpen(true)
    setLoading(true)
    const { data } = await supabase
      .from('race_athletes')
      .select('id, name, place, final_time_ms, status, splits, player_id')
      .eq('race_id', race.id)
      .order('final_time_ms', { ascending: true })
    console.log('race_athletes data:', data, 'for race:', race.id)
    setAthletes(data || [])
    setLoaded(true)
    setLoading(false)
  }

  const statusColor = race.status === 'completed' ? '#4ade80' : race.status === 'in-progress' ? '#f97316' : '#4b5563'
  const statusLabel = race.status === 'completed' ? 'Final' : race.status === 'in-progress' ? 'Live' : 'Pending'

  return (
    <div style={{
      borderRadius: 12, overflow: 'hidden',
      border: `1.5px solid ${open ? '#374151' : '#1f2937'}`,
      background: open ? '#0d1117' : '#080b0f',
      transition: 'all 0.2s'
    }}>
      {/* Race header */}
      <div
        onClick={load}
        style={{
          padding: '13px 16px', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 12,
        }}
      >
        {/* Status dot */}
        <div style={{
          width: 8, height: 8, borderRadius: '50%',
          background: statusColor, flexShrink: 0,
          boxShadow: race.status === 'in-progress' ? `0 0 8px ${statusColor}` : 'none'
        }} />

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: 17, fontWeight: 800,
            color: '#f0f4f8', letterSpacing: 0.3,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
          }}>
            {race.name || `${race.gender !== 'mixed' ? race.gender + ' ' : ''}${race.category ? race.category + ' ' : ''}${race.distance_meters ? race.distance_meters + 'm' : 'Race'}`}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 3, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, color: statusColor, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>
              {statusLabel}
            </span>
            {race.distance_meters && (
              <span style={{ fontSize: 11, color: '#4b5563' }}>{race.distance_meters}m</span>
            )}
            {race.category && (
              <span style={{ fontSize: 11, color: '#4b5563' }}>{race.category}</span>
            )}
            {race.gender && race.gender !== 'mixed' && (
              <span style={{ fontSize: 11, color: '#4b5563', textTransform: 'capitalize' }}>{race.gender}</span>
            )}
          </div>
        </div>

        {/* Winner preview */}
        {winner && !open && (
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontSize: 11, color: '#4b5563', marginBottom: 1 }}>🥇 {winner.name?.split(' ')[0]}</div>
            <div style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              fontSize: 15, fontWeight: 700, color: '#4ade80',
              fontVariantNumeric: 'tabular-nums'
            }}>{formatMs(winner.final_time_ms)}</div>
          </div>
        )}

        <div style={{
          color: '#374151', fontSize: 11, flexShrink: 0,
          transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
          transition: 'transform 0.2s'
        }}>▼</div>
      </div>

      {/* Athletes */}
      {open && (
        <div style={{ borderTop: '1px solid #1f2937' }}>
          {loading ? (
            <div style={{ padding: '20px', textAlign: 'center', color: '#4b5563', fontSize: 13 }}>
              Loading results...
            </div>
          ) : athletes.length === 0 ? (
            <div style={{ padding: '20px', textAlign: 'center', color: '#374151', fontSize: 13 }}>
              No results recorded
            </div>
          ) : (
            <>
              {finishers.map((a, i) => (
                <RunnerRow
                  key={a.id}
                  athlete={a}
                  splitDistances={race.split_distances}
                  totalDistance={race.distance_meters}
                  isFirst={i === 0}
                />
              ))}
              {dnf.map(a => (
                <RunnerRow
                  key={a.id}
                  athlete={a}
                  splitDistances={race.split_distances}
                  totalDistance={race.distance_meters}
                  isFirst={false}
                />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ── Meet card ──────────────────────────────────────────────────
function MeetCard({ meet }) {
  const [open, setOpen] = useState(false)
  const [races, setRaces] = useState([])
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)

  async function load() {
    if (loaded) { setOpen(o => !o); return }
    setOpen(true)
    setLoading(true)
    const { data } = await supabase
      .from('races')
      .select('id, name, event_type, distance_meters, split_distances, status, gender, category, started_at, completed_at')
      .eq('meet_id', meet.id)
      .order('created_at', { ascending: true })
    setRaces(data || [])
    setLoaded(true)
    setLoading(false)
  }

  return (
    <div style={{
      borderRadius: 16, overflow: 'hidden',
      border: `1.5px solid ${open ? '#374151' : '#1e2730'}`,
      background: '#0e1318',
      transition: 'border-color 0.2s'
    }}>
      {/* Meet header */}
      <div
        onClick={load}
        style={{
          padding: '16px 18px', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 14,
        }}
      >
        {/* Date badge */}
        <div style={{
          flexShrink: 0, textAlign: 'center',
          background: '#111827', border: '1px solid #1f2937',
          borderRadius: 10, padding: '6px 10px', minWidth: 44
        }}>
          <div style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: 18, fontWeight: 900, color: '#f97316', lineHeight: 1
          }}>
            {meet.created_at ? new Date(meet.created_at).getDate() : '—'}
          </div>
          <div style={{ fontSize: 9, color: '#4b5563', fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>
            {meet.created_at ? new Date(meet.created_at).toLocaleDateString('en-US', { month: 'short' }) : ''}
          </div>
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: 20, fontWeight: 900,
            color: '#f0f4f8', letterSpacing: -0.3,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
          }}>
            {meet.name}
          </div>
          <div style={{ fontSize: 11, color: '#4b5563', marginTop: 2 }}>
            {meet.race_count} {meet.race_count === 1 ? 'race' : 'races'}
            {meet.created_at && ` · ${formatDate(meet.created_at)}`}
          </div>
        </div>

        <div style={{
          color: '#374151', fontSize: 12, flexShrink: 0,
          transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
          transition: 'transform 0.2s'
        }}>▼</div>
      </div>

      {/* Races */}
      {open && (
        <div style={{ borderTop: '1px solid #1f2937', padding: '12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {loading ? (
            <div style={{ padding: '12px', textAlign: 'center', color: '#4b5563', fontSize: 13 }}>
              Loading races...
            </div>
          ) : races.length === 0 ? (
            <div style={{ padding: '12px', textAlign: 'center', color: '#374151', fontSize: 13 }}>
              No races in this meet
            </div>
          ) : (
            races.map(race => <RaceCard key={race.id} race={race} />)
          )}
        </div>
      )}
    </div>
  )
}

// ── Main ───────────────────────────────────────────────────────
export default function RaceResults() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [meets, setMeets] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => { loadMeets() }, [])

  async function loadMeets() {
    setLoading(true)
    const { data } = await supabase
      .from('meets')
      .select(`
        id, name, slug, created_at,
        races(count)
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    // Flatten race count
    const mapped = (data || []).map(m => ({
      ...m,
      race_count: m.races?.[0]?.count ?? 0
    }))
    setMeets(mapped)
    setLoading(false)
  }

  const filtered = meets.filter(m =>
    m.name?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div style={{
      minHeight: '100dvh',
      background: '#080b0f',
      paddingBottom: 80,
      fontFamily: "'Barlow', sans-serif"
    }}>
      <link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700;800;900&family=Barlow:wght@300;400;500;600&display=swap" rel="stylesheet" />

      {/* Header */}
      <div style={{
        padding: '24px 20px 0',
        background: 'linear-gradient(180deg, #0d1117 0%, #080b0f 100%)',
        borderBottom: '1px solid #1e2730',
        paddingBottom: 16
      }}>
        <button
          onClick={() => navigate(-1)}
          style={{ background: 'none', border: 'none', color: '#4b5563', fontSize: 13, cursor: 'pointer', padding: '0 0 12px', display: 'flex', alignItems: 'center', gap: 4 }}
        >
          ← Back
        </button>
        <div style={{
          fontFamily: "'Barlow Condensed', sans-serif",
          fontSize: 28, fontWeight: 900,
          color: '#f0f4f8', letterSpacing: -0.5, marginBottom: 4
        }}>
          Race Results
        </div>
        <div style={{ color: '#4b5563', fontSize: 14, marginBottom: 16 }}>
          {meets.length} meet{meets.length !== 1 ? 's' : ''}
        </div>

        {/* Search */}
        {meets.length > 3 && (
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search meets..."
            style={{
              width: '100%', padding: '10px 14px',
              background: '#111827', border: '1.5px solid #1f2937',
              borderRadius: 10, color: '#f0f4f8', fontSize: 14,
              outline: 'none', boxSizing: 'border-box',
              fontFamily: "'Barlow', sans-serif"
            }}
          />
        )}
      </div>

      {/* Content */}
      <div style={{ padding: '16px 16px 0' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#4b5563', fontSize: 14 }}>
            Loading meets...
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🏁</div>
            <div style={{ color: '#4b5563', fontSize: 15, marginBottom: 8 }}>
              {search ? 'No meets match your search' : 'No meets yet'}
            </div>
            <div style={{ color: '#374151', fontSize: 13 }}>
              Results appear here after you run a race in the Stopwatch
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {filtered.map(meet => (
              <MeetCard key={meet.id} meet={meet} />
            ))}
          </div>
        )}
      </div>

      <BottomNav />

      <style>{`
        input::placeholder { color: #374151; }
        input:focus { border-color: #f97316 !important; }
        * { -webkit-tap-highlight-color: transparent; }
      `}</style>
    </div>
  )
}
