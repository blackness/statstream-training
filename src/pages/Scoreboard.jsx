import { useState, useEffect, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

// ── Formatters ─────────────────────────────────────────────────
function formatMs(ms) {
  if (ms == null || ms < 0) return '--:--.--'
  const h  = Math.floor(ms / 3600000)
  const m  = Math.floor((ms % 3600000) / 60000)
  const s  = Math.floor((ms % 60000) / 1000)
  const cs = Math.floor((ms % 1000) / 10)
  if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}.${String(cs).padStart(2,'0')}`
  return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}.${String(cs).padStart(2,'0')}`
}

function formatPace(ms, distanceM) {
  if (!ms || !distanceM) return null
  return formatMs((ms / distanceM) * 1000) + '/km'
}

// Live clock that counts up from a reference point
function LiveClock({ startedAt, stopped, finalMs }) {
  const [elapsed, setElapsed] = useState(finalMs ?? 0)
  const rafRef = useRef(null)

  useEffect(() => {
    if (stopped || !startedAt) { if (finalMs != null) setElapsed(finalMs); return }
    const start = new Date(startedAt).getTime()
    function tick() { setElapsed(Date.now() - start); rafRef.current = requestAnimationFrame(tick) }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [startedAt, stopped, finalMs])

  return <span>{formatMs(elapsed)}</span>
}

// ── Race Card ──────────────────────────────────────────────────
function RaceCard({ race, athletes }) {
  const isLive    = race.status === 'in-progress'
  const isDone    = race.status === 'completed'
  const isPending = race.status === 'pending'
  const medals    = ['🥇','🥈','🥉']

  // Sort athletes: finished by place/time, then active by predicted, then dnf
  const finished  = athletes.filter(a => a.status === 'finished' || a.final_time_ms != null)
    .sort((a,b) => {
      if (a.place && b.place) return a.place - b.place
      return (a.final_time_ms||Infinity) - (b.final_time_ms||Infinity)
    })
  const active    = athletes.filter(a => a.status === 'active' && a.final_time_ms == null)
    .sort((a,b) => {
      const aP = predictFinish(a, race)
      const bP = predictFinish(b, race)
      if (aP && bP) return aP - bP
      return (a.splits?.length||0) < (b.splits?.length||0) ? 1 : -1
    })
  const waiting   = athletes.filter(a => (!a.splits || a.splits.length === 0) && a.status === 'active' && a.final_time_ms == null)
  const dnf       = athletes.filter(a => a.status === 'dnf')

  function predictFinish(athlete, race) {
    if (!athlete.splits?.length || !race.distance_meters) return null
    const splits    = athlete.splits
    const splitDists = race.split_distances || []
    const cumDist   = splitDists.slice(0, splits.length).reduce((a,b)=>a+b, 0)
    if (!cumDist) return null
    const cumTime   = splits[splits.length-1].time_ms
    return Math.round((cumTime / cumDist) * race.distance_meters)
  }

  function getLastSplitMs(athlete) {
    if (!athlete.splits?.length) return null
    return athlete.splits[athlete.splits.length-1].time_ms
  }

  function getCumDist(athlete, race) {
    const splitDists = race.split_distances || []
    return splitDists.slice(0, athlete.splits?.length || 0).reduce((a,b)=>a+b,0)
  }

  const statusColor = isLive ? '#4ade80' : isDone ? '#6b7280' : isPending ? '#f97316' : '#6b7280'
  const statusLabel = isLive ? '● LIVE' : isDone ? 'FINAL' : isPending ? '⏳ STAGED' : 'UPCOMING'

  return (
    <div style={{ background:'#0d1117', borderRadius:16, border:`1.5px solid ${isLive?'#4ade8033':'#1f2937'}`, overflow:'hidden', marginBottom:16 }}>

      {/* Race header */}
      <div style={{ padding:'14px 18px', borderBottom:'1px solid #1f2937', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <div>
          <div style={{ color:'#fff', fontSize:18, fontWeight:800 }}>{race.name}</div>
          {race.heat_number > 1 && <div style={{ color:'#6b7280', fontSize:12 }}>Heat {race.heat_number}</div>}
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          {isLive && (
            <div style={{ fontSize:28, fontWeight:800, color:'#4ade80', fontVariantNumeric:'tabular-nums', fontFamily:'ui-monospace, "Courier New", monospace', letterSpacing:'-0.5px', minWidth:120, textAlign:'right' }}>
              <LiveClock startedAt={race.started_at} stopped={false} />
            </div>
          )}
          <div style={{ fontSize:11, fontWeight:800, color:statusColor, letterSpacing:1 }}>{statusLabel}</div>
        </div>
      </div>

      {/* Waiting to start */}
      {waiting.length > 0 && active.length === waiting.length && (
        <div style={{ padding:'10px 18px', borderBottom:'1px solid #111827' }}>
          <div style={{ fontSize:10, color:'#4b5563', fontWeight:600, letterSpacing:0.5, marginBottom:8 }}>ON THE LINE</div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
            {waiting.map(a => (
              <div key={a.id} style={{ background:'#111827', borderRadius:999, padding:'5px 12px', fontSize:13, color:'#6b7280', fontWeight:600 }}>
                {a.name}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Finished athletes */}
      {finished.map((athlete, i) => {
        const predicted = predictFinish(athlete, race)
        return (
          <div key={athlete.id} style={{
            padding:'12px 18px', borderBottom:'1px solid #111827',
            display:'flex', justifyContent:'space-between', alignItems:'center',
            background: i === 0 && isDone ? '#0a1f0f' : 'transparent'
          }}>
            <div style={{ display:'flex', alignItems:'center', gap:12 }}>
              <span style={{ fontSize:20, minWidth:28 }}>{athlete.place ? (medals[athlete.place-1] ?? `#${athlete.place}`) : `~${i+1}`}</span>
              <div>
                <div style={{ color: i===0&&isDone ? '#4ade80' : '#fff', fontSize:15, fontWeight:700 }}>{athlete.name}</div>
                {athlete.is_pb && <div style={{ fontSize:10, color:'#f97316', fontWeight:800 }}>🏆 PB</div>}
                {athlete.place == null && <div style={{ fontSize:10, color:'#4b5563' }}>place TBC</div>}
              </div>
            </div>
            <div style={{ textAlign:'right' }}>
              <div style={{ color: i===0&&isDone ? '#4ade80' : '#fff', fontSize:18, fontWeight:800, fontVariantNumeric:'tabular-nums' }}>
                {formatMs(athlete.final_time_ms)}
              </div>
              <div style={{ color:'#4b5563', fontSize:11 }}>{formatPace(athlete.final_time_ms, race.distance_meters)}</div>
            </div>
          </div>
        )
      })}

      {/* Active athletes mid-race */}
      {active.filter(a => a.splits?.length > 0).map(athlete => {
        const predicted  = predictFinish(athlete, race)
        const lastSplit  = getLastSplitMs(athlete)
        const cumDist    = getCumDist(athlete, race)
        const splitDists = race.split_distances || []
        const nextDist   = splitDists[athlete.splits.length] ?? null
        return (
          <div key={athlete.id} style={{ padding:'12px 18px', borderBottom:'1px solid #111827', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <div style={{ display:'flex', alignItems:'center', gap:12 }}>
              <div style={{ width:28, textAlign:'center' }}>
                <div style={{ width:8, height:8, borderRadius:'50%', background:'#f97316', margin:'0 auto', animation:'pulse 1s infinite' }} />
              </div>
              <div>
                <div style={{ color:'#fff', fontSize:15, fontWeight:700 }}>{athlete.name}</div>
                <div style={{ color:'#f97316', fontSize:12, fontVariantNumeric:'tabular-nums' }}>
                  Split {athlete.splits.length}/{splitDists.length} · {cumDist}m
                </div>
              </div>
            </div>
            <div style={{ textAlign:'right' }}>
              {predicted && (
                <div style={{ color:'#f97316', fontSize:15, fontWeight:800, fontVariantNumeric:'tabular-nums' }}>
                  ~{formatMs(predicted)}
                </div>
              )}
              <div style={{ color:'#4b5563', fontSize:11 }}>{formatPace(lastSplit, cumDist)}</div>
            </div>
          </div>
        )
      })}

      {/* DNF */}
      {dnf.map(athlete => (
        <div key={athlete.id} style={{ padding:'10px 18px', borderBottom:'1px solid #111827', display:'flex', justifyContent:'space-between', alignItems:'center', opacity:0.4 }}>
          <div style={{ color:'#6b7280', fontSize:14, fontWeight:600 }}>{athlete.name}</div>
          <div style={{ color:'#ef4444', fontSize:12, fontWeight:700 }}>DNF</div>
        </div>
      ))}
    </div>
  )
}

// ── Completed Race Summary (condensed clickable) ───────────────
function CompletedRaceSummary({ race, athletes }) {
  const [expanded, setExpanded]     = useState(false)
  const [expandedRunner, setExpandedRunner] = useState(null)
  const finished = [...athletes].filter(a => a.final_time_ms != null)
    .sort((a,b) => (a.place||999) - (b.place||999) || a.final_time_ms - b.final_time_ms)
  const winner = finished[0]
  const splitDists = race.split_distances || []

  function cumDist(si) { return splitDists.slice(0,si+1).reduce((a,b)=>a+b,0) }

  return (
    <div style={{ background:'#0d1117', borderRadius:12, border:'1px solid #1f2937', marginBottom:8, overflow:'hidden' }}>
      {/* Condensed header — tap to expand */}
      <button onClick={()=>setExpanded(e=>!e)} style={{ width:'100%', background:'none', border:'none', cursor:'pointer', padding:'12px 16px', display:'flex', justifyContent:'space-between', alignItems:'center', textAlign:'left' }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <span style={{ fontSize:16, fontWeight:800, color:'#fff' }}>{race.name}</span>
          {race.heat_number > 1 && <span style={{ fontSize:11, color:'#4b5563' }}>Heat {race.heat_number}</span>}
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          {winner && <span style={{ color:'#4ade80', fontSize:14, fontWeight:700, fontVariantNumeric:'tabular-nums' }}>{formatMs(winner.final_time_ms)}</span>}
          <span style={{ color:'#4b5563', fontSize:16 }}>{expanded ? '▲' : '▼'}</span>
        </div>
      </button>

      {/* Expanded results */}
      {expanded && (
        <div style={{ borderTop:'1px solid #1f2937' }}>
          {finished.map((athlete, i) => (
            <div key={athlete.id}>
              {/* Athlete row — tap to show splits */}
              <button
                onClick={()=>setExpandedRunner(expandedRunner===athlete.id ? null : athlete.id)}
                style={{ width:'100%', background: expandedRunner===athlete.id?'#111827':'none', border:'none', cursor:'pointer', padding:'10px 16px', display:'flex', justifyContent:'space-between', alignItems:'center', textAlign:'left', borderBottom:'1px solid #111827' }}
              >
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <span style={{ fontSize:16, minWidth:24 }}>
                    {athlete.place ? (['🥇','🥈','🥉'][athlete.place-1] ?? `#${athlete.place}`) : `~${i+1}`}
                  </span>
                  <div>
                    <div style={{ color:'#fff', fontSize:14, fontWeight:700 }}>{athlete.name}</div>
                    {athlete.is_pb && <div style={{ fontSize:10, color:'#f97316', fontWeight:800 }}>🏆 PB</div>}
                  </div>
                </div>
                <div style={{ textAlign:'right' }}>
                  <div style={{ color: i===0?'#4ade80':'#9ca3af', fontSize:15, fontWeight:800, fontVariantNumeric:'tabular-nums' }}>
                    {formatMs(athlete.final_time_ms)}
                  </div>
                  <div style={{ color:'#4b5563', fontSize:10 }}>{formatPace(athlete.final_time_ms, race.distance_meters)}</div>
                </div>
              </button>

              {/* Splits row */}
              {expandedRunner === athlete.id && athlete.splits?.length > 0 && (
                <div style={{ padding:'10px 16px 12px', background:'#060910', borderBottom:'1px solid #111827', display:'flex', flexWrap:'wrap', gap:6 }}>
                  {athlete.splits.map((split, si) => {
                    const lapMs  = split.split_ms
                    const cumMs  = split.time_ms
                    const dist   = splitDists[si]
                    const cd     = cumDist(si)
                    const isFin  = si === athlete.splits.length - 1
                    return (
                      <div key={si} style={{ padding:'5px 10px', borderRadius:8, background:isFin?'#14532d':'#111827', border:`1px solid ${isFin?'#4ade8044':'#1f2937'}` }}>
                        <div style={{ fontSize:9, color:isFin?'#4ade80':'#6b7280', fontWeight:700 }}>{isFin?'🏁':`S${si+1}`} {dist}m·{cd}m</div>
                        <div style={{ fontSize:12, color:'#fff', fontWeight:700, fontVariantNumeric:'tabular-nums' }}>{formatMs(lapMs)}</div>
                        <div style={{ fontSize:10, color:'#6b7280', fontVariantNumeric:'tabular-nums' }}>{formatMs(cumMs)}</div>
                        <div style={{ fontSize:9, color:'#374151' }}>{formatPace(lapMs, dist)}</div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
function FieldEventStub({ race, athletes }) {
  const best = [...athletes]
    .filter(a => a.best_mark_cm != null)
    .sort((a,b) => b.best_mark_cm - a.best_mark_cm)

  return (
    <div style={{ background:'#0d1117', borderRadius:12, border:'1px solid #1f2937', padding:'12px 14px', marginBottom:10 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
        <div style={{ color:'#9ca3af', fontSize:13, fontWeight:700 }}>{race.name}</div>
        <div style={{ fontSize:10, color:'#4b5563', fontWeight:600 }}>FIELD</div>
      </div>
      {best.length === 0 ? (
        <div style={{ color:'#374151', fontSize:12 }}>No marks yet</div>
      ) : best.slice(0,3).map((a,i) => (
        <div key={a.id} style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:4 }}>
          <span style={{ color:'#6b7280' }}>#{i+1} {a.name}</span>
          <span style={{ color:'#fff', fontWeight:700, fontVariantNumeric:'tabular-nums' }}>
            {a.best_mark_cm ? `${(a.best_mark_cm/100).toFixed(2)}m` : '—'}
          </span>
        </div>
      ))}
    </div>
  )
}

// ── Main Scoreboard ────────────────────────────────────────────
export default function Scoreboard() {
  const { slug } = useParams()
  const [meet,         setMeet]         = useState(null)
  const [races,        setRaces]        = useState([])
  const [athleteMap,   setAthleteMap]   = useState({}) // raceId → athletes[]
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState(null)
  const [lastUpdated,  setLastUpdated]  = useState(null)

  // ── Initial load ─────────────────────────────────────────────
  useEffect(() => {
    loadMeet()
  }, [slug])

  async function loadMeet() {
    setLoading(true)
    try {
      // Load meet by slug
      const { data: meetData, error: meetErr } = await supabase
        .from('meets')
        .select('*')
        .eq('slug', slug)
        .single()

      if (meetErr || !meetData) { setError('Meet not found'); setLoading(false); return }
      setMeet(meetData)

      await loadRaces(meetData.id)
    } catch(e) {
      setError('Failed to load scoreboard')
    }
    setLoading(false)
  }

  async function loadRaces(meetId) {
    const { data: racesData } = await supabase
      .from('races')
      .select('*')
      .eq('meet_id', meetId)
      .eq('is_public', true)
      .not('status', 'eq', 'false_start')  // hide false started races
      .order('created_at', { ascending: false })

    if (!racesData?.length) { setRaces([]); return }
    setRaces(racesData)

    // Load athletes for all races
    const { data: athletesData } = await supabase
      .from('race_athletes')
      .select('*')
      .in('race_id', racesData.map(r => r.id))

    const map = {}
    racesData.forEach(r => { map[r.id] = [] })
    athletesData?.forEach(a => {
      if (map[a.race_id]) map[a.race_id].push(a)
    })
    setAthleteMap(map)
    setLastUpdated(new Date())
  }

  // ── Realtime ─────────────────────────────────────────────────
  useEffect(() => {
    if (!meet) return

    const channel = supabase.channel(`scoreboard-${meet.id}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'races', filter: `meet_id=eq.${meet.id}` },
        () => loadRaces(meet.id)
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'race_athletes' },
        (payload) => {
          setAthleteMap(prev => {
            const raceId = payload.new?.race_id || payload.old?.race_id
            if (!raceId || !prev[raceId]) return prev
            const updated = { ...prev }
            if (payload.eventType === 'INSERT') {
              updated[raceId] = [...updated[raceId], payload.new]
            } else if (payload.eventType === 'UPDATE') {
              updated[raceId] = updated[raceId].map(a => a.id === payload.new.id ? payload.new : a)
            } else if (payload.eventType === 'DELETE') {
              updated[raceId] = updated[raceId].filter(a => a.id !== payload.old.id)
            }
            return updated
          })
          setLastUpdated(new Date())
        }
      )
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [meet])

  // ── Split track and field races, live vs completed ────────────
  const trackRaces    = races.filter(r => r.event_type === 'track')
  const fieldRaces    = races.filter(r => r.event_type === 'field')
  const liveRaces     = trackRaces.filter(r => r.status === 'in-progress' || r.status === 'pending')
  const completedRaces = trackRaces.filter(r => r.status === 'completed')
  const hasField      = fieldRaces.length > 0

  if (loading) return (
    <div style={{ minHeight:'100dvh', background:'#030712', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ textAlign:'center' }}>
        <div style={{ width:40, height:40, border:'3px solid #f97316', borderTopColor:'transparent', borderRadius:'50%', animation:'spin 0.8s linear infinite', margin:'0 auto 16px' }} />
        <p style={{ color:'#4b5563', fontSize:14 }}>Loading scoreboard...</p>
      </div>
    </div>
  )

  if (error) return (
    <div style={{ minHeight:'100dvh', background:'#030712', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ textAlign:'center' }}>
        <div style={{ fontSize:48, marginBottom:16 }}>🏁</div>
        <p style={{ color:'#6b7280', fontSize:16 }}>{error}</p>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight:'100dvh', background:'#030712', boxSizing:'border-box' }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        @keyframes pulse { 0%,100% { opacity:1 } 50% { opacity:0.4 } }
      `}</style>

      {/* Header */}
      <div style={{ padding:'20px 20px 16px', background:'#0d1117', borderBottom:'1px solid #1f2937', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <div>
          <div style={{ fontSize:11, color:'#4b5563', letterSpacing:1, fontWeight:600, marginBottom:2 }}>LIVE RESULTS</div>
          <h1 style={{ color:'#fff', fontSize:20, fontWeight:800, margin:0 }}>{meet?.name}</h1>
          {meet?.location && <div style={{ color:'#6b7280', fontSize:12, marginTop:2 }}>{meet.location}</div>}
        </div>
        <div style={{ textAlign:'right' }}>
          <div style={{ width:8, height:8, borderRadius:'50%', background:'#4ade80', display:'inline-block', animation:'pulse 2s infinite', marginRight:6 }} />
          <span style={{ color:'#4ade80', fontSize:11, fontWeight:700 }}>LIVE</span>
          {lastUpdated && (
            <div style={{ color:'#374151', fontSize:10, marginTop:4 }}>
              {lastUpdated.toLocaleTimeString()}
            </div>
          )}
        </div>
      </div>

      <div style={{ padding:'16px 16px', display:'flex', gap:16 }}>

        {/* Main track events panel */}
        <div style={{ flex:1, minWidth:0 }}>
          {/* Live / staged races */}
          {liveRaces.length === 0 && completedRaces.length === 0 ? (
            <div style={{ textAlign:'center', padding:'60px 0', color:'#374151' }}>
              <div style={{ fontSize:48, marginBottom:12 }}>🏃</div>
              <p style={{ fontSize:14 }}>No races yet — check back soon</p>
            </div>
          ) : (
            <>
              {liveRaces.map(race => (
                <RaceCard key={race.id} race={race} athletes={athleteMap[race.id] || []} />
              ))}

              {/* Completed races — condensed */}
              {completedRaces.length > 0 && (
                <div>
                  {liveRaces.length > 0 && (
                    <div style={{ fontSize:10, color:'#4b5563', fontWeight:600, letterSpacing:0.8, margin:'16px 0 10px' }}>COMPLETED</div>
                  )}
                  {completedRaces.map(race => (
                    <CompletedRaceSummary key={race.id} race={race} athletes={athleteMap[race.id] || []} />
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Field events side panel */}
        {hasField && (
          <div style={{ width:200, flexShrink:0 }}>
            <div style={{ fontSize:10, color:'#4b5563', letterSpacing:0.8, fontWeight:600, marginBottom:10 }}>FIELD EVENTS</div>
            {fieldRaces.map(race => (
              <FieldEventStub key={race.id} race={race} athletes={athleteMap[race.id] || []} />
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ padding:'16px 20px', borderTop:'1px solid #111827', textAlign:'center' }}>
        <p style={{ color:'#374151', fontSize:11, margin:0 }}>Powered by StatStream · athleteOS</p>
      </div>
    </div>
  )
}
