import { useState, useEffect, useRef, useLayoutEffect } from 'react'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import BottomNav from '../components/BottomNav'

// ── Constants ──────────────────────────────────────────────────
const COLORS = ['#f97316','#3b82f6','#4ade80','#a855f7','#f43f5e','#facc15','#06b6d4','#ec4899']

const TRACK_EVENTS = [
  { label: '100m',    distance: 100   },
  { label: '200m',    distance: 200   },
  { label: '400m',    distance: 400   },
  { label: '800m',    distance: 800   },
  { label: '1500m',   distance: 1500  },
  { label: '1600m',   distance: 1600  },
  { label: '3000m',   distance: 3000  },
  { label: '5000m',   distance: 5000  },
  { label: '10000m',  distance: 10000 },
  { label: 'Mile',    distance: 1609  },
  { label: 'Other',   distance: null  },
]

const CATEGORIES = ['Open', 'Senior', 'Junior', 'Novice']

function capitalize(str) {
  if (!str) return ''
  return str.charAt(0).toUpperCase() + str.slice(1)
}

const TAG_TO_EVENTS = {
  Sprint:  ['100m','200m','400m'],
  Mid:     ['800m','1500m','1600m','Mile'],
  Long:    ['3000m','5000m','10000m'],
  Hurdles: ['100m','110m','400m'],
  Relay:   ['400m','800m'],
}

// ── Split model ────────────────────────────────────────────────
function buildSplitDistances(raceDistance, trackLength, coachPosition) {
  if (!raceDistance || !trackLength) return []
  if (raceDistance <= trackLength) return [raceDistance]
  const pos       = coachPosition || 0
  const first     = pos === 0 ? trackLength : pos
  const remaining = raceDistance - first
  const fullLaps  = Math.floor(remaining / trackLength)
  const last      = remaining - fullLaps * trackLength
  const splits    = [first, ...Array(fullLaps).fill(trackLength)]
  if (last > 0) splits.push(last)
  return splits
}

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
  if (!ms || !distanceM || distanceM === 0) return null
  return formatMs((ms / distanceM) * 1000) + '/km'
}

// ── Setup Screen ───────────────────────────────────────────────
const UNITS = [
  { label: 'm',    toMetres: 1 },
  { label: 'km',   toMetres: 1000 },
  { label: 'mi',   toMetres: 1609.34 },
  { label: 'yds',  toMetres: 0.9144 },
]

// ── Athlete loader (stopwatch_athletes table) ─────────────────
async function loadStopwatchAthletes(user) {
  if (!user) return { tagged: [], untagged: [] }
  try {
    const { data } = await supabase
      .from('stopwatch_athletes')
      .select('id, name, sport, profile_id, notes')
      .eq('user_id', user.id)
      .order('name')
    if (!data?.length) return { tagged: [], untagged: [] }
    const tagged   = data.filter(a => a.sport).sort((a,b) => a.name.localeCompare(b.name))
    const untagged = data.filter(a => !a.sport).sort((a,b) => a.name.localeCompare(b.name))
    return { tagged, untagged }
  } catch(e) { console.error(e); return { tagged: [], untagged: [] } }
}

async function addStopwatchAthlete(user, name, sport) {
  if (!user || !name.trim()) return null
  try {
    const { data } = await supabase
      .from('stopwatch_athletes')
      .insert({ user_id: user.id, name: name.trim(), sport: sport || null })
      .select('id, name, sport, profile_id')
      .single()
    return data
  } catch(e) { console.error(e); return null }
}

// ── Athlete Picker (shared component) ─────────────────────────
function AthletePicker({ tagged, untagged, selected, onToggle, onAddManual, loading, onAthleteAdded }) {
  const { user } = useAuth()
  const [search,     setSearch]     = useState('')
  const [manualName, setManualName] = useState('')
  const [saving,     setSaving]     = useState(false)
  const S = styles

  const all = [...tagged, ...untagged]
  const filtered = all.filter(a => a.name.toLowerCase().includes(search.toLowerCase()))

  async function addAthlete() {
    const name = capitalize(manualName.trim())
    if (!name) return
    setSaving(true)
    const saved = await addStopwatchAthlete(user, name)
    setSaving(false)
    if (saved) {
      onAthleteAdded?.(saved)
      onToggle(saved)
    } else {
      onAddManual(name)
    }
    setManualName('')
  }

  return (
    <div>
      {all.length > 5 && (
        <input style={{ ...S.input, marginBottom:8 }} value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search athletes..." />
      )}
      {loading && <div style={{ color:'#4b5563', fontSize:12, marginBottom:8 }}>Loading...</div>}
      {filtered.length === 0 && !loading && (
        <div style={{ color:'#4b5563', fontSize:12, marginBottom:8 }}>No athletes yet — add one below</div>
      )}
      {filtered.length > 0 && (
        <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:8 }}>
          {filtered.map(a => {
            const isSel = selected.find(s=>s.id===a.id)
            return (
              <button key={a.id} onClick={()=>onToggle(a)} style={{
                padding:'7px 12px', borderRadius:999, fontSize:13, fontWeight:600,
                border:`1.5px solid ${isSel?'#f97316':'#1f2937'}`,
                background: isSel?'#f9731622':'#111827',
                color: isSel?'#f97316':'#9ca3af',
                cursor:'pointer', display:'flex', alignItems:'center', gap:5
              }}>
                {isSel && <span style={{fontSize:10}}>✓</span>}
                {a.name}
                {a.sport && <span style={{ fontSize:9, color:'#4b5563', marginLeft:2 }}>{a.sport}</span>}
              </button>
            )
          })}
        </div>
      )}
      <div style={{ display:'flex', gap:8 }}>
        <input
          style={{ ...S.input, flex:1 }}
          value={manualName}
          onChange={e=>setManualName(e.target.value)}
          onKeyDown={e=>e.key==='Enter'&&addAthlete()}
          placeholder="Add athlete by name..."
        />
        <button onClick={addAthlete} disabled={saving} style={{ ...S.addBtn, opacity:saving?0.5:1 }}>
          {saving ? '…' : '+'}
        </button>
      </div>
    </div>
  )
}

// ── Setup Screen ───────────────────────────────────────────────
function SetupScreen({ onStart, initialConfig }) {
  const { user } = useAuth()
  const [mode, setMode] = useState(initialConfig?.isRace===false ? 'training' : 'race')

  // ── Race state ──────────────────────────────────────────────
  const [raceName,      setRaceName]      = useState(initialConfig?.raceName      || '')
  const [raceDate,      setRaceDate]      = useState(initialConfig?.raceDate      || new Date().toISOString().slice(0,10))
  const [raceLocation,  setRaceLocation]  = useState(initialConfig?.raceLocation  || '')
  const [category,      setCategory]      = useState(initialConfig?.category      || '')
  const [gender,        setGender]        = useState(initialConfig?.gender        || 'mixed')
  const [selectedEvent, setSelectedEvent] = useState(initialConfig?.selectedEvent || null)
  const [customLabel,   setCustomLabel]   = useState(initialConfig?.customLabel   || '')
  const [customDistance,setCustomDistance]= useState(initialConfig?.customDistance|| '')
  const [customUnit,    setCustomUnit]    = useState(initialConfig?.customUnit    || 'm')
  const [lapDistance,   setLapDistance]   = useState(initialConfig?.lapDistance   || 400)
  const [customLapDist, setCustomLapDist] = useState(initialConfig?.customLapDist || '')
  const [coachPosition, setCoachPosition] = useState(initialConfig?.coachPosition ?? 0)
  const [raceSelected,  setRaceSelected]  = useState(initialConfig?.selected      || [])
  const [meetName,      setMeetName]      = useState(initialConfig?.meetName      || '')
  const [meetId,        setMeetId]        = useState(initialConfig?.meetId        || null)
  const [meetSlug,      setMeetSlug]      = useState(initialConfig?.meetSlug      || null)

  // ── Training state ──────────────────────────────────────────
  const [trainDate,     setTrainDate]     = useState(new Date().toISOString().slice(0,10))
  const [trainLocation, setTrainLocation] = useState('')
  const [trainPublic,   setTrainPublic]   = useState(false)
  const [groups,        setGroups]        = useState([
    { id:'g1', name:'Group 1', event:null, customDist:'', customUnit:'m', lapDist:400, customLapDist:'', runners:[] }
  ])
  const [activeGroupId, setActiveGroupId] = useState('g1')

  // ── Shared athlete state ─────────────────────────────────────
  const [taggedAthletes,   setTaggedAthletes]   = useState([])
  const [untaggedAthletes, setUntaggedAthletes] = useState([])
  const [loadingAthletes,  setLoadingAthletes]  = useState(false)

  useEffect(() => {
    loadAllAthletes()
    // Pre-populate meet name from last session
    if (!initialConfig?.meetName && !meetName) {
      try {
        const last = JSON.parse(localStorage.getItem('sw_last_race') || '{}')
        if (last.meetName) setMeetName(last.meetName)
      } catch(e) {}
    }
  }, [])

  async function loadAllAthletes() {
    setLoadingAthletes(true)
    const result = await loadStopwatchAthletes(user)
    setTaggedAthletes(result.tagged || [])
    setUntaggedAthletes(result.untagged || [])
    setLoadingAthletes(false)
  }

  // ── Race helpers ────────────────────────────────────────────
  const isOther = selectedEvent?.label === 'Other'
  const unitFactor       = UNITS.find(u=>u.label===customUnit)?.toMetres || 1
  const effectiveLabel   = isOther ? (customLabel.trim()||(customDistance?`${customDistance}${customUnit}`:'Custom')) : selectedEvent?.label
  const effectiveDistance = isOther ? Math.round((parseFloat(customDistance)||0)*unitFactor) : selectedEvent?.distance
  const effectiveLapDist  = isOther ? (parseFloat(customLapDist)>0?Math.round(parseFloat(customLapDist)*unitFactor):lapDistance) : lapDistance
  const splitDistances    = buildSplitDistances(effectiveDistance, effectiveLapDist, coachPosition)
  const raceCanStart      = raceSelected.length>0 && effectiveDistance>0

  function toggleRaceAthlete(a) {
    if (raceSelected.find(s=>s.id===a.id)) setRaceSelected(raceSelected.filter(s=>s.id!==a.id))
    else setRaceSelected([...raceSelected, { ...a, color:COLORS[raceSelected.length%COLORS.length], isManual:false }])
  }
  function addRaceManual(name) {
    const n = capitalize(name)
    setRaceSelected([...raceSelected, { id:`manual-${Date.now()}`, name:n, color:COLORS[raceSelected.length%COLORS.length], isManual:true }])
  }

  // ── Training group helpers ───────────────────────────────────
  function addGroup() {
    if (groups.length >= 6) return
    const id = `g${Date.now()}`
    setGroups([...groups, { id, name:`Group ${groups.length+1}`, event:null, customDist:'', customUnit:'m', lapDist:400, customLapDist:'', runners:[] }])
    setActiveGroupId(id)
  }
  function removeGroup(id) {
    if (groups.length <= 1) return
    const remaining = groups.filter(g=>g.id!==id)
    setGroups(remaining)
    if (activeGroupId===id) setActiveGroupId(remaining[0].id)
  }
  function updateGroup(id, patch) {
    setGroups(groups.map(g=>g.id===id?{...g,...patch}:g))
  }
  function toggleGroupAthlete(groupId, athlete) {
    setGroups(groups.map(g => {
      if (g.id !== groupId) return g
      const exists = g.runners.find(r=>r.id===athlete.id)
      if (exists) return { ...g, runners: g.runners.filter(r=>r.id!==athlete.id) }
      return { ...g, runners: [...g.runners, { ...athlete, color:COLORS[g.runners.length%COLORS.length], isManual:false }] }
    }))
  }
  function addGroupManual(groupId, name) {
    setGroups(groups.map(g => {
      if (g.id !== groupId) return g
      return { ...g, runners: [...g.runners, { id:`manual-${Date.now()}`, name, color:COLORS[g.runners.length%COLORS.length], isManual:true }] }
    }))
  }

  const trainingCanStart = groups.some(g=>g.runners.length>0)
  const activeGroup = groups.find(g=>g.id===activeGroupId)
  const S = styles

  return (
    <div style={S.page}>
      <div style={{ padding:'20px 20px 0' }}>

        {/* Mode toggle — top of screen */}
        <div style={{ display:'flex', gap:0, marginBottom:24, background:'#111827', borderRadius:12, padding:4 }}>
          {['race','training'].map(m => (
            <button key={m} onClick={()=>setMode(m)} style={{
              flex:1, padding:'10px 0', borderRadius:9, border:'none', fontSize:14, fontWeight:800,
              background: mode===m ? '#f97316' : 'transparent',
              color:      mode===m ? '#fff'    : '#6b7280',
              cursor:'pointer', textTransform:'capitalize', transition:'all 0.15s'
            }}>{m === 'race' ? '🏁 Race' : '⏱ Training'}</button>
          ))}
        </div>

        {/* ── RACE MODE ──────────────────────────────────────── */}
        {mode === 'race' && (
          <>
            {/* Meet */}
            <div style={S.section}>
              <label style={S.label}>MEET</label>
              <input
                style={S.input}
                value={meetName}
                onChange={e => { setMeetName(e.target.value); setMeetId(null); setMeetSlug(null) }}
                placeholder="Meet name (e.g. OFSAA 2026)"
              />
            </div>

            {/* Gender */}
            <div style={S.section}>
              <label style={S.label}>GENDER</label>
              <div style={{ display:'flex', gap:6 }}>
                {['Mixed','Male','Female'].map(g => (
                  <button key={g} onClick={()=>setGender(g.toLowerCase())} style={{
                    ...S.chip, padding:'7px 16px',
                    background: gender===g.toLowerCase()?'#f97316':'#111827',
                    color:      gender===g.toLowerCase()?'#fff':'#6b7280',
                  }}>{g}</button>
                ))}
              </div>
            </div>

            {/* Event */}
            <div style={S.section}>
              <label style={S.label}>EVENT</label>
              <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
                {TRACK_EVENTS.map(ev => (
                  <button key={ev.label} onClick={()=>setSelectedEvent(ev)} style={{
                    ...S.chip,
                    background: selectedEvent?.label===ev.label?'#f97316':'#111827',
                    color:      selectedEvent?.label===ev.label?'#fff':'#6b7280',
                  }}>{ev.label}</button>
                ))}
              </div>
              {isOther && (
                <div style={{ marginTop:10, display:'flex', flexDirection:'column', gap:8 }}>
                  <input style={S.input} value={customLabel} onChange={e=>setCustomLabel(e.target.value)} placeholder="Event name (optional)" />
                  <div style={{ display:'flex', gap:8 }}>
                    <input style={{ ...S.input, flex:2 }} type="number" value={customDistance} onChange={e=>setCustomDistance(e.target.value)} placeholder="Total distance" />
                    <div style={{ display:'flex', gap:4 }}>
                      {UNITS.map(u=>(
                        <button key={u.label} onClick={()=>setCustomUnit(u.label)} style={{ ...S.miniChip, background:customUnit===u.label?'#f97316':'#1f2937', color:customUnit===u.label?'#fff':'#6b7280' }}>{u.label}</button>
                      ))}
                    </div>
                  </div>
                  <input style={S.input} type="number" value={customLapDist} onChange={e=>setCustomLapDist(e.target.value)} placeholder={`Lap/loop distance (${customUnit}) — blank = single split`} />
                </div>
              )}
            </div>

            {/* Lap distance + Timing location */}
            {selectedEvent && (
              <div style={S.section}>
                <label style={S.label}>SETTINGS</label>
                <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
                  <div style={S.settingCard}>
                    <div style={S.settingLabel}>LAP DISTANCE</div>
                    <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                      {isOther ? (
                        <span style={{ color:effectiveLapDist?'#f97316':'#4b5563', fontSize:13, fontWeight:700 }}>{effectiveLapDist?`${effectiveLapDist}m`:'Set above'}</span>
                      ) : (
                        <>
                          {[200,300,400].map(l=>(
                            <button key={l} onClick={()=>setLapDistance(l)} style={{ ...S.miniChip, background:lapDistance===l?'#f97316':'#1f2937', color:lapDistance===l?'#fff':'#6b7280' }}>{l}m</button>
                          ))}
                          <input type="number" placeholder="other" style={{ ...S.input, width:70, padding:'4px 8px', fontSize:12 }} onChange={e=>{ const v=parseInt(e.target.value); if(!isNaN(v)&&v>0) setLapDistance(v) }} />
                        </>
                      )}
                    </div>
                  </div>
                  {effectiveDistance > effectiveLapDist && (
                    <div style={S.settingCard}>
                      <div style={S.settingLabel}>TIMING LOCATION</div>
                      <div style={{ display:'flex', gap:6, flexWrap:'wrap', alignItems:'center' }}>
                        {[0,50,100,150,200,300].filter(p=>p<effectiveLapDist).map(p=>(
                          <button key={p} onClick={()=>setCoachPosition(p)} style={{ ...S.miniChip, background:coachPosition===p?'#f97316':'#1f2937', color:coachPosition===p?'#fff':'#6b7280' }}>
                            {p===0?'Start':`${p}m`}
                          </button>
                        ))}
                        <input type="number" placeholder="custom m" style={{ ...S.input, width:80, padding:'4px 8px', fontSize:12 }} onChange={e=>{ const v=parseInt(e.target.value); if(!isNaN(v)&&v>=0&&v<effectiveLapDist) setCoachPosition(v) }} />
                      </div>
                    </div>
                  )}
                </div>
                {splitDistances.length>0 && (
                  <div style={{ marginTop:10, padding:'10px 14px', background:'#111827', borderRadius:10, border:'1px solid #1f2937' }}>
                    <div style={S.settingLabel}>{splitDistances.length} SPLITS · {effectiveDistance}m TOTAL</div>
                    <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginTop:6 }}>
                      {splitDistances.map((d,i)=>{
                        const cd=splitDistances.slice(0,i+1).reduce((a,b)=>a+b,0)
                        const isF=i===0,isL=i===splitDistances.length-1
                        return (
                          <div key={i} style={{ textAlign:'center', padding:'4px 10px', borderRadius:8, background:isF||isL?'#f9731622':'#0d1117', border:`1px solid ${isF||isL?'#f97316':'#1f2937'}` }}>
                            <div style={{ fontSize:9, color:isF||isL?'#f97316':'#4b5563', fontWeight:700 }}>{isL?'🏁':'S'}{i+1}</div>
                            <div style={{ fontSize:13, color:'#fff', fontWeight:800 }}>{d}m</div>
                            <div style={{ fontSize:9, color:'#4b5563' }}>{cd}m</div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Athletes */}
            {selectedEvent && (
              <div style={S.section}>
                <label style={S.label}>ATHLETES</label>
                <AthletePicker
                  tagged={taggedAthletes} untagged={untaggedAthletes}
                  selected={raceSelected} loading={loadingAthletes}
                  onToggle={toggleRaceAthlete} onAddManual={addRaceManual}
                  onAthleteAdded={a => {
                    if (a.sport) setTaggedAthletes(prev => [...prev, a])
                    else setUntaggedAthletes(prev => [...prev, a])
                  }}
                />
                {raceSelected.length>0 && (
                  <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginTop:10 }}>
                    {raceSelected.map(r=>(
                      <div key={r.id} style={{ display:'flex', alignItems:'center', gap:5, background:'#0d1117', border:`1.5px solid ${r.color}44`, borderRadius:999, padding:'5px 10px' }}>
                        <div style={{ width:7, height:7, borderRadius:'50%', background:r.color }} />
                        <span style={{ color:'#fff', fontSize:12, fontWeight:600 }}>{r.name}</span>
                        <button onClick={()=>setRaceSelected(raceSelected.filter(s=>s.id!==r.id))} style={{ background:'none', border:'none', color:'#4b5563', fontSize:13, cursor:'pointer', padding:0 }}>✕</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}



            <button
              onClick={() => {
                if (!raceCanStart) return
                try { localStorage.setItem('sw_last_race', JSON.stringify({ raceName, raceLocation, meetName })) } catch(e) {}
                onStart({
                  isRace:true, runners:raceSelected, eventLabel:effectiveLabel,
                  lapDistance:effectiveLapDist, coachPosition,
                  distance:effectiveDistance, splitDistances,
                  selectedEvent, customLabel, customDistance, customUnit, customLapDist,
                  raceName, raceDate, raceLocation, category, gender,
                  sport: 'Running',
                  meetName, meetId, meetSlug
                })
              }}
              disabled={!raceCanStart}
              style={{ ...S.startBtn, background:raceCanStart?'#f97316':'#1f2937', color:raceCanStart?'#fff':'#4b5563', cursor:raceCanStart?'pointer':'not-allowed', marginBottom:32 }}
            >Review &amp; Start Race 🏁</button>
          </>
        )}

        {/* ── TRAINING MODE ──────────────────────────────────── */}
        {mode === 'training' && (
          <>
            {/* Training details */}
            <div style={S.section}>
              <label style={S.label}>SESSION DETAILS</label>
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                <div style={{ display:'flex', gap:8 }}>
                  <input style={{ ...S.input, flex:1 }} type="date" value={trainDate} onChange={e=>setTrainDate(e.target.value)} />
                  <input style={{ ...S.input, flex:2 }} value={trainLocation} onChange={e=>setTrainLocation(e.target.value)} placeholder="Location / venue" />
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <button onClick={()=>setTrainPublic(v=>!v)} style={{ display:'flex', alignItems:'center', gap:8, background:'#111827', border:`1.5px solid ${trainPublic?'#f97316':'#1f2937'}`, borderRadius:10, padding:'8px 14px', cursor:'pointer' }}>
                    <div style={{ width:16, height:16, borderRadius:4, background:trainPublic?'#f97316':'#374151', display:'flex', alignItems:'center', justifyContent:'center' }}>
                      {trainPublic && <span style={{ color:'#fff', fontSize:10, fontWeight:800 }}>✓</span>}
                    </div>
                    <span style={{ color:trainPublic?'#f97316':'#6b7280', fontSize:13, fontWeight:600 }}>Public scoreboard</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Group tabs */}
            <div style={S.section}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
                <label style={{ ...S.label, marginBottom:0 }}>GROUPS</label>
                {groups.length < 6 && (
                  <button onClick={addGroup} style={{ background:'#1f2937', border:'none', borderRadius:8, color:'#9ca3af', fontSize:12, fontWeight:700, padding:'5px 12px', cursor:'pointer' }}>+ Add Group</button>
                )}
              </div>

              {/* Tab bar */}
              <div style={{ display:'flex', gap:4, marginBottom:12, overflowX:'auto' }}>
                {groups.map(g => (
                  <button key={g.id} onClick={()=>setActiveGroupId(g.id)} style={{
                    padding:'7px 14px', borderRadius:8, border:'none', fontSize:13, fontWeight:700, cursor:'pointer', whiteSpace:'nowrap',
                    background: activeGroupId===g.id ? '#f97316' : '#111827',
                    color:      activeGroupId===g.id ? '#fff'    : '#6b7280',
                  }}>
                    {g.name}
                    {g.runners.length>0 && <span style={{ marginLeft:5, fontSize:10, opacity:0.7 }}>{g.runners.length}</span>}
                  </button>
                ))}
              </div>

              {/* Active group editor */}
              {activeGroup && (
                <div style={{ background:'#0d1117', borderRadius:14, border:'1px solid #1f2937', padding:'14px' }}>
                  {/* Group name */}
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
                    <input
                      style={{ ...S.input, flex:1, fontSize:14, fontWeight:700, background:'transparent', border:'none', padding:'4px 0', outline:'none' }}
                      value={activeGroup.name}
                      onChange={e=>updateGroup(activeGroup.id,{name:e.target.value})}
                      placeholder="Group name"
                    />
                    {groups.length>1 && (
                      <button onClick={()=>removeGroup(activeGroup.id)} style={{ background:'none', border:'none', color:'#4b5563', fontSize:12, cursor:'pointer' }}>Remove</button>
                    )}
                  </div>

                  {/* Group event */}
                  <div style={{ marginBottom:12 }}>
                    <div style={S.settingLabel}>EVENT / DISTANCE</div>
                    <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:6 }}>
                      {TRACK_EVENTS.map(ev=>(
                        <button key={ev.label} onClick={()=>updateGroup(activeGroup.id,{event:ev})} style={{
                          padding:'5px 12px', borderRadius:999, border:'none', fontSize:12, fontWeight:700, cursor:'pointer',
                          background: activeGroup.event?.label===ev.label?'#f97316':'#1f2937',
                          color:      activeGroup.event?.label===ev.label?'#fff':'#6b7280',
                        }}>{ev.label}</button>
                      ))}
                    </div>
                    {activeGroup.event?.label==='Other' && (
                      <div style={{ display:'flex', gap:8, marginTop:6 }}>
                        <input style={{ ...S.input, flex:2 }} type="number" value={activeGroup.customDist} onChange={e=>updateGroup(activeGroup.id,{customDist:e.target.value})} placeholder="Distance" />
                        <div style={{ display:'flex', gap:4 }}>
                          {UNITS.map(u=>(
                            <button key={u.label} onClick={()=>updateGroup(activeGroup.id,{customUnit:u.label})} style={{ ...S.miniChip, background:activeGroup.customUnit===u.label?'#f97316':'#1f2937', color:activeGroup.customUnit===u.label?'#fff':'#6b7280' }}>{u.label}</button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Loop distance */}
                  <div style={{ marginBottom:12 }}>
                    <div style={S.settingLabel}>LOOP / LAP DISTANCE</div>
                    <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                      {[200,300,400].map(l=>(
                        <button key={l} onClick={()=>updateGroup(activeGroup.id,{lapDist:l})} style={{ ...S.miniChip, background:activeGroup.lapDist===l?'#f97316':'#1f2937', color:activeGroup.lapDist===l?'#fff':'#6b7280' }}>{l}m</button>
                      ))}
                      <input type="number" placeholder="custom" style={{ ...S.input, width:80, padding:'4px 8px', fontSize:12 }} onChange={e=>{ const v=parseInt(e.target.value); if(!isNaN(v)&&v>0) updateGroup(activeGroup.id,{lapDist:v}) }} />
                    </div>
                  </div>

                  {/* Athletes */}
                  <div>
                    <div style={S.settingLabel}>RUNNERS ({activeGroup.runners.length})</div>
                    <AthletePicker
                      tagged={taggedAthletes} untagged={untaggedAthletes}
                      selected={activeGroup.runners} loading={loadingAthletes}
                      onToggle={a=>toggleGroupAthlete(activeGroup.id,a)}
                      onAddManual={name=>addGroupManual(activeGroup.id,name)}
                    />
                    {activeGroup.runners.length>0 && (
                      <div style={{ display:'flex', flexWrap:'wrap', gap:5, marginTop:8 }}>
                        {activeGroup.runners.map(r=>(
                          <div key={r.id} style={{ display:'flex', alignItems:'center', gap:4, background:'#111827', border:`1px solid ${r.color}44`, borderRadius:999, padding:'4px 10px' }}>
                            <div style={{ width:6, height:6, borderRadius:'50%', background:r.color }} />
                            <span style={{ color:'#fff', fontSize:12, fontWeight:600 }}>{r.name}</span>
                            <button onClick={()=>toggleGroupAthlete(activeGroup.id,r)} style={{ background:'none', border:'none', color:'#4b5563', fontSize:12, cursor:'pointer', padding:0 }}>✕</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={() => trainingCanStart && onStart({
                isRace:false, mode:'training',
                trainDate, trainLocation, trainPublic, groups
              })}
              disabled={!trainingCanStart}
              style={{ ...S.startBtn, background:trainingCanStart?'#3b82f6':'#1f2937', color:trainingCanStart?'#fff':'#4b5563', cursor:trainingCanStart?'pointer':'not-allowed', marginBottom:32 }}
            >Go to Training Timer ⏱</button>
          </>
        )}
      </div>
      <BottomNav />
    </div>
  )
}

// ── Pre-Race Screen ────────────────────────────────────────────
function PreRaceScreen({ config, onStart, onBack, onInitRace }) {
  const { runners, eventLabel, splitDistances, distance, isRace, meetName, meetSlug } = config
  const scoreboardUrl = meetSlug ? `${window.location.origin}/scoreboard/${meetSlug}` : null
  const [copied, setCopied] = useState(false)

  // Create race as pending in DB when coach reaches this screen
  useEffect(() => {
    if (isRace && onInitRace) onInitRace()
  }, [])

  function copyLink() {
    if (!scoreboardUrl) return
    navigator.clipboard.writeText(scoreboardUrl).then(() => { setCopied(true); setTimeout(()=>setCopied(false),2000) })
  }

  return (
    <div style={styles.page}>
      <div style={{ padding:'32px 24px 0' }}>

        {/* Event header */}
        <div style={{ textAlign:'center', marginBottom:24 }}>
          <div style={{ fontSize:42, marginBottom:8 }}>🏁</div>
          <h1 style={{ color:'#fff', fontSize:28, fontWeight:800, margin:'0 0 4px' }}>{eventLabel}</h1>
          <div style={{ color:'#6b7280', fontSize:13 }}>
            {isRace ? 'Race' : 'Training'} · {distance}m · {splitDistances.length} splits
          </div>
          {meetName && <div style={{ color:'#f97316', fontSize:12, fontWeight:600, marginTop:4 }}>{meetName}</div>}
        </div>

        {/* Scoreboard link */}
        {scoreboardUrl && isRace && (
          <div style={{ background:'#0d1117', borderRadius:12, border:'1px solid #1f2937', padding:'12px 16px', marginBottom:20 }}>
            <div style={{ fontSize:10, color:'#4b5563', fontWeight:600, letterSpacing:0.5, marginBottom:8 }}>LIVE SCOREBOARD</div>
            <div style={{ display:'flex', gap:8, alignItems:'center' }}>
              <div style={{ flex:1, background:'#111827', borderRadius:8, padding:'8px 10px', fontSize:11, color:'#6b7280', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                {scoreboardUrl}
              </div>
              <button onClick={copyLink} style={{ background:copied?'#4ade8022':'#1f2937', border:`1px solid ${copied?'#4ade80':'#374151'}`, borderRadius:8, color:copied?'#4ade80':'#9ca3af', fontSize:11, fontWeight:700, padding:'8px 12px', cursor:'pointer', whiteSpace:'nowrap' }}>
                {copied ? '✓ Copied' : 'Copy'}
              </button>
              <a href={scoreboardUrl} target="_blank" rel="noopener noreferrer" style={{ background:'#1f2937', border:'1px solid #374151', borderRadius:8, color:'#9ca3af', fontSize:11, fontWeight:700, padding:'8px 12px', textDecoration:'none', whiteSpace:'nowrap' }}>
                Open ↗
              </a>
            </div>
          </div>
        )}

        {/* Split distances */}
        <div style={{ marginBottom:20 }}>
          <div style={{ fontSize:11, color:'#6b7280', letterSpacing:0.8, fontWeight:600, marginBottom:8 }}>SPLITS</div>
          <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
            {splitDistances.map((d,i) => {
              const cd = splitDistances.slice(0,i+1).reduce((a,b)=>a+b,0)
              const isFin = i===splitDistances.length-1
              return (
                <div key={i} style={{ textAlign:'center', padding:'6px 12px', borderRadius:10, background:isFin?'#14532d':'#111827', border:`1px solid ${isFin?'#4ade8044':'#1f2937'}` }}>
                  <div style={{ fontSize:9, color:isFin?'#4ade80':'#6b7280', fontWeight:700 }}>{isFin?'🏁':`S${i+1}`}</div>
                  <div style={{ fontSize:14, color:'#fff', fontWeight:800 }}>{d}m</div>
                  <div style={{ fontSize:9, color:'#374151' }}>{cd}m</div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Athletes */}
        <div style={{ marginBottom:28 }}>
          <div style={{ fontSize:11, color:'#6b7280', letterSpacing:0.8, fontWeight:600, marginBottom:8 }}>ATHLETES ({runners.length})</div>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {runners.map((r) => (
              <div key={r.id} style={{ display:'flex', alignItems:'center', gap:12, background:'#0d1117', borderRadius:12, padding:'12px 16px', border:`1.5px solid ${r.color}33` }}>
                <div style={{ width:10, height:10, borderRadius:'50%', background:r.color, flexShrink:0 }} />
                <span style={{ color:'#fff', fontSize:15, fontWeight:700 }}>{r.name}</span>
                {r.isManual && <span style={{ fontSize:10, color:'#4b5563', marginLeft:'auto' }}>manual</span>}
              </div>
            ))}
          </div>
        </div>

        <button onClick={onStart} style={{ ...styles.primaryBtn, fontSize:20, padding:'18px 0', marginBottom:12 }}>
          Start {isRace ? 'Race' : 'Timer'} 🏁
        </button>
        <button onClick={onBack} style={styles.secondaryBtn}>
          ← Back to Setup
        </button>
      </div>
      <BottomNav />
    </div>
  )
}

// ── Race Screen ────────────────────────────────────────────────
function RaceScreen({ config, dbRaceId: initialDbRaceId, dbAthleteMap: initialDbAthleteMap, onFinish, onFalseStart, onBackToSetup }) {
  const { user } = useAuth()
  const { runners, eventLabel, isRace, splitDistances, distance, meetName, meetId, meetSlug, gender, category } = config

  const [elapsed,        setElapsed]        = useState(0)
  const [stopped,        setStopped]        = useState(false)
  const [paused,         setPaused]         = useState(false)
  const [showFalseStart, setShowFalseStart] = useState(true)
  const [dnfUndo,        setDnfUndo]        = useState(null)
  const [editingSplit,   setEditingSplit]   = useState(null)
  const [editValue,      setEditValue]      = useState('')
  const [displayOrder,   setDisplayOrder]   = useState(() => runners.map(r => r.id))
  const [runnerState,    setRunnerState]    = useState(() =>
    runners.map(r => ({ ...r, splits:[], finished:false, finishMs:null, dnf:false }))
  )
  // DB state from props
  const dbRaceId      = initialDbRaceId
  const dbAthleteMap  = initialDbAthleteMap
  const activeMeetSlug = config.meetSlug
  const placeTimerRef = useRef(null)
  const [placeOverlay, setPlaceOverlay] = useState(null)

  const startRef     = useRef(null)  // set synchronously on mount via useLayoutEffect
  const pausedAtRef  = useRef(null)
  const rafRef       = useRef(null)
  const longPressRef = useRef({})
  const totalSplits  = splitDistances.length

  function cumDist(si) { return splitDistances.slice(0,si+1).reduce((a,b)=>a+b,0) }

  // ── DB helpers ─────────────────────────────────────────────
  async function updateAthleteInDB(runnerId, splits, finalTimeMs, status, place) {
    if (!dbAthleteMap[runnerId]) return
    try {
      const update = { splits: splits.map((t,i) => ({ lap: i+1, time_ms: t, split_ms: i===0?t:t-splits[i-1] })) }
      if (finalTimeMs != null) { update.final_time_ms = finalTimeMs; update.status = 'finished' }
      if (status === 'dnf') update.status = 'dnf'
      if (status === 'active') update.status = 'active'
      if (place != null) update.place = place
      await supabase.from('race_athletes').update(update).eq('id', dbAthleteMap[runnerId])
    } catch(e) { console.error('DB update error:', e) }
  }

  async function finalizeRaceInDB() {
    if (!dbRaceId) return
    try {
      await supabase.from('races').update({ status:'completed', completed_at: new Date().toISOString() }).eq('id', dbRaceId)
    } catch(e) { console.error('DB finalize error:', e) }
  }

  async function startRaceInDB() {
    if (!dbRaceId) return
    try {
      await supabase.from('races').update({ status:'in-progress', started_at: new Date().toISOString() }).eq('id', dbRaceId)
    } catch(e) { console.error('DB start error:', e) }
  }

  async function falseStartRaceInDB() {
    if (!dbRaceId) return
    try {
      await supabase.from('races').update({ status:'false_start' }).eq('id', dbRaceId)
    } catch(e) { console.error('DB false start error:', e) }
  }
  // Set start time synchronously before first paint — ensures lap 1 measures from this exact moment
  useLayoutEffect(() => {
    startRef.current = Date.now()
  }, [])

  useEffect(() => {
    let lock = null
    async function acquire() { try { if('wakeLock' in navigator) lock = await navigator.wakeLock.request('screen') } catch{} }
    acquire()
    return () => lock?.release?.()
  }, [])

  // RAF — only ticks after startRef is set
  useEffect(() => {
    function tick() {
      if (!pausedAtRef.current && startRef.current) { setElapsed(Date.now()-startRef.current); rafRef.current=requestAnimationFrame(tick) }
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [])

  // Start race in DB when timer begins (called from parent after PreRaceScreen)
  useEffect(() => {
    if (isRace) startRaceInDB()
  }, [])

  // False start button hides after 5s
  useEffect(() => {
    const t = setTimeout(()=>setShowFalseStart(false), 5000)
    return () => clearTimeout(t)
  }, [])

  // Reorder after each split cycle
  useEffect(() => {
    const active = runnerState.filter(r=>!r.dnf)
    if (!active.length) return
    const minSplits = Math.min(...active.map(r=>r.splits.length))
    if (minSplits === 0) return
    const sorted = [...runnerState].filter(r=>!r.dnf).sort((a,b) => {
      const aS=a.splits.length+(a.finished?0:0), bS=b.splits.length+(b.finished?0:0)
      if (bS!==aS) return bS-aS
      const aT=a.finished?a.finishMs:(a.splits[a.splits.length-1]??Infinity)
      const bT=b.finished?b.finishMs:(b.splits[b.splits.length-1]??Infinity)
      return aT-bT
    }).map(r=>r.id)
    setDisplayOrder([...sorted, ...runnerState.filter(r=>r.dnf).map(r=>r.id)])
  }, [runnerState])

  function tapRunner(runnerId) {
    if (stopped||paused) return
    const now = Date.now()-startRef.current
    setRunnerState(prev => {
      const next = prev.map(r => {
        if (r.id!==runnerId||r.finished||r.dnf) return r
        const isFinish = r.splits.length >= totalSplits-1
        if (isFinish) {
          const newSplits = [...r.splits, now]
          // DB update
          updateAthleteInDB(runnerId, newSplits, now, 'finished', null)
          // Show place overlay (non-blocking, races only)
          if (isRace) {
            clearTimeout(placeTimerRef.current)
            setPlaceOverlay({ runnerId, name: r.name, finishMs: now })
            placeTimerRef.current = setTimeout(() => setPlaceOverlay(null), 4000)
          }
          return { ...r, finished:true, finishMs:now, splits:newSplits }
        }
        const newSplits = [...r.splits, now]
        updateAthleteInDB(runnerId, newSplits, null, 'active', null)
        return { ...r, splits:newSplits }
      })
      const active = next.filter(r=>!r.dnf)
      if (active.length>0 && active.every(r=>r.finished)) {
        pausedAtRef.current=now; cancelAnimationFrame(rafRef.current); setStopped(true); setElapsed(now)
        finalizeRaceInDB()
      }
      return next
    })
  }

  function confirmPlace(runnerId, place) {
    clearTimeout(placeTimerRef.current)
    setPlaceOverlay(null)
    setRunnerState(prev => prev.map(r => r.id===runnerId ? {...r, place} : r))
    updateAthleteInDB(runnerId, runnerState.find(r=>r.id===runnerId)?.splits||[], runnerState.find(r=>r.id===runnerId)?.finishMs, 'finished', place)
  }

  function endRace() {
    const now = Date.now()-startRef.current
    pausedAtRef.current=now; cancelAnimationFrame(rafRef.current); setElapsed(now); setStopped(true)
    setRunnerState(prev => prev.map(r => {
      if (r.finished||r.dnf) return r
      const newSplits = [...r.splits, now]
      updateAthleteInDB(r.id, newSplits, now, 'finished', null)
      return { ...r, finished:true, finishMs:now, splits:newSplits }
    }))
    finalizeRaceInDB()
  }

  function markDNF(runnerId) {
    const runner = runnerState.find(r=>r.id===runnerId)
    if (!runner) return
    setRunnerState(prev=>prev.map(r=>r.id===runnerId?{...r,dnf:true}:r))
    updateAthleteInDB(runnerId, runner.splits, null, 'dnf', null)
    const timer = setTimeout(()=>setDnfUndo(null), 3000)
    setDnfUndo({ id:runnerId, name:runner.name, timer })
  }

  function undoDNF() {
    if (!dnfUndo) return
    clearTimeout(dnfUndo.timer)
    const runner = runnerState.find(r=>r.id===dnfUndo.id)
    setRunnerState(prev=>prev.map(r=>r.id===dnfUndo.id?{...r,dnf:false}:r))
    if (runner) updateAthleteInDB(dnfUndo.id, runner.splits, null, 'active', null)
    setDnfUndo(null)
  }

  function falseStart() {
    cancelAnimationFrame(rafRef.current)
    pausedAtRef.current = 1
    setPaused(true)
    falseStartRaceInDB()
  }

  function restartRace() {
    pausedAtRef.current = null
    startRef.current = Date.now()
    setStopped(false); setPaused(false)
    setRunnerState(prev=>prev.map(r=>({...r,splits:[],finished:false,finishMs:null,dnf:false})))
    setDisplayOrder(runners.map(r=>r.id))
    setShowFalseStart(true)
    setTimeout(()=>setShowFalseStart(false),5000)
    rafRef.current = requestAnimationFrame(function tick(){
      if(!pausedAtRef.current){setElapsed(Date.now()-startRef.current);rafRef.current=requestAnimationFrame(tick)}
    })
  }

  function openEditSplit(runnerId, si) {
    const runner = runnerState.find(r=>r.id===runnerId)
    setEditingSplit({id:runnerId,si})
    setEditValue(runner?.splits[si]!=null ? formatMs(runner.splits[si]) : '')
  }

  function saveEditSplit() {
    if (!editingSplit) return
    const parts = editValue.match(/^(\d+):(\d{2})\.(\d{2})$/)
    if (!parts) { setEditingSplit(null); return }
    const ms = (parseInt(parts[1])*60+parseInt(parts[2]))*1000+parseInt(parts[3])*10
    const {id,si} = editingSplit
    setRunnerState(prev=>prev.map(r=>{
      if(r.id!==id) return r
      const s=[...r.splits]; s[si]=ms
      return {...r, splits:s, finishMs:r.finished?s[s.length-1]:r.finishMs}
    }))
    setEditingSplit(null)
  }

  function predictedFinish(runner) {
    if (runner.finished||runner.splits.length===0||!distance) return null
    const cd = cumDist(runner.splits.length-1)
    const t  = runner.splits[runner.splits.length-1]
    return Math.round((t/cd)*distance)
  }

  const orderedRunners = displayOrder.map(id=>runnerState.find(r=>r.id===id)).filter(Boolean)
  const maxSplits = Math.max(...runnerState.map(r=>r.splits.length),0)

  // False start overlay
  if (paused) return (
    <div style={styles.page}>
      <div style={{ padding:'60px 24px 0', textAlign:'center' }}>
        <div style={{ fontSize:48, marginBottom:16 }}>⚠️</div>
        <h2 style={{ color:'#fff', fontSize:22, fontWeight:800, marginBottom:8 }}>False Start</h2>
        <p style={{ color:'#6b7280', fontSize:14, marginBottom:40 }}>Race stopped. Head back to the start line.</p>
        <button onClick={() => onFalseStart(config)} style={{ ...styles.primaryBtn, maxWidth:320, margin:'0 auto' }}>
          Back to Start Line →
        </button>
        <button onClick={() => onBackToSetup(config)} style={{ ...styles.secondaryBtn, maxWidth:320, margin:'16px auto 0', display:'block' }}>
          Edit Setup
        </button>
      </div>
      <BottomNav />
    </div>
  )

  return (
    <div style={styles.page}>

      {/* Clock bar */}
      <div style={{ textAlign:'center', padding:'14px 20px 12px', background:'#0d1117', borderBottom:'1px solid #1f2937', position:'relative' }}>
        {/* Scoreboard link — top left, opens new tab */}
        {activeMeetSlug && isRace && (
          <a
            href={`/scoreboard/${activeMeetSlug}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ position:'absolute', top:12, left:14, background:'#111827', border:'1px solid #1f2937', borderRadius:8, color:'#6b7280', fontSize:11, fontWeight:700, padding:'6px 10px', textDecoration:'none', display:'flex', alignItems:'center', gap:4 }}
          >
            📊 Live
          </a>
        )}
        <div style={{ fontSize:11, color:'#6b7280', letterSpacing:1, marginBottom:2 }}>{eventLabel?.toUpperCase()}</div>
        <div style={{ fontSize:52, fontWeight:800, color:stopped?'#4ade80':'#fff', fontVariantNumeric:'tabular-nums', letterSpacing:-2, lineHeight:1 }}>
          {formatMs(elapsed)}
        </div>
        {stopped && <div style={{ fontSize:11, color:'#4ade80', marginTop:4, fontWeight:700, letterSpacing:1 }}>FINISHED</div>}
        {showFalseStart && !stopped && (
          <button onClick={falseStart} style={{ position:'absolute', top:12, right:14, background:'#7f1d1d', border:'1.5px solid #ef4444', borderRadius:8, color:'#fca5a5', fontSize:11, fontWeight:800, padding:'6px 10px', cursor:'pointer' }}>
            ↺ FALSE START
          </button>
        )}
      </div>

      <div style={{ padding:'10px 14px', display:'flex', flexDirection:'column', gap:10 }}>

        {/* DNF undo */}
        {dnfUndo && (
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', background:'#1f2937', borderRadius:10, padding:'10px 14px', border:'1px solid #374151' }}>
            <span style={{ color:'#9ca3af', fontSize:13 }}>{dnfUndo.name} marked DNF</span>
            <button onClick={undoDNF} style={{ background:'#f97316', border:'none', borderRadius:6, color:'#fff', fontSize:12, fontWeight:800, padding:'4px 10px', cursor:'pointer' }}>UNDO</button>
          </div>
        )}

        {/* Runner cards */}
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {orderedRunners.map(runner => {
            const si           = runner.splits.length
            const nextDist     = splitDistances[si] ?? null
            const nextCumDist  = si < splitDistances.length ? cumDist(si) : distance
            const lastMs       = runner.splits.length>0 ? runner.splits[runner.splits.length-1] : 0
            const currentLapMs = runner.finished||runner.dnf ? null : elapsed-lastMs
            const predicted    = predictedFinish(runner)
            const isFinishTap  = si >= totalSplits-1

            return (
              <div key={runner.id} style={{
                background:'#0d1117', borderRadius:14, padding:'10px 12px',
                border:`1.5px solid ${runner.finished?'#4ade8044':runner.dnf?'#1f2937':runner.color+'44'}`,
                opacity:runner.dnf?0.45:1, transition:'opacity 0.2s',
                display:'flex', alignItems:'center', gap:10
              }}>
                <div style={{ width:10, height:10, borderRadius:'50%', background:runner.color, flexShrink:0 }} />

                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ color:runner.dnf?'#4b5563':runner.finished?'#9ca3af':'#fff', fontSize:15, fontWeight:700, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                    {runner.name}
                  </div>
                  {runner.dnf ? (
                    <div style={{ fontSize:12, color:'#ef4444', fontWeight:600 }}>DNF</div>
                  ) : runner.finished ? (
                    <div style={{ color:'#4ade80', fontSize:13, fontWeight:700, fontVariantNumeric:'tabular-nums' }}>
                      ✓ {formatMs(runner.finishMs)}
                      <span style={{ color:'#4b5563', fontWeight:400, marginLeft:8 }}>{formatPace(runner.finishMs, distance)}</span>
                    </div>
                  ) : (
                    <div style={{ fontSize:12, color:runner.color, fontVariantNumeric:'tabular-nums' }}>
                      Split {si+1}/{totalSplits} · {nextCumDist}m · {formatMs(currentLapMs)}
                      {predicted && <span style={{ color:'#4b5563', marginLeft:8 }}>→ ~{formatMs(predicted)}</span>}
                    </div>
                  )}
                </div>

                {!runner.finished && !runner.dnf && (
                  <button
                    onPointerDown={()=>longPressRef.current[runner.id]=setTimeout(()=>markDNF(runner.id),600)}
                    onPointerUp={()=>{ clearTimeout(longPressRef.current[runner.id]); tapRunner(runner.id) }}
                    onPointerLeave={()=>clearTimeout(longPressRef.current[runner.id])}
                    style={{
                      background:isFinishTap?'#4ade80':runner.color, border:'none', borderRadius:12,
                      color:'#000', fontSize:14, fontWeight:800, padding:'12px 16px',
                      cursor:'pointer', flexShrink:0, minWidth:72, textAlign:'center',
                      WebkitUserSelect:'none', userSelect:'none'
                    }}
                  >
                    {isFinishTap ? '🏁' : `${nextDist}m`}
                  </button>
                )}
              </div>
            )
          })}
        </div>

        {/* End race / View results */}
<div className="flex gap-2">
  {!stopped ? (
    <button 
      onClick={endRace} 
      className="flex-1 bg-gray-800 border-none rounded-xl text-gray-400 text-xs font-bold py-3 cursor-pointer hover:bg-gray-700 transition-colors"
    >
      End Race
    </button>
  ) : (
    <button 
      onClick={() => onFinish(runnerState, {
        ...config, 
        meetSlug: activeMeetSlug || config.meetSlug, 
        meetName: meetName || config.meetName
      })} 
      className="flex-1 bg-blue-600 text-white rounded-xl py-3 font-bold hover:bg-blue-500 transition-colors"
    >
      View Results →
    </button>
  )}
</div>

        {/* Split table */}
        {maxSplits > 0 && (
          <div style={{ background:'#0d1117', borderRadius:14, border:'1.5px solid #1f2937', overflow:'hidden' }}>
            <div style={{ fontSize:11, color:'#6b7280', padding:'10px 14px 6px', letterSpacing:0.5, fontWeight:600 }}>SPLITS</div>
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', minWidth:runners.length*100+80 }}>
                <thead>
                  <tr>
                    <th style={{ ...styles.th, textAlign:'left', paddingLeft:14, width:80 }}>SPLIT</th>
                    {orderedRunners.filter(r=>!r.dnf).map(r=>(
                      <th key={r.id} style={{ ...styles.th, color:r.color }}>{r.name.split(' ')[0]}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Array.from({length:maxSplits}).map((_,si)=>{
                    const dist  = splitDistances[si]
                    const cd    = cumDist(si)
                    const isFin = si===splitDistances.length-1
                    return (
                      <tr key={si}>
                        <td style={{ ...styles.td, textAlign:'left', paddingLeft:14 }}>
                          <div style={{ fontSize:11, fontWeight:700, color:isFin?'#4ade80':'#9ca3af' }}>{isFin?'🏁':`S${si+1}`} {dist}m</div>
                          <div style={{ fontSize:10, color:'#374151' }}>{cd}m</div>
                        </td>
                        {orderedRunners.filter(r=>!r.dnf).map(runner=>{
                          const prev   = si===0 ? 0 : runner.splits[si-1]
                          const lapMs  = runner.splits[si]!=null ? runner.splits[si]-prev : null
                          const cumMs  = runner.splits[si]
                          const isFinal = runner.finished && si===runner.splits.length-1
                          return (
                            <td key={runner.id} style={{ ...styles.td, color:isFinal?'#4ade80':'#fff', cursor:lapMs!=null?'pointer':'default' }}
                              onClick={()=>lapMs!=null&&openEditSplit(runner.id,si)}>
                              {lapMs!=null ? (
                                <div>
                                  <div style={{ fontWeight:700 }}>{formatMs(lapMs)}</div>
                                  <div style={{ fontSize:10, color:'#6b7280' }}>{formatMs(cumMs)}</div>
                                  <div style={{ fontSize:9, color:'#374151' }}>{formatPace(lapMs,dist)}</div>
                                  <div style={{ fontSize:9, color:'#374151' }}>∑{formatPace(cumMs,cd)}</div>
                                </div>
                              ) : <span style={{ color:'#374151' }}>—</span>}
                            </td>
                          )
                        })}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Place overlay — slides up after finish, non-blocking */}
      {placeOverlay && (
        <div style={{ position:'fixed', bottom:80, left:0, right:0, zIndex:200, padding:'0 16px' }}>
          <div style={{ background:'#111827', borderRadius:16, border:'1.5px solid #374151', padding:'16px', boxShadow:'0 -4px 24px #000a' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
              <div>
                <div style={{ color:'#fff', fontSize:15, fontWeight:800 }}>{placeOverlay.name}</div>
                <div style={{ color:'#4ade80', fontSize:13, fontVariantNumeric:'tabular-nums' }}>{formatMs(placeOverlay.finishMs)}</div>
              </div>
              <button onClick={()=>setPlaceOverlay(null)} style={{ background:'none', border:'none', color:'#4b5563', fontSize:18, cursor:'pointer', padding:'4px 8px' }}>✕</button>
            </div>
            <div style={{ fontSize:11, color:'#6b7280', fontWeight:600, letterSpacing:0.5, marginBottom:8 }}>OVERALL PLACE</div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:6 }}>
              {Array.from({length:20},(_,i)=>i+1).map(p => (
                <button key={p} onClick={()=>confirmPlace(placeOverlay.runnerId, p)} style={{
                  background:'#1f2937', border:'1.5px solid #374151', borderRadius:10,
                  color:'#fff', fontSize:16, fontWeight:800, padding:'12px 0',
                  cursor:'pointer', textAlign:'center'
                }}>{p}</button>
              ))}
            </div>
            <button onClick={()=>setPlaceOverlay(null)} style={{ ...styles.secondaryBtn, marginTop:10, padding:'10px 0', fontSize:13 }}>
              Skip — enter later
            </button>
          </div>
        </div>
      )}

      {/* Edit split modal */}
      {editingSplit && (
        <div style={{ position:'fixed', inset:0, background:'#000a', display:'flex', alignItems:'center', justifyContent:'center', zIndex:100 }}>
          <div style={{ background:'#111827', borderRadius:16, padding:24, width:300, border:'1.5px solid #1f2937' }}>
            <div style={{ color:'#fff', fontSize:16, fontWeight:700, marginBottom:4 }}>Edit Split</div>
            <div style={{ color:'#6b7280', fontSize:12, marginBottom:16 }}>Format: mm:ss.cs</div>
            <input style={{ ...styles.input, marginBottom:12, fontVariantNumeric:'tabular-nums' }} value={editValue} onChange={e=>setEditValue(e.target.value)} autoFocus onKeyDown={e=>e.key==='Enter'&&saveEditSplit()} />
            <div style={{ display:'flex', gap:8 }}>
              <button onClick={saveEditSplit} style={{ ...styles.primaryBtn, flex:1, padding:'10px 0' }}>Save</button>
              <button onClick={()=>setEditingSplit(null)} style={{ ...styles.secondaryBtn, flex:1, padding:'10px 0' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  )
}

// ── Results Screen ─────────────────────────────────────────────
function ResultsScreen({ runnerState, config, onNewRace }) {
  const { user } = useAuth()
  const { splitDistances, distance, eventLabel, isRace, meetSlug, meetName, raceDate, raceLocation, category, gender, sport } = config
  const [athletes, setAthletes] = useState(runnerState)
  const [editingPlace, setEditingPlace] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState(null)
  // PR event selection — one event applies to all runners
  const [prEvents, setPrEvents] = useState([])
  const [selectedPrEventId, setSelectedPrEventId] = useState('auto') // 'auto' | 'new' | uuid
  const [loadingPrEvents, setLoadingPrEvents] = useState(false)
  const medals = ['🥇','🥈','🥉']

  const sportLabel = sport || 'Running'
  const distanceLabel = eventLabel || 'Race'
  const eventDate = raceDate || new Date().toISOString().slice(0,10)

  // Load existing pr_events for this user matching sport+distance
  useEffect(() => {
    if (!user || !isRace) return
    async function loadPrEvents() {
      setLoadingPrEvents(true)
      const { data } = await supabase
        .from('pr_events')
        .select('id, event_name, sport')
        .eq('user_id', user.id)
        .eq('result_type', 'time')
        .order('event_name')
      setPrEvents(data || [])
      // Auto-select matching event if exists
      const match = data?.find(e =>
        e.sport?.toLowerCase() === sportLabel.toLowerCase() &&
        e.event_name?.toLowerCase() === distanceLabel.toLowerCase()
      )
      if (match) setSelectedPrEventId(match.id)
      setLoadingPrEvents(false)
    }
    loadPrEvents()
  }, [user])

  async function saveToPRTracker() {
    if (!user || saving || saved) return
    setSaving(true)
    setSaveError(null)
    try {
      const finished = athletes.filter(r => r.finishMs != null && !r.dnf)

      // Resolve the event ID to use
      let resolvedEventId = selectedPrEventId === 'auto' || selectedPrEventId === 'new' ? null : selectedPrEventId

      // If auto/new, create a new pr_event under the coach's account
      if (!resolvedEventId) {
        const { data: newEvent } = await supabase
          .from('pr_events')
          .insert({ user_id: user.id, sport: sportLabel, event_name: distanceLabel, result_type: 'time' })
          .select('id').single()
        resolvedEventId = newEvent?.id
      }
      if (!resolvedEventId) throw new Error('Could not resolve PR event')

      for (const runner of finished) {
        if (runner.isManual) continue

        const splitNotes = runner.splits.map((ms, i) => {
          const prev = i === 0 ? 0 : runner.splits[i-1]
          const lapMs = ms - prev
          const dist = splitDistances[i] || 0
          return `S${i+1}(${dist}m): ${formatMs(lapMs)}`
        }).join(' | ')

        const notes = [
          config.raceName || meetName || '',
          raceLocation || config.raceLocation || '',
          category ? `Cat: ${category}` : '',
          gender && gender !== 'mixed' ? gender : '',
          runner.place ? `P${runner.place}` : '',
          splitNotes
        ].filter(Boolean).join(' — ')

        await supabase.from('pr_entries').upsert({
          event_id: resolvedEventId,
          user_id: runner.id,
          event_date: eventDate,
          time_ms: runner.finishMs,
          notes: notes || null
        }, { onConflict: 'event_id,user_id,event_date', ignoreDuplicates: false })
      }
      setSaved(true)
    } catch(e) {
      console.error('Save error:', e)
      setSaveError('Failed to save some results. Check console.')
    } finally {
      setSaving(false)
    }
  }
  const finished = [...athletes].filter(r=>r.finishMs!=null).sort((a,b) => {
    if (a.place && b.place) return a.place - b.place
    return a.finishMs - b.finishMs
  })
  const dnf      = athletes.filter(r=>r.dnf)
  const winner   = finished[0]
  const scoreboardUrl = meetSlug ? `${window.location.origin}/scoreboard/${meetSlug}` : null
  const [copied, setCopied] = useState(false)

  function cumDist(si) { return splitDistances.slice(0,si+1).reduce((a,b)=>a+b,0) }

  function setPlace(runnerId, place) {
    setAthletes(prev => prev.map(r => r.id===runnerId ? {...r, place} : r))
    setEditingPlace(null)
  }

  return (
    <div style={styles.page}>
      <div style={{ padding:'24px 20px 0' }}>
        <div style={{ textAlign:'center', marginBottom:20 }}>
          <div style={{ fontSize:42, marginBottom:6 }}>🏁</div>
          <h1 style={styles.title}>{isRace?'Race Results':'Session Results'}</h1>
          <div style={{ color:'#6b7280', fontSize:14 }}>{eventLabel}</div>
          {meetName && <div style={{ color:'#f97316', fontSize:12, fontWeight:600, marginTop:2 }}>{meetName}</div>}
        </div>

        {/* Scoreboard link */}
        {scoreboardUrl && isRace && (
          <div style={{ background:'#0d1117', borderRadius:12, border:'1px solid #1f2937', padding:'12px 16px', marginBottom:20 }}>
            <div style={{ fontSize:10, color:'#4b5563', fontWeight:600, letterSpacing:0.5, marginBottom:8 }}>LIVE SCOREBOARD</div>
            <div style={{ display:'flex', gap:8 }}>
              <div style={{ flex:1, background:'#111827', borderRadius:8, padding:'8px 10px', fontSize:11, color:'#6b7280', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                {scoreboardUrl}
              </div>
              <button onClick={()=>{ navigator.clipboard.writeText(scoreboardUrl); setCopied(true); setTimeout(()=>setCopied(false),2000) }} style={{ background:copied?'#4ade8022':'#1f2937', border:`1px solid ${copied?'#4ade80':'#374151'}`, borderRadius:8, color:copied?'#4ade80':'#9ca3af', fontSize:11, fontWeight:700, padding:'8px 12px', cursor:'pointer' }}>
                {copied?'✓ Copied':'Copy'}
              </button>
              <a href={scoreboardUrl} target="_blank" rel="noopener noreferrer" style={{ background:'#1f2937', border:'1px solid #374151', borderRadius:8, color:'#9ca3af', fontSize:11, fontWeight:700, padding:'8px 12px', textDecoration:'none' }}>↗</a>
            </div>
          </div>
        )}

        <div style={{ display:'flex', flexDirection:'column', gap:10, marginBottom:20 }}>
          {finished.map((runner,i) => {
            const gap = i>0 ? runner.finishMs-winner.finishMs : null
            return (
              <div key={runner.id} style={{ background:i===0?'#0f2a1a':'#0d1117', border:`1.5px solid ${i===0?'#4ade80':'#1f2937'}`, borderRadius:14, padding:'14px 16px' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom: runner.splits.length>0?10:0 }}>
                  <div style={{ display:'flex', gap:10, alignItems:'center' }}>
                    {/* Place — tappable to edit */}
                    <button
                      onClick={()=>setEditingPlace(runner.id)}
                      style={{ background:'none', border:'none', cursor:'pointer', padding:0, fontSize:24, minWidth:32 }}
                    >
                      {runner.place ? (medals[runner.place-1] ?? `#${runner.place}`) : <span style={{ color:'#374151', fontSize:14 }}>~{i+1}</span>}
                    </button>
                    <div>
                      <div style={{ color:'#fff', fontSize:16, fontWeight:700 }}>{runner.name}</div>
                      {gap!=null && <div style={{ color:'#4b5563', fontSize:12 }}>+{formatMs(gap)}</div>}
                      {!runner.place && isRace && <div style={{ fontSize:10, color:'#4b5563' }}>tap to set place</div>}
                    </div>
                  </div>
                  <div style={{ textAlign:'right' }}>
                    <div style={{ color:i===0?'#4ade80':runner.color, fontSize:20, fontWeight:800, fontVariantNumeric:'tabular-nums' }}>{formatMs(runner.finishMs)}</div>
                    <div style={{ color:'#4b5563', fontSize:11 }}>{formatPace(runner.finishMs,distance)}</div>
                  </div>
                </div>
                {runner.splits.length>0 && (
                  <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                    {runner.splits.map((splitMs,si)=>{
                      const prev  = si===0?0:runner.splits[si-1]
                      const lapMs = splitMs-prev
                      const dist  = splitDistances[si]
                      const cd    = cumDist(si)
                      const isFin = si===runner.splits.length-1
                      return (
                        <div key={si} style={{ padding:'4px 10px', borderRadius:8, background:isFin?'#14532d':'#111827', border:`1px solid ${isFin?'#4ade8044':'#1f2937'}` }}>
                          <div style={{ fontSize:9, color:isFin?'#4ade80':'#9ca3af', fontWeight:700 }}>{isFin?'🏁':`S${si+1}`} {dist}m·{cd}m</div>
                          <div style={{ fontSize:12, color:'#fff', fontWeight:700, fontVariantNumeric:'tabular-nums' }}>{formatMs(lapMs)}</div>
                          <div style={{ fontSize:10, color:'#6b7280', fontVariantNumeric:'tabular-nums' }}>{formatMs(splitMs)}</div>
                          <div style={{ fontSize:9, color:'#374151' }}>{formatPace(lapMs,dist)}</div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}

          {dnf.map(runner=>(
            <div key={runner.id} style={{ background:'#0d1117', border:'1.5px solid #1f2937', borderRadius:14, padding:'12px 16px', opacity:0.5, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div style={{ color:'#6b7280', fontSize:15, fontWeight:600 }}>{runner.name}</div>
              <div style={{ color:'#ef4444', fontSize:13, fontWeight:700 }}>DNF</div>
            </div>
          ))}
        </div>

        {/* Save to PR Tracker */}
        {isRace && !saved && (
          <div style={{ background:'#0d1117', borderRadius:14, border:'1.5px solid #1f2937', padding:'16px', marginBottom:10 }}>
            <div style={{ fontSize:11, color:'#6b7280', fontWeight:600, letterSpacing:0.5, marginBottom:10 }}>SAVE TO PR TRACKER</div>

            {/* Event selector */}
            <div style={{ marginBottom:12 }}>
              <div style={{ fontSize:12, color:'#9ca3af', marginBottom:6 }}>PR Event</div>
              {loadingPrEvents ? (
                <div style={{ color:'#4b5563', fontSize:12 }}>Loading events...</div>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                  {/* Auto/new option */}
                  <button
                    onClick={() => setSelectedPrEventId('new')}
                    style={{
                      padding:'10px 14px', borderRadius:10, textAlign:'left', cursor:'pointer',
                      border:`1.5px solid ${selectedPrEventId==='new'?'#f97316':'#1f2937'}`,
                      background: selectedPrEventId==='new'?'#f9731622':'#111827',
                      color: selectedPrEventId==='new'?'#f97316':'#6b7280',
                      fontSize:13, fontWeight:600
                    }}
                  >
                    + Create new event: {sportLabel} · {distanceLabel}
                  </button>
                  {/* Existing events */}
                  {prEvents.map(ev => (
                    <button
                      key={ev.id}
                      onClick={() => setSelectedPrEventId(ev.id)}
                      style={{
                        padding:'10px 14px', borderRadius:10, textAlign:'left', cursor:'pointer',
                        border:`1.5px solid ${selectedPrEventId===ev.id?'#f97316':'#1f2937'}`,
                        background: selectedPrEventId===ev.id?'#f9731622':'#111827',
                        color: selectedPrEventId===ev.id?'#f97316':'#9ca3af',
                        fontSize:13, fontWeight:600,
                        display:'flex', justifyContent:'space-between', alignItems:'center'
                      }}
                    >
                      <span>{ev.event_name}</span>
                      <span style={{ fontSize:11, color:'#4b5563' }}>{ev.sport}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              onClick={saveToPRTracker}
              disabled={saving || !selectedPrEventId}
              style={{ ...styles.primaryBtn, background: saving ? '#1f2937' : '#f97316', color: saving ? '#6b7280' : '#fff', cursor: saving || !selectedPrEventId ? 'not-allowed' : 'pointer' }}
            >
              {saving ? 'Saving...' : '💾 Save Results'}
            </button>
          </div>
        )}
        {saved && (
          <div style={{ background:'#14532d', border:'1.5px solid #166534', borderRadius:12, padding:'12px 16px', marginBottom:10, textAlign:'center', color:'#4ade80', fontSize:14, fontWeight:700 }}>
            ✓ Results saved to PR Tracker
          </div>
        )}
        {saveError && (
          <div style={{ background:'#7f1d1d', border:'1px solid #991b1b', borderRadius:10, padding:'10px 14px', marginBottom:10, color:'#fca5a5', fontSize:13 }}>
            ⚠️ {saveError}
          </div>
        )}
        <button onClick={onNewRace} style={styles.secondaryBtn}>New Race</button>
      </div>

      {/* Place editor overlay */}
      {editingPlace && (
        <div style={{ position:'fixed', inset:0, background:'#000a', display:'flex', alignItems:'flex-end', zIndex:200 }}>
          <div style={{ background:'#111827', borderRadius:'16px 16px 0 0', width:'100%', padding:'20px 16px 32px', border:'1.5px solid #374151' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
              <div style={{ color:'#fff', fontSize:16, fontWeight:800 }}>
                {finished.find(r=>r.id===editingPlace)?.name} — Overall Place
              </div>
              <button onClick={()=>setEditingPlace(null)} style={{ background:'none', border:'none', color:'#4b5563', fontSize:20, cursor:'pointer' }}>✕</button>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:8, marginBottom:10 }}>
              {Array.from({length:20},(_,i)=>i+1).map(p=>(
                <button key={p} onClick={()=>setPlace(editingPlace,p)} style={{
                  background: finished.find(r=>r.id===editingPlace)?.place===p ? '#f97316' : '#1f2937',
                  border:'1.5px solid #374151', borderRadius:10,
                  color:'#fff', fontSize:18, fontWeight:800, padding:'14px 0', cursor:'pointer'
                }}>{p}</button>
              ))}
            </div>
            <button onClick={()=>{ setPlace(editingPlace,null); }} style={{ ...styles.secondaryBtn, padding:'10px 0', fontSize:13 }}>Clear Place</button>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  )
}

// ── Shared styles ──────────────────────────────────────────────
const styles = {
  page:         { minHeight:'100dvh', background:'#030712', paddingBottom:80, boxSizing:'border-box' },
  title:        { color:'#fff', fontSize:22, fontWeight:800, margin:'0 0 20px' },
  label:        { fontSize:11, color:'#6b7280', marginBottom:8, display:'block', letterSpacing:0.8, fontWeight:600 },
  settingLabel: { color:'#9ca3af', fontSize:10, fontWeight:700, letterSpacing:0.5, marginBottom:6, textTransform:'uppercase' },
  section:      { marginBottom:22 },
  chip:         { padding:'8px 18px', borderRadius:999, border:'none', fontSize:14, fontWeight:700, cursor:'pointer', transition:'all 0.15s' },
  miniChip:     { padding:'6px 12px', borderRadius:999, border:'none', fontSize:12, fontWeight:700, cursor:'pointer' },
  input:        { background:'#111827', border:'1.5px solid #1f2937', borderRadius:10, color:'#fff', fontSize:15, padding:'10px 12px', outline:'none', width:'100%', boxSizing:'border-box' },
  addBtn:       { background:'#1f2937', border:'none', borderRadius:10, color:'#fff', fontSize:18, fontWeight:700, padding:'10px 18px', cursor:'pointer', flexShrink:0 },
  settingCard:  { background:'#111827', borderRadius:10, padding:'10px 14px', border:'1px solid #1f2937' },
  primaryBtn:   { width:'100%', background:'#f97316', border:'none', borderRadius:12, color:'#fff', fontSize:16, fontWeight:800, padding:'15px 0', cursor:'pointer', display:'block' },
  secondaryBtn: { width:'100%', background:'#1f2937', border:'none', borderRadius:12, color:'#9ca3af', fontSize:15, fontWeight:700, padding:'14px 0', cursor:'pointer', display:'block' },
  startBtn:     { width:'100%', border:'none', borderRadius:14, fontSize:18, fontWeight:800, padding:'16px 0', transition:'background 0.2s', display:'block' },
  th:           { color:'#6b7280', fontSize:11, fontWeight:600, padding:'6px 10px', textAlign:'center', borderBottom:'1px solid #1f2937', whiteSpace:'nowrap' },
  td:           { color:'#fff', fontSize:12, padding:'6px 8px', textAlign:'center', borderBottom:'1px solid #111827', fontVariantNumeric:'tabular-nums', verticalAlign:'top' },
}


// ── Save Training Button ───────────────────────────────────────
function SaveTrainingButton({ groups, groupStates, config }) {
  const { user } = useAuth()
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState(null)

  async function saveTrainingSession() {
    if (!user || saving || saved) return
    setSaving(true)
    setSaveError(null)
    try {
      const sessionDate = config.trainDate || new Date().toISOString().slice(0,10)
      for (const group of groups) {
        const gs = groupStates[group.id]
        if (!gs?.stopped && !gs?.started) continue
        const eventLabel = group.event?.label || 'Training'
        const distanceM = group.event?.label === 'Other'
          ? Math.round((parseFloat(group.customDist)||0)*(UNITS.find(u=>u.label===group.customUnit)?.toMetres||1))
          : group.event?.distance

        for (const runner of gs.runners) {
          if (runner.isManual || !runner.splits.length) continue
          const finalMs = runner.splits[runner.splits.length - 1]
          // Find or create pr_event
          const { data: existing } = await supabase
            .from('pr_events')
            .select('id')
            .eq('user_id', runner.id)
            .eq('sport', 'Running')
            .eq('event_name', eventLabel)
            .eq('result_type', 'time')
            .limit(1)

          let eventId = existing?.[0]?.id
          if (!eventId) {
            const { data: newEv } = await supabase
              .from('pr_events')
              .insert({ user_id: runner.id, sport: 'Running', event_name: eventLabel, result_type: 'time' })
              .select('id').single()
            eventId = newEv?.id
          }
          if (!eventId) continue

          const splitNotes = runner.splits.map((ms, i) => {
            const prev = i === 0 ? 0 : runner.splits[i-1]
            return `L${i+1}: ${formatMs(ms - prev)}`
          }).join(' | ')

          const notes = [
            group.name,
            config.trainLocation || '',
            splitNotes
          ].filter(Boolean).join(' — ')

          await supabase.from('pr_entries').upsert({
            event_id: eventId,
            user_id: runner.id,
            event_date: sessionDate,
            time_ms: finalMs,
            notes: notes || null
          }, { onConflict: 'event_id,user_id,event_date', ignoreDuplicates: false })
        }
      }
      setSaved(true)
    } catch(e) {
      console.error('Save training error:', e)
      setSaveError('Failed to save session.')
    } finally {
      setSaving(false)
    }
  }

  const hasData = groups.some(g => groupStates[g.id]?.runners?.some(r => r.splits.length > 0 && !r.isManual))
  if (!hasData) return null

  return (
    <>
      {!saved && (
        <button
          onClick={saveTrainingSession}
          disabled={saving}
          style={{ ...styles.primaryBtn, background: saving ? '#1f2937' : '#3b82f6', color: saving ? '#6b7280' : '#fff', cursor: saving ? 'not-allowed' : 'pointer' }}
        >
          {saving ? 'Saving...' : '💾 Save Session to PR Tracker'}
        </button>
      )}
      {saved && (
        <div style={{ background:'#1e3a5f', border:'1.5px solid #1d4ed8', borderRadius:12, padding:'12px 16px', textAlign:'center', color:'#93c5fd', fontSize:14, fontWeight:700 }}>
          ✓ Session saved to PR Tracker
        </div>
      )}
      {saveError && (
        <div style={{ background:'#7f1d1d', borderRadius:10, padding:'10px 14px', color:'#fca5a5', fontSize:13 }}>⚠️ {saveError}</div>
      )}
    </>
  )
}

// ── Training Screen ────────────────────────────────────────────
function TrainingScreen({ config, onDone }) {
  const { groups, trainLocation, trainDate } = config
  const [activeGroupId, setActiveGroupId] = useState(groups[0]?.id)
  // Per-group state: started, elapsed, runners, splits, displayOrder
  const [groupStates, setGroupStates] = useState(() =>
    Object.fromEntries(groups.map(g => [g.id, {
      started: false, startTime: null, elapsed: 0, stopped: false,
      runners: g.runners.map(r => ({ ...r, splits:[], finished:false })),
      displayOrder: g.runners.map(r => r.id)
    }]))
  )
  const rafRefs  = useRef({})
  const startRefs = useRef({})

  // Wake lock
  useEffect(() => {
    let lock = null
    async function acquire() { try { if('wakeLock' in navigator) lock = await navigator.wakeLock.request('screen') } catch{} }
    acquire()
    return () => { lock?.release?.(); Object.values(rafRefs.current).forEach(r => cancelAnimationFrame(r)) }
  }, [])

  function startGroup(groupId) {
    startRefs.current[groupId] = Date.now()
    function tick() {
      setGroupStates(prev => {
        const g = prev[groupId]
        if (!g || g.stopped) return prev
        return { ...prev, [groupId]: { ...g, elapsed: Date.now()-startRefs.current[groupId] } }
      })
      rafRefs.current[groupId] = requestAnimationFrame(tick)
    }
    rafRefs.current[groupId] = requestAnimationFrame(tick)
    setGroupStates(prev => ({ ...prev, [groupId]: { ...prev[groupId], started:true, startTime: Date.now() } }))
  }

  function tapRunner(groupId, runnerId) {
    const now = Date.now() - startRefs.current[groupId]
    setGroupStates(prev => {
      const g = prev[groupId]
      if (!g?.started || g.stopped) return prev
      const grpDef = groups.find(gr=>gr.id===groupId)
      const lapDist = grpDef?.lapDist || 400
      const totalDist = grpDef?.event?.label==='Other'
        ? Math.round((parseFloat(grpDef.customDist)||0)*(UNITS.find(u=>u.label===grpDef.customUnit)?.toMetres||1))
        : grpDef?.event?.distance
      const newRunners = g.runners.map(r => {
        if (r.id !== runnerId || r.finished) return r
        return { ...r, splits: [...r.splits, now] }
      })
      // Reorder: most splits first, then fastest last split
      const active = newRunners.filter(r=>!r.finished)
      const sortedIds = [...active].sort((a,b) => {
        if (b.splits.length !== a.splits.length) return b.splits.length - a.splits.length
        const aT = a.splits[a.splits.length-1] ?? Infinity
        const bT = b.splits[b.splits.length-1] ?? Infinity
        return aT - bT
      }).map(r=>r.id)
      return { ...prev, [groupId]: { ...g, runners: newRunners, displayOrder: sortedIds } }
    })
  }

  function stopGroup(groupId) {
    cancelAnimationFrame(rafRefs.current[groupId])
    setGroupStates(prev => ({ ...prev, [groupId]: { ...prev[groupId], stopped:true } }))
  }

  const activeGroup  = groups.find(g=>g.id===activeGroupId)
  const activeState  = groupStates[activeGroupId]
  const orderedRunners = activeState
    ? activeState.displayOrder.map(id=>activeState.runners.find(r=>r.id===id)).filter(Boolean)
    : []

  return (
    <div style={styles.page}>
      {/* Header */}
      <div style={{ background:'#0d1117', borderBottom:'1px solid #1f2937', padding:'12px 16px' }}>
        <div style={{ fontSize:11, color:'#6b7280', letterSpacing:1, marginBottom:2 }}>TRAINING SESSION</div>
        <div style={{ display:'flex', gap:6, overflowX:'auto', paddingBottom:2 }}>
          {groups.map(g => {
            const gs = groupStates[g.id]
            const isActive = activeGroupId===g.id
            return (
              <button key={g.id} onClick={()=>setActiveGroupId(g.id)} style={{
                padding:'8px 14px', borderRadius:10, border:'none', cursor:'pointer', whiteSpace:'nowrap', flexShrink:0,
                background: isActive ? '#1f2937' : '#111827',
                borderTop: isActive ? `2px solid #3b82f6` : '2px solid transparent',
              }}>
                <div style={{ color: isActive?'#fff':'#6b7280', fontSize:13, fontWeight:700 }}>{g.name}</div>
                <div style={{ color:'#3b82f6', fontSize:11, fontVariantNumeric:'tabular-nums', fontFamily:'ui-monospace,monospace' }}>
                  {gs?.started ? formatMs(gs.elapsed) : '—'}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      <div style={{ padding:'12px 16px' }}>
        {/* Active group view */}
        {activeGroup && activeState && (
          <>
            {/* Group clock + start/stop */}
            <div style={{ textAlign:'center', marginBottom:16 }}>
              <div style={{ fontSize:48, fontWeight:800, color: activeState.stopped?'#4ade80':activeState.started?'#fff':'#374151', fontVariantNumeric:'tabular-nums', fontFamily:'ui-monospace,monospace', letterSpacing:-2, lineHeight:1 }}>
                {formatMs(activeState.elapsed)}
              </div>
              {activeGroup.event && (
                <div style={{ color:'#6b7280', fontSize:12, marginTop:4 }}>
                  {activeGroup.event.label} · {activeGroup.lapDist}m loops
                </div>
              )}
              {!activeState.started && (
                <button onClick={()=>startGroup(activeGroupId)} style={{ marginTop:14, background:'#3b82f6', border:'none', borderRadius:12, color:'#fff', fontSize:16, fontWeight:800, padding:'14px 40px', cursor:'pointer' }}>
                  Start {activeGroup.name} ▶
                </button>
              )}
              {activeState.started && !activeState.stopped && (
                <button onClick={()=>stopGroup(activeGroupId)} style={{ marginTop:14, background:'#1f2937', border:'none', borderRadius:10, color:'#9ca3af', fontSize:13, fontWeight:700, padding:'10px 24px', cursor:'pointer' }}>
                  End Group
                </button>
              )}
            </div>

            {/* Runner buttons */}
            {activeState.started && (
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {orderedRunners.map(runner => {
                  const lapNum   = runner.splits.length + 1
                  const lastMs   = runner.splits.length>0 ? runner.splits[runner.splits.length-1] : 0
                  const lapMs    = activeState.elapsed - lastMs
                  const lastLapMs = runner.splits.length>0 ? runner.splits[runner.splits.length-1]-(runner.splits[runner.splits.length-2]||0) : null
                  return (
                    <div key={runner.id} style={{ background:'#0d1117', borderRadius:14, padding:'10px 12px', border:`1.5px solid ${runner.color}44`, display:'flex', alignItems:'center', gap:10 }}>
                      <div style={{ width:10, height:10, borderRadius:'50%', background:runner.color, flexShrink:0 }} />
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ color:'#fff', fontSize:15, fontWeight:700 }}>{runner.name}</div>
                        <div style={{ color:runner.color, fontSize:12, fontVariantNumeric:'tabular-nums' }}>
                          Lap {runner.splits.length+1} · {formatMs(lapMs)}
                          {lastLapMs && <span style={{ color:'#4b5563', marginLeft:8 }}>last {formatMs(lastLapMs)}</span>}
                        </div>
                      </div>
                      {!activeState.stopped && (
                        <button
                          onPointerDown={e=>e.currentTarget._t=setTimeout(()=>{},600)}
                          onPointerUp={()=>tapRunner(activeGroupId,runner.id)}
                          style={{ background:runner.color, border:'none', borderRadius:12, color:'#000', fontSize:14, fontWeight:800, padding:'12px 18px', cursor:'pointer', minWidth:70, WebkitUserSelect:'none', userSelect:'none' }}
                        >
                          LAP
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {/* Splits table */}
            {activeState.runners.some(r=>r.splits.length>0) && (
              <div style={{ marginTop:12, background:'#0d1117', borderRadius:12, border:'1px solid #1f2937', overflow:'hidden' }}>
                <div style={{ fontSize:10, color:'#6b7280', padding:'8px 14px', fontWeight:600, letterSpacing:0.5 }}>SPLITS</div>
                <div style={{ overflowX:'auto' }}>
                  <table style={{ width:'100%', borderCollapse:'collapse', minWidth:orderedRunners.length*90+60 }}>
                    <thead>
                      <tr>
                        <th style={{ ...styles.th, textAlign:'left', paddingLeft:14 }}>LAP</th>
                        {orderedRunners.map(r=><th key={r.id} style={{ ...styles.th, color:r.color }}>{r.name.split(' ')[0]}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {Array.from({length:Math.max(...activeState.runners.map(r=>r.splits.length),0)}).map((_,li)=>(
                        <tr key={li}>
                          <td style={{ ...styles.td, textAlign:'left', paddingLeft:14, color:'#4b5563', fontSize:11 }}>L{li+1} · {activeGroup.lapDist}m</td>
                          {orderedRunners.map(runner=>{
                            const splitMs = runner.splits[li]
                            const prev    = li===0?0:runner.splits[li-1]
                            const lapMs   = splitMs!=null ? splitMs-prev : null
                            return (
                              <td key={runner.id} style={styles.td}>
                                {lapMs!=null ? (
                                  <div>
                                    <div style={{ fontWeight:700 }}>{formatMs(lapMs)}</div>
                                    <div style={{ fontSize:10, color:'#4b5563' }}>{formatMs(splitMs)}</div>
                                    <div style={{ fontSize:9, color:'#374151' }}>{formatPace(lapMs,activeGroup.lapDist)}</div>
                                  </div>
                                ) : <span style={{ color:'#374151' }}>—</span>}
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Done button */}
      <div style={{ padding:'0 16px 16px', display:'flex', flexDirection:'column', gap:8 }}>
        <SaveTrainingButton groups={groups} groupStates={groupStates} config={config} />
        <button onClick={onDone} style={styles.secondaryBtn}>← New Session</button>
      </div>

      <BottomNav />
    </div>
  )
}

// ── Main ───────────────────────────────────────────────────────
export default function Stopwatch() {
  const { user } = useAuth()
  const [phase,          setPhase]          = useState('setup')
  const [raceConfig,     setRaceConfig]     = useState(null)
  const [finishedState,  setFinishedState]  = useState(null)
  const [setupInitial,   setSetupInitial]   = useState(null)
  // DB state lifted to Main so PreRaceScreen can init and RaceScreen can use
  const [dbRaceId,       setDbRaceId]       = useState(null)
  const [dbAthleteMap,   setDbAthleteMap]   = useState({})
  const [resolvedSlug,   setResolvedSlug]   = useState(null)
  const finishSavedRef = useRef(false)
  const initSavedRef   = useRef(false)

  async function initRaceInDB(config) {
    if (!config.isRace || !user) return
    if (initSavedRef.current) return
    initSavedRef.current = true
    try {
      // Get or create meet
      let mId = config.meetId
      let slug = config.meetSlug
      if (!mId) {
        const name = config.meetName || `Meet — ${new Date().toLocaleDateString('en-US',{month:'short',day:'numeric'})}`
        slug = name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'') + '-' + Math.random().toString(36).slice(2,6)
        const { data: meet } = await supabase.from('meets').insert({ user_id: user.id, name, slug }).select().single()
        if (meet) { mId = meet.id; slug = meet.slug }
      }
      setResolvedSlug(slug)
      // Build race name
      const { category, gender, eventLabel } = config
      const raceName = [category, gender && gender!=='mixed' ? (gender==='male'?"Men's":"Women's") : '', eventLabel].filter(Boolean).join(' ')
      const { data: race } = await supabase.from('races').insert({
        user_id: user.id, meet_id: mId,
        name: raceName, event_type: 'track',
        distance_meters: config.distance, split_distances: config.splitDistances,
        status: 'pending', is_public: true,
        gender: config.gender, category: config.category
      }).select().single()
      if (!race) return
      setDbRaceId(race.id)
      // Insert athletes
      const athleteRows = config.runners.map(r => ({
        race_id: race.id,
        player_id: r.isManual ? null : r.id,
        name: r.name,
        splits: []
      }))
      const { data: dbAthletes, error: athleteError } = await supabase
        .from('race_athletes')
        .insert(athleteRows)
        .select()
      if (athleteError) { console.error('race_athletes insert error:', athleteError); return }
      if (dbAthletes) {
        const map = {}
        dbAthletes.forEach((a,i) => { map[config.runners[i].id] = a.id })
        setDbAthleteMap(map)
      }
      // Update raceConfig with resolved slug
      setRaceConfig(prev => ({ ...prev, meetSlug: slug, meetId: mId }))
    } catch(e) { console.error('DB init error:', e) }
  }

  function handleSetupDone(config) {
    if (config.isRace === false) {
      // Training mode — go straight to training screen
      setRaceConfig(config)
      setPhase('training')
      return
    }
    setRaceConfig(config); setDbRaceId(null); setDbAthleteMap({}); setResolvedSlug(null); setPhase('preRace')
  }
  function handleRaceStart()                { setPhase('race') }
  function handleBackToSetup()              { setSetupInitial(raceConfig); setRaceConfig(null); initSavedRef.current = false; finishSavedRef.current = false; setPhase('setup') }
  async function handleFinish(runnerState, config) {
    setFinishedState({ runnerState, config })
    setPhase('results')
    // Save final results to race_athletes immediately on finish
    if (dbRaceId && Object.keys(dbAthleteMap).length > 0) {
      try {
        for (const runner of runnerState) {
          const dbId = dbAthleteMap[runner.id]
          if (!dbId) continue
          await supabase.from('race_athletes').update({
            final_time_ms: runner.finishMs ?? null,
            place: runner.place ?? null,
            status: runner.dnf ? 'dnf' : runner.finishMs ? 'finished' : 'active',
            splits: runner.splits.map((t, i) => ({
              lap: i + 1,
              time_ms: t,
              split_ms: i === 0 ? t : t - runner.splits[i - 1]
            }))
          }).eq('id', dbId)
        }
        console.log('Race results saved to DB')
      } catch(e) { console.error('Save finish error:', e) }
    }
  }
  function handleFalseStart(config)         { setRaceConfig(config); setDbRaceId(null); setDbAthleteMap({}); setResolvedSlug(null); initSavedRef.current = false; setPhase('preRace') }
  function handleBackToSetupFromRace(config){ setSetupInitial(config); setRaceConfig(null); setPhase('setup') }
  function handleNewRace()                  { setRaceConfig(null); setFinishedState(null); setSetupInitial(null); setDbRaceId(null); setDbAthleteMap({}); setResolvedSlug(null); finishSavedRef.current = false; initSavedRef.current = false; setPhase('setup') }

  if (phase==='training')  return <TrainingScreen config={raceConfig} onDone={handleNewRace} />
  if (phase==='preRace')  return <PreRaceScreen config={raceConfig} onStart={handleRaceStart} onBack={handleBackToSetup} onInitRace={()=>initRaceInDB(raceConfig)} />
  if (phase==='race')     return <RaceScreen config={{...raceConfig, meetSlug: resolvedSlug||raceConfig?.meetSlug}} dbRaceId={dbRaceId} dbAthleteMap={dbAthleteMap} onFinish={handleFinish} onFalseStart={handleFalseStart} onBackToSetup={handleBackToSetupFromRace} />
  if (phase==='results')  return <ResultsScreen {...finishedState} onNewRace={handleNewRace} />
  return <SetupScreen onStart={handleSetupDone} initialConfig={setupInitial} />
}
