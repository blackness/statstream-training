import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import BottomNav from '../components/BottomNav'

const SPORTS = ['Running', 'Cycling', 'Swimming', 'Weightlifting', 'Basketball', 'Volleyball', 'Soccer', 'Baseball', 'Conditioning', 'Other']
const RESULT_TYPES = [
  { key: 'time',        label: '⏱ Time',          sub: 'mm:ss or hh:mm:ss' },
  { key: 'weight_reps', label: '🏋️ Weight × Reps', sub: 'e.g. 225 × 5' },
  { key: 'score',       label: '🔢 Score / Count',  sub: 'e.g. points, reps' },
  { key: 'custom',      label: '✏️ Custom',         sub: 'you define the unit' },
]

// ── Time input helper ─────────────────────────────────────────
function TimeInput({ value, onChange }) {
  // value is ms (bigint/number), onChange(ms)
  const toDisplay = (ms) => {
    if (!ms && ms !== 0) return { h: '', m: '', s: '', cs: '' }
    const h = Math.floor(ms / 3600000)
    const m = Math.floor((ms % 3600000) / 60000)
    const s = Math.floor((ms % 60000) / 1000)
    const cs = Math.floor((ms % 1000) / 10)
    return { h: h > 0 ? String(h) : '', m: String(m).padStart(h > 0 ? 2 : 1, '0'), s: String(s).padStart(2, '0'), cs: String(cs).padStart(2, '0') }
  }

  const [parts, setParts] = useState(toDisplay(value))

  function update(field, val) {
    const next = { ...parts, [field]: val }
    setParts(next)
    const h = parseInt(next.h || 0)
    const m = parseInt(next.m || 0)
    const s = parseInt(next.s || 0)
    const cs = parseInt(next.cs || 0)
    if (!isNaN(h) && !isNaN(m) && !isNaN(s)) {
      onChange(h * 3600000 + m * 60000 + s * 1000 + cs * 10)
    }
  }

  const fieldStyle = {
    background: '#111827', border: '1.5px solid #1f2937', borderRadius: 8,
    color: '#fff', fontSize: 22, fontWeight: 700, textAlign: 'center',
    width: 52, padding: '8px 4px', outline: 'none'
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
        <input style={fieldStyle} type="number" min="0" placeholder="0" value={parts.h} onChange={e => update('h', e.target.value)} />
        <span style={{ fontSize: 10, color: '#4b5563' }}>hr</span>
      </div>
      <span style={{ color: '#4b5563', fontSize: 22, fontWeight: 700, marginBottom: 16 }}>:</span>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
        <input style={fieldStyle} type="number" min="0" max="59" placeholder="00" value={parts.m} onChange={e => update('m', e.target.value)} />
        <span style={{ fontSize: 10, color: '#4b5563' }}>min</span>
      </div>
      <span style={{ color: '#4b5563', fontSize: 22, fontWeight: 700, marginBottom: 16 }}>:</span>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
        <input style={fieldStyle} type="number" min="0" max="59" placeholder="00" value={parts.s} onChange={e => update('s', e.target.value)} />
        <span style={{ fontSize: 10, color: '#4b5563' }}>sec</span>
      </div>
      <span style={{ color: '#4b5563', fontSize: 18, fontWeight: 700, marginBottom: 16 }}>.</span>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
        <input style={{ ...fieldStyle, width: 44 }} type="number" min="0" max="99" placeholder="00" value={parts.cs} onChange={e => update('cs', e.target.value)} />
        <span style={{ fontSize: 10, color: '#4b5563' }}>1/100s</span>
      </div>
    </div>
  )
}

// ── Format result for display ─────────────────────────────────
function formatResult(entry, resultType) {
  if (resultType === 'time' && entry.time_ms != null) {
    const ms = entry.time_ms
    const h = Math.floor(ms / 3600000)
    const m = Math.floor((ms % 3600000) / 60000)
    const s = Math.floor((ms % 60000) / 1000)
    const cs = Math.floor((ms % 1000) / 10)
    if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}.${String(cs).padStart(2,'0')}`
    return `${m}:${String(s).padStart(2,'0')}.${String(cs).padStart(2,'0')}`
  }
  if (resultType === 'weight_reps') return `${entry.weight}lb × ${entry.reps}`
  if (resultType === 'score') return `${entry.score}`
  if (resultType === 'custom') return `${entry.custom_val}`
  return '—'
}

// ── New Event Modal ───────────────────────────────────────────
function EventModal({ onClose, onSaved, userId }) {
  const [sport, setSport] = useState('')
  const [customSport, setCustomSport] = useState('')
  const [eventName, setEventName] = useState('')
  const [resultType, setResultType] = useState('time')
  const [unit, setUnit] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSave() {
    const sportVal = sport === 'Other' ? customSport.trim() : sport
    if (!sportVal) { setError('Select a sport'); return }
    if (!eventName.trim()) { setError('Event name required'); return }
    setSaving(true)
    const { error: err } = await supabase.from('pr_events').insert({
      user_id: userId, sport: sportVal, event_name: eventName.trim(),
      result_type: resultType, unit: unit.trim() || null
    })
    if (err) { setError(err.message); setSaving(false); return }
    setSaving(false)
    onSaved()
  }

  const overlay = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 50 }
  const drawer = { background: '#0d1117', borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 600, maxHeight: '85vh', overflowY: 'auto', padding: 24, boxSizing: 'border-box' }
  const labelStyle = { fontSize: 12, color: '#6b7280', marginBottom: 6, display: 'block' }
  const inputStyle = { width: '100%', background: '#111827', border: '1.5px solid #1f2937', borderRadius: 10, color: '#fff', fontSize: 15, padding: '10px 12px', outline: 'none', boxSizing: 'border-box' }

  return (
    <div style={overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={drawer}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ color: '#fff', fontSize: 20, fontWeight: 700, margin: 0 }}>New Event</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#6b7280', fontSize: 22, cursor: 'pointer' }}>✕</button>
        </div>
        {error && <div style={{ background: '#7f1d1d', color: '#fca5a5', borderRadius: 8, padding: '8px 12px', fontSize: 13, marginBottom: 16 }}>{error}</div>}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={labelStyle}>Sport</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {SPORTS.map(s => (
                <button key={s} onClick={() => setSport(s)} style={{ padding: '6px 14px', borderRadius: 999, fontSize: 13, fontWeight: 600, border: `1.5px solid ${sport === s ? '#3b82f6' : '#1f2937'}`, background: sport === s ? '#3b82f622' : 'transparent', color: sport === s ? '#3b82f6' : '#6b7280', cursor: 'pointer' }}>{s}</button>
              ))}
            </div>
            {sport === 'Other' && (
              <input style={{ ...inputStyle, marginTop: 8 }} value={customSport} onChange={e => setCustomSport(e.target.value)} placeholder="Enter sport name" />
            )}
          </div>

          <div>
            <label style={labelStyle}>Event / Exercise Name</label>
            <input style={inputStyle} value={eventName} onChange={e => setEventName(e.target.value)} placeholder="e.g. 5K Race, Bench Press, 100m Freestyle" />
          </div>

          <div>
            <label style={labelStyle}>Result Type</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {RESULT_TYPES.map(({ key, label, sub }) => (
                <button key={key} onClick={() => setResultType(key)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', borderRadius: 10, border: `1.5px solid ${resultType === key ? '#3b82f6' : '#1f2937'}`, background: resultType === key ? '#3b82f611' : 'transparent', cursor: 'pointer' }}>
                  <span style={{ color: resultType === key ? '#fff' : '#9ca3af', fontSize: 14, fontWeight: 600 }}>{label}</span>
                  <span style={{ color: '#4b5563', fontSize: 12 }}>{sub}</span>
                </button>
              ))}
            </div>
          </div>

          {(resultType === 'score' || resultType === 'custom') && (
            <div>
              <label style={labelStyle}>Unit Label {resultType === 'custom' ? '(required)' : '(optional)'}</label>
              <input style={inputStyle} value={unit} onChange={e => setUnit(e.target.value)} placeholder={resultType === 'custom' ? 'e.g. meters, points, laps' : 'e.g. points'} />
            </div>
          )}

          <button onClick={handleSave} disabled={saving} style={{ width: '100%', background: saving ? '#374151' : '#3b82f6', border: 'none', borderRadius: 12, color: '#fff', fontSize: 16, fontWeight: 700, padding: '14px 0', cursor: saving ? 'not-allowed' : 'pointer' }}>
            {saving ? 'Saving...' : 'Create Event'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Log Entry Modal ───────────────────────────────────────────
function EntryModal({ event, onClose, onSaved, userId }) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [timeMs, setTimeMs] = useState(null)
  const [weight, setWeight] = useState('')
  const [reps, setReps] = useState('')
  const [score, setScore] = useState('')
  const [customVal, setCustomVal] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSave() {
    if (!date) { setError('Date required'); return }
    setSaving(true)
    const payload = {
      event_id: event.id, user_id: userId, event_date: date,
      time_ms: event.result_type === 'time' ? timeMs : null,
      weight: event.result_type === 'weight_reps' ? parseFloat(weight) : null,
      reps: event.result_type === 'weight_reps' ? parseInt(reps) : null,
      score: event.result_type === 'score' ? parseFloat(score) : null,
      custom_val: event.result_type === 'custom' ? customVal : null,
      notes: notes.trim() || null
    }
    const { error: err } = await supabase.from('pr_entries').insert(payload)
    if (err) { setError(err.message); setSaving(false); return }
    setSaving(false)
    onSaved()
  }

  const overlay = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 50 }
  const drawer = { background: '#0d1117', borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 600, maxHeight: '85vh', overflowY: 'auto', padding: 24, boxSizing: 'border-box' }
  const labelStyle = { fontSize: 12, color: '#6b7280', marginBottom: 6, display: 'block' }
  const inputStyle = { width: '100%', background: '#111827', border: '1.5px solid #1f2937', borderRadius: 10, color: '#fff', fontSize: 15, padding: '10px 12px', outline: 'none', boxSizing: 'border-box' }

  return (
    <div style={overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={drawer}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <div>
            <h2 style={{ color: '#fff', fontSize: 18, fontWeight: 700, margin: 0 }}>Log Entry</h2>
            <p style={{ color: '#6b7280', fontSize: 13, margin: '2px 0 0' }}>{event.sport} · {event.event_name}</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#6b7280', fontSize: 22, cursor: 'pointer' }}>✕</button>
        </div>

        {error && <div style={{ background: '#7f1d1d', color: '#fca5a5', borderRadius: 8, padding: '8px 12px', fontSize: 13, margin: '12px 0' }}>{error}</div>}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 16 }}>
          <div>
            <label style={labelStyle}>Date</label>
            <input style={inputStyle} type="date" value={date} onChange={e => setDate(e.target.value)} />
          </div>

          {event.result_type === 'time' && (
            <div>
              <label style={labelStyle}>Time</label>
              <TimeInput value={timeMs} onChange={setTimeMs} />
            </div>
          )}

          {event.result_type === 'weight_reps' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={labelStyle}>Weight (lb)</label>
                <input style={inputStyle} type="number" value={weight} onChange={e => setWeight(e.target.value)} placeholder="225" />
              </div>
              <div>
                <label style={labelStyle}>Reps</label>
                <input style={inputStyle} type="number" value={reps} onChange={e => setReps(e.target.value)} placeholder="5" />
              </div>
            </div>
          )}

          {event.result_type === 'score' && (
            <div>
              <label style={labelStyle}>Score {event.unit ? `(${event.unit})` : ''}</label>
              <input style={inputStyle} type="number" value={score} onChange={e => setScore(e.target.value)} placeholder="0" />
            </div>
          )}

          {event.result_type === 'custom' && (
            <div>
              <label style={labelStyle}>{event.unit || 'Value'}</label>
              <input style={inputStyle} value={customVal} onChange={e => setCustomVal(e.target.value)} placeholder="Enter value" />
            </div>
          )}

          <div>
            <label style={labelStyle}>Notes (optional)</label>
            <input style={inputStyle} value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g. race conditions, felt strong..." />
          </div>

          <button onClick={handleSave} disabled={saving} style={{ width: '100%', background: saving ? '#374151' : '#3b82f6', border: 'none', borderRadius: 12, color: '#fff', fontSize: 16, fontWeight: 700, padding: '14px 0', cursor: saving ? 'not-allowed' : 'pointer' }}>
            {saving ? 'Saving...' : 'Save Entry'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Event Card ────────────────────────────────────────────────
function EventCard({ event, entries, onLog, onSelect }) {
  const isTime = event.result_type === 'time'
  // For time: PR = lowest time_ms. For others: PR = highest score/weight/custom
  const pr = entries.length === 0 ? null : entries.reduce((best, e) => {
    if (!best) return e
    if (isTime) return (e.time_ms < best.time_ms) ? e : best
    if (event.result_type === 'weight_reps') return (e.weight > best.weight || (e.weight === best.weight && e.reps > best.reps)) ? e : best
    if (event.result_type === 'score') return (parseFloat(e.score) > parseFloat(best.score)) ? e : best
    return e
  }, null)

  return (
    <div onClick={() => onSelect(event)} style={{ background: '#0d1117', borderRadius: 16, padding: 18, border: '1.5px solid #1f2937', cursor: 'pointer' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <div>
          <h3 style={{ color: '#fff', fontSize: 16, fontWeight: 700, margin: '0 0 2px' }}>{event.event_name}</h3>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999, background: '#1e3a5f', color: '#3b82f6', fontWeight: 600 }}>{event.sport}</span>
            <span style={{ fontSize: 11, color: '#4b5563' }}>{RESULT_TYPES.find(r => r.key === event.result_type)?.label}</span>
          </div>
        </div>
        <button
          onClick={e => { e.stopPropagation(); onLog(event) }}
          style={{ background: '#3b82f6', border: 'none', borderRadius: 8, color: '#fff', fontSize: 12, fontWeight: 700, padding: '6px 12px', cursor: 'pointer', whiteSpace: 'nowrap' }}
        >
          + Log
        </button>
      </div>

      <div style={{ display: 'flex', gap: 16 }}>
        <div>
          <div style={{ fontSize: 11, color: '#4b5563', marginBottom: 2 }}>PERSONAL BEST</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: pr ? '#4ade80' : '#374151' }}>
            {pr ? formatResult(pr, event.result_type) : '—'}
          </div>
        </div>
        {entries.length > 0 && (
          <div>
            <div style={{ fontSize: 11, color: '#4b5563', marginBottom: 2 }}>ENTRIES</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#6b7280' }}>{entries.length}</div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Event Detail Drawer ───────────────────────────────────────
function EventDetail({ event, entries, onClose, onLog }) {
  const isTime = event.result_type === 'time'
  const sorted = [...entries].sort((a, b) => new Date(b.event_date) - new Date(a.event_date))

  const overlay = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 50 }
  const drawer = { background: '#0d1117', borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 600, maxHeight: '85vh', overflowY: 'auto', padding: 24, boxSizing: 'border-box' }

  return (
    <div style={overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={drawer}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <h2 style={{ color: '#fff', fontSize: 20, fontWeight: 700, margin: '0 0 4px' }}>{event.event_name}</h2>
            <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 999, background: '#1e3a5f', color: '#3b82f6', fontWeight: 600 }}>{event.sport}</span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#6b7280', fontSize: 22, cursor: 'pointer' }}>✕</button>
        </div>

        <button onClick={() => onLog(event)} style={{ width: '100%', background: '#3b82f6', border: 'none', borderRadius: 12, color: '#fff', fontSize: 15, fontWeight: 700, padding: '12px 0', cursor: 'pointer', marginBottom: 20 }}>
          + Log New Entry
        </button>

        {sorted.length === 0 ? (
          <p style={{ color: '#4b5563', textAlign: 'center' }}>No entries yet</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {sorted.map((entry, i) => {
              const isPR = i === (isTime
                ? sorted.reduce((bi, e, ei) => e.time_ms < sorted[bi].time_ms ? ei : bi, 0)
                : sorted.reduce((bi, e, ei) => {
                    if (event.result_type === 'weight_reps') return e.weight > sorted[bi].weight ? ei : bi
                    if (event.result_type === 'score') return parseFloat(e.score) > parseFloat(sorted[bi].score) ? ei : bi
                    return bi
                  }, 0))
              return (
                <div key={entry.id} style={{ background: '#111827', borderRadius: 12, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: `1.5px solid ${isPR ? '#14532d' : '#1f2937'}` }}>
                  <div>
                    <div style={{ fontSize: 11, color: '#4b5563' }}>
                      {new Date(entry.event_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </div>
                    {entry.notes && <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{entry.notes}</div>}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: isPR ? '#4ade80' : '#fff' }}>
                      {formatResult(entry, event.result_type)}
                    </div>
                    {isPR && <div style={{ fontSize: 10, color: '#4ade80', fontWeight: 600 }}>PR 🏆</div>}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main PR Tracker ───────────────────────────────────────────
export default function PRTracker() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [events, setEvents] = useState([])
  const [entriesByEvent, setEntriesByEvent] = useState({})
  const [loading, setLoading] = useState(true)
  const [showEventModal, setShowEventModal] = useState(false)
  const [logEvent, setLogEvent] = useState(null)
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [filterSport, setFilterSport] = useState('All')

  useEffect(() => {
    loadAll()
    if (searchParams.get('new') === '1') setShowEventModal(true)
  }, [])

  async function loadAll() {
    setLoading(true)
    const { data: evts } = await supabase
      .from('pr_events').select('*').eq('user_id', user.id).order('created_at', { ascending: false })

    if (!evts?.length) { setEvents([]); setLoading(false); return }

    const { data: ents } = await supabase
      .from('pr_entries').select('*')
      .in('event_id', evts.map(e => e.id))
      .order('event_date', { ascending: false })

    const map = {}
    evts.forEach(e => { map[e.id] = [] })
    ents?.forEach(e => { if (map[e.event_id]) map[e.event_id].push(e) })

    setEvents(evts)
    setEntriesByEvent(map)
    setLoading(false)
  }

  function handleLog(event) { setLogEvent(event); setSelectedEvent(null) }

  const sports = ['All', ...new Set(events.map(e => e.sport))]
  const filtered = filterSport === 'All' ? events : events.filter(e => e.sport === filterSport)

  return (
    <div style={{ minHeight: '100dvh', background: '#030712', paddingBottom: 80, boxSizing: 'border-box' }}>
      {/* Header */}
      <div style={{ padding: '28px 20px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ color: '#fff', fontSize: 24, fontWeight: 800, margin: 0 }}>PR Tracker</h1>
        <button onClick={() => setShowEventModal(true)} style={{ background: '#3b82f6', border: 'none', borderRadius: 10, color: '#fff', fontSize: 13, fontWeight: 700, padding: '10px 16px', cursor: 'pointer' }}>
          + New Event
        </button>
      </div>

      {/* Sport filter */}
      {events.length > 0 && (
        <div style={{ paddingLeft: 20, marginBottom: 16, overflowX: 'auto', display: 'flex', gap: 8, paddingBottom: 4 }}>
          {sports.map(s => (
            <button key={s} onClick={() => setFilterSport(s)} style={{ padding: '6px 14px', borderRadius: 999, border: 'none', whiteSpace: 'nowrap', background: filterSport === s ? '#3b82f6' : '#111827', color: filterSport === s ? '#fff' : '#6b7280', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              {s}
            </button>
          ))}
        </div>
      )}

      <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {loading ? (
          <p style={{ color: '#4b5563', textAlign: 'center', marginTop: 60 }}>Loading...</p>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', marginTop: 60 }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🏆</div>
            <p style={{ color: '#4b5563', marginBottom: 20 }}>No events yet — create one to start tracking PRs</p>
            <button onClick={() => setShowEventModal(true)} style={{ background: '#3b82f6', border: 'none', borderRadius: 12, color: '#fff', fontSize: 15, fontWeight: 700, padding: '13px 28px', cursor: 'pointer' }}>
              Create First Event
            </button>
          </div>
        ) : (
          filtered.map(event => (
            <EventCard
              key={event.id}
              event={event}
              entries={entriesByEvent[event.id] ?? []}
              onLog={handleLog}
              onSelect={setSelectedEvent}
            />
          ))
        )}
      </div>

      {showEventModal && (
        <EventModal
          userId={user.id}
          onClose={() => setShowEventModal(false)}
          onSaved={() => { setShowEventModal(false); loadAll() }}
        />
      )}

      {logEvent && (
        <EntryModal
          event={logEvent}
          userId={user.id}
          onClose={() => setLogEvent(null)}
          onSaved={() => { setLogEvent(null); loadAll() }}
        />
      )}

      {selectedEvent && (
        <EventDetail
          event={selectedEvent}
          entries={entriesByEvent[selectedEvent.id] ?? []}
          onClose={() => setSelectedEvent(null)}
          onLog={handleLog}
        />
      )}

      <BottomNav />
    </div>
  )
}
