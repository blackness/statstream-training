import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ChevronLeft, Trash2, Pencil, Save, SkipForward, X } from 'lucide-react'
import {
  getSession, deleteSession,
  getDrillTemplates, updateSessionDrills,
} from '../../lib/basketballClient'

function fmtDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
  })
}

function fmtTime(ts) {
  if (!ts) return null
  return new Date(ts).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
}

function MetricPill({ icon, label, value }) {
  if (value == null || value === '') return null
  return (
    <div className="bg-gray-800 rounded-xl p-3 flex flex-col items-center gap-1 text-center">
      <div className="text-gray-400">{icon}</div>
      <div className="text-xs text-gray-400">{label}</div>
      <div className="text-sm font-semibold text-white">{value}</div>
    </div>
  )
}

// ── Drill edit card ────────────────────────────────────────────────
function DrillEditCard({ entry, index, onSkip, onFieldChange }) {
  const isMakeCount = entry.template.drill_type === 'make_count'
  const isFreeThrow = entry.template.drill_type === 'free_throw'
  const total       = entry.template.total_attempts
  const requiredMakes = entry.template.required_makes || 0

  let pct = null
  if (isFreeThrow) {
    const m = parseInt(entry.shots_made) || 0
    const a = parseInt(entry.shots_attempted) || 0
    if (a > 0) pct = Math.round((m / a) * 100)
  } else if (isMakeCount) {
    const a = parseInt(entry.shots_attempted) || 0
    if (a > 0) pct = Math.round((requiredMakes / a) * 100)
  } else {
    const m = parseInt(entry.shots_made) || 0
    if (total > 0 && entry.shots_made !== '') pct = Math.round((m / total) * 100)
  }

  const goalMet  = pct != null && entry.template.goal_percent && pct >= entry.template.goal_percent
  const pctColor = goalMet ? 'text-green-400' : 'text-orange-400'

  return (
    <div className={`bg-gray-800 rounded-xl p-4 border transition-all ${
      entry.skipped ? 'border-gray-700 opacity-40' :
      isMakeCount   ? 'border-purple-900' :
      isFreeThrow   ? 'border-blue-900' :
                      'border-gray-700'
    }`}>
      <div className="flex items-center justify-between mb-3">
        <div className="min-w-0 flex-1">
          <div className="font-medium text-sm truncate">{entry.template.name}</div>
          <div className="text-xs text-gray-400 mt-0.5">
            {isMakeCount  && <span className="text-purple-400">make {requiredMakes} shots · enter attempts</span>}
            {isFreeThrow  && <span className="text-blue-400">enter makes + attempts</span>}
            {!isMakeCount && !isFreeThrow && <span>{total} attempts</span>}
            {entry.template.goal_percent && <span> · goal {entry.template.goal_percent}%</span>}
          </div>
        </div>
        <button
          onClick={() => onSkip(index)}
          className={`flex items-center gap-1 text-xs px-2 py-1 rounded-lg flex-shrink-0 ml-2 ${
            entry.skipped ? 'bg-gray-700 text-gray-300' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
          }`}>
          <SkipForward size={12} /> {entry.skipped ? 'Skipped' : 'Skip'}
        </button>
      </div>

      {!entry.skipped && (
        <>
          {isFreeThrow ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="text-center">
                <div className="text-xs text-gray-400 mb-1">Makes</div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => onFieldChange(index, 'shots_made', String(Math.max(0, (parseInt(entry.shots_made) || 0) - 1)))}
                    className="w-9 h-9 bg-gray-700 hover:bg-gray-600 rounded-lg text-xl font-bold text-gray-300 flex items-center justify-center">−</button>
                  <input
                    type="number" inputMode="numeric" min="0"
                    value={entry.shots_made} placeholder="0"
                    onChange={e => onFieldChange(index, 'shots_made', e.target.value)}
                    className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-1 py-2 text-xl font-bold text-center text-white min-w-0" />
                  <button
                    onClick={() => onFieldChange(index, 'shots_made', String((parseInt(entry.shots_made) || 0) + 1))}
                    className="w-9 h-9 bg-gray-700 hover:bg-gray-600 rounded-lg text-xl font-bold text-gray-300 flex items-center justify-center">+</button>
                </div>
              </div>
              <div className="text-center">
                <div className="text-xs text-gray-400 mb-1">Attempts</div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => onFieldChange(index, 'shots_attempted', String(Math.max(0, (parseInt(entry.shots_attempted) || 0) - 1)))}
                    className="w-9 h-9 bg-gray-700 hover:bg-gray-600 rounded-lg text-xl font-bold text-gray-300 flex items-center justify-center">−</button>
                  <input
                    type="number" inputMode="numeric" min="0"
                    value={entry.shots_attempted} placeholder="0"
                    onChange={e => onFieldChange(index, 'shots_attempted', e.target.value)}
                    className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-1 py-2 text-xl font-bold text-center text-white min-w-0" />
                  <button
                    onClick={() => onFieldChange(index, 'shots_attempted', String((parseInt(entry.shots_attempted) || 0) + 1))}
                    className="w-9 h-9 bg-gray-700 hover:bg-gray-600 rounded-lg text-xl font-bold text-gray-300 flex items-center justify-center">+</button>
                </div>
              </div>
              {pct != null && (
                <div className="col-span-2 text-center">
                  <span className={`text-sm font-bold ${pctColor}`}>{pct}%{goalMet ? ' ✓' : ''}</span>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  const field = isMakeCount ? 'shots_attempted' : 'shots_made'
                  const cur   = parseInt(entry[field]) || 0
                  onFieldChange(index, field, String(Math.max(0, cur - 1)))
                }}
                className="w-11 h-11 bg-gray-700 hover:bg-gray-600 rounded-xl text-2xl font-bold text-gray-300 flex items-center justify-center">−</button>
              <div className="flex-1 text-center">
                <input
                  type="number" inputMode="numeric" min="0"
                  value={isMakeCount ? (entry.shots_attempted ?? '') : (entry.shots_made ?? '')}
                  placeholder="0"
                  onChange={e => onFieldChange(index, isMakeCount ? 'shots_attempted' : 'shots_made', e.target.value)}
                  className="w-20 bg-gray-700 border border-gray-600 rounded-xl px-2 py-2 text-2xl font-bold text-center text-white" />
                <div className="text-xs text-gray-400 mt-1">
                  {isMakeCount ? `shots to make ${requiredMakes}` : `of ${total}`}
                  {pct != null && (
                    <span className={`ml-1 font-medium ${pctColor}`}>
                      · {pct}%{isMakeCount ? ' eff.' : ''}{goalMet ? ' ✓' : ''}
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={() => {
                  const field = isMakeCount ? 'shots_attempted' : 'shots_made'
                  const cur   = parseInt(entry[field]) || 0
                  const max   = isMakeCount ? 9999 : total
                  onFieldChange(index, field, String(Math.min(max, cur + 1)))
                }}
                className="w-11 h-11 bg-gray-700 hover:bg-gray-600 rounded-xl text-2xl font-bold text-gray-300 flex items-center justify-center">+</button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────
export default function SessionDetail() {
  const { sessionId } = useParams()
  const navigate      = useNavigate()
  const [session, setSession]       = useState(null)
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState(null)
  const [deleting, setDeleting]     = useState(false)
  const [editingDrills, setEditingDrills] = useState(false)
  const [drillEntries, setDrillEntries]   = useState([])
  const [savingDrills, setSavingDrills]   = useState(false)
  const [drillError, setDrillError]       = useState(null)

  useEffect(() => { loadSession() }, [sessionId])

  async function loadSession() {
    const { data, error: e } = await getSession(sessionId)
    if (e) { setError(e.message); setLoading(false); return }
    if (data?.session_drills) {
      data.session_drills.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    }
    setSession(data)
    setLoading(false)
  }

  async function startEditDrills() {
    const { data: templates } = await getDrillTemplates()
    if (!templates) return
    const existingMap = {}
    ;(session.session_drills || []).forEach(sd => {
      existingMap[sd.drill_template_id] = sd
    })
    setDrillEntries(templates.map(t => {
      const existing = existingMap[t.id]
      return {
        template:        t,
        shots_made:      existing ? String(existing.shots_made ?? '')      : '',
        shots_attempted: existing ? String(existing.shots_attempted ?? '') : '',
        skipped:         false,
      }
    }))
    setDrillError(null)
    setEditingDrills(true)
  }

  const setDrillField = (i, k, v) =>
    setDrillEntries(prev => prev.map((e, idx) => idx === i ? { ...e, [k]: v } : e))

  async function handleSaveDrills() {
    setSavingDrills(true)
    setDrillError(null)

    const payloads = drillEntries
      .filter(e => {
        if (e.skipped) return false
        const isMakeCount = e.template.drill_type === 'make_count'
        const isFreeThrow = e.template.drill_type === 'free_throw'
        if (isMakeCount) return e.shots_attempted !== '' && e.shots_attempted !== null
        if (isFreeThrow) return (parseInt(e.shots_attempted) || 0) > 0
        return e.shots_made !== '' && e.shots_made !== null
      })
      .map((e, i) => {
        const isMakeCount = e.template.drill_type === 'make_count'
        const isFreeThrow = e.template.drill_type === 'free_throw'
        return {
          session_id:        sessionId,
          drill_template_id: e.template.id,
          shots_made:        isMakeCount
            ? (e.template.required_makes || 0)
            : (parseInt(e.shots_made) || 0),
          shots_attempted:   isMakeCount || isFreeThrow
            ? (parseInt(e.shots_attempted) || 0)
            : (e.template.total_attempts || 0),
          contested:         e.template.contested || false,
          sort_order:        i,
        }
      })

    const { error: e } = await updateSessionDrills(sessionId, payloads)
    if (e) { setDrillError(e.message); setSavingDrills(false); return }

    // reload session to reflect new drills
    await loadSession()
    setEditingDrills(false)
    setSavingDrills(false)
  }

  if (loading) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <p className="text-gray-500">Loading...</p>
    </div>
  )

  if (error || !session) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="text-center">
        <p className="text-red-400 mb-4">{error || 'Session not found'}</p>
        <button onClick={() => navigate('/basketball')} className="text-orange-400 underline text-sm">
          Back to Dashboard
        </button>
      </div>
    </div>
  )

  const drills        = session.session_drills || []
  const totalMade     = drills.reduce((s, d) => s + (d.shots_made     || 0), 0)
  const totalAttempts = drills.reduce((s, d) => s + (d.shots_attempted || 0), 0)
  const overallPct    = totalAttempts > 0
    ? Math.round((totalMade / totalAttempts) * 1000) / 10
    : null
  const pctColor      = overallPct >= 80 ? 'text-green-400' : overallPct >= 60 ? 'text-orange-400' : 'text-red-400'
  const warmupLabel   = { full: '✓ Full warmup', half: '~ Half warmup', none: '✗ No warmup' }

  return (
    <div className="min-h-screen bg-gray-950 text-white pb-10">
      {/* Delete confirm modal */}
      {deleting && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center px-6">
          <div className="bg-gray-900 rounded-2xl p-6 border border-gray-700 w-full max-w-sm shadow-2xl">
            <h2 className="text-base font-bold text-white mb-1">Delete Session?</h2>
            <p className="text-sm text-gray-400 mb-5">This cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleting(false)}
                className="flex-1 py-3 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium">
                Cancel
              </button>
              <button
                onClick={async () => { await deleteSession(sessionId); navigate('/basketball') }}
                className="flex-1 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-bold">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 px-4 py-4 sticky top-0 z-10">
        <div className="flex items-center gap-3 max-w-2xl mx-auto">
          <button
            onClick={() => editingDrills ? setEditingDrills(false) : navigate('/basketball')}
            className="text-gray-400 hover:text-white">
            <ChevronLeft size={20} />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-bold truncate">
              {editingDrills ? 'Edit Drills' : fmtDate(session.session_date)}
            </h1>
            {!editingDrills && (
              <p className="text-xs text-gray-400">
                {session.players?.name}
                {fmtTime(session.start_time) && ` · ${fmtTime(session.start_time)}`}
                {session.duration_minutes    && ` · ${session.duration_minutes} min`}
              </p>
            )}
          </div>
          {!editingDrills && (
            <div className="flex gap-2">
              <button
                onClick={startEditDrills}
                className="text-gray-400 hover:text-orange-400 p-1.5 rounded-lg hover:bg-gray-800 transition-colors"
                title="Edit drills">
                <Pencil size={18} />
              </button>
              <button
                onClick={() => setDeleting(true)}
                className="text-gray-600 hover:text-red-400 p-1.5 rounded-lg hover:bg-gray-800 transition-colors">
                <Trash2 size={18} />
              </button>
            </div>
          )}
          {editingDrills && (
            <button onClick={() => setEditingDrills(false)} className="text-gray-400 hover:text-white">
              <X size={20} />
            </button>
          )}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">

        {/* ── Edit drills mode ── */}
        {editingDrills ? (
          <>
            <p className="text-xs text-gray-500 text-center">
              All drill templates shown · enter data or skip · tap Save when done
            </p>
            <div className="space-y-3">
              {drillEntries.map((entry, i) => (
                <DrillEditCard
                  key={entry.template.id}
                  entry={entry}
                  index={i}
                  onSkip={idx => setDrillField(idx, 'skipped', !drillEntries[idx].skipped)}
                  onFieldChange={setDrillField}
                />
              ))}
            </div>
            {drillError && (
              <div className="bg-red-900 border border-red-700 rounded-xl p-3 text-xs text-red-200">
                {drillError}
              </div>
            )}
            <button
              onClick={handleSaveDrills}
              disabled={savingDrills}
              className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2">
              <Save size={18} />
              {savingDrills ? 'Saving...' : 'Save Drills'}
            </button>
          </>
        ) : (
          <>
            {/* ── Session detail view ── */}

            {/* Overall score */}
            <div className="bg-gray-900 rounded-xl p-5 border border-gray-800 text-center">
              {overallPct != null ? (
                <>
                  <div className={`text-5xl font-black ${pctColor}`}>{overallPct}%</div>
                  <div className="text-gray-400 text-sm mt-1">{totalMade} / {totalAttempts} makes</div>
                </>
              ) : (
                <div className="space-y-3">
                  <div className="text-gray-500 text-sm">No drill data recorded</div>
                  <button
                    onClick={startEditDrills}
                    className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-medium">
                    Add Drill Data
                  </button>
                </div>
              )}
              {session.warmup_type && (
                <div className="mt-2 text-xs text-gray-500">
                  {warmupLabel[session.warmup_type] ?? session.warmup_type}
                </div>
              )}
            </div>

            {/* First shot + opening 3s */}
            {(session.first_shot_made != null || session.opening_threes_made != null) && (
              <div className="grid grid-cols-2 gap-3">
                {session.first_shot_made != null && (
                  <div className="bg-gray-900 rounded-xl p-4 border border-gray-800 text-center">
                    <div className="text-xs text-gray-400 mb-1">First Shot</div>
                    <div className={`text-2xl font-bold ${session.first_shot_made ? 'text-green-400' : 'text-red-400'}`}>
                      {session.first_shot_made ? '✓ Made' : '✗ Missed'}
                    </div>
                  </div>
                )}
                {session.opening_threes_made != null && (
                  <div className="bg-gray-900 rounded-xl p-4 border border-orange-900 text-center">
                    <div className="text-xs text-orange-400 mb-1">Opening 3s</div>
                    <div className="text-2xl font-bold text-white">{session.opening_threes_made}/20</div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      {Math.round(session.opening_threes_made / 20 * 100)}%
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Drill results */}
            <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-300">Drills</span>
                  {drills.length === 0 && (
                    <span className="text-xs text-gray-600">— none recorded</span>
                  )}
                </div>
                <button
                  onClick={startEditDrills}
                  className="text-xs text-orange-400 hover:text-orange-300 flex items-center gap-1">
                  <Pencil size={12} /> Edit
                </button>
              </div>
              {drills.length === 0 ? (
                <div className="px-4 py-6 text-center space-y-3">
                  <p className="text-gray-500 text-sm">No drills recorded for this session</p>
                  <button
                    onClick={startEditDrills}
                    className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-medium">
                    Add Drill Data
                  </button>
                </div>
              ) : (
                drills.map(d => {
                  const name       = d.drill_templates?.name || d.custom_name || 'Unknown drill'
                  const goal       = d.drill_templates?.goal_percent
                  const isMakeCount = d.drill_templates?.drill_type === 'make_count'
                  const isFreeThrow = d.drill_templates?.drill_type === 'free_throw'
                  const pct        = d.shots_attempted > 0
                    ? Math.round((d.shots_made / d.shots_attempted) * 1000) / 10
                    : null
                  const goalMet  = goal != null && pct != null && pct >= goal
                  const pctColor = pct >= 80 ? 'text-green-400' : pct >= 60 ? 'text-orange-400' : 'text-red-400'

                  return (
                    <div key={d.id}
                      className="px-4 py-3 flex items-center justify-between border-b border-gray-800 last:border-0">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{name}</div>
                        <div className="text-xs text-gray-400 mt-0.5 flex gap-2 flex-wrap">
                          {isMakeCount
                            ? <span className="text-purple-400">made {d.shots_made} in {d.shots_attempted} attempts</span>
                            : isFreeThrow
                            ? <span className="text-blue-400">{d.shots_made} / {d.shots_attempted} free throws</span>
                            : <span>{d.shots_made}/{d.shots_attempted} makes</span>
                          }
                          {d.contested && <span>· contested</span>}
                          {goal        && <span>· goal {goal}%{goalMet ? ' ✓' : ''}</span>}
                        </div>
                      </div>
                      <div className="ml-4 text-right">
                        {pct != null ? (
                          <div>
                            <span className={`text-lg font-bold ${pctColor}`}>{pct}%</span>
                            {isMakeCount && <div className="text-xs text-gray-500">efficiency</div>}
                          </div>
                        ) : (
                          <span className="text-gray-500 text-sm">—</span>
                        )}
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            {/* Session metrics */}
            <div>
              <h2 className="text-sm font-medium text-gray-400 mb-2">Session Metrics</h2>
              <div className="grid grid-cols-3 gap-2">
                <MetricPill label="Sleep"     value={session.sleep_hours != null ? `${session.sleep_hours}h${session.sleep_quality ? ` · ${session.sleep_quality}` : ''}` : null} />
                <MetricPill label="Mood"      value={session.mood      != null ? `${session.mood}/10`      : null} />
                <MetricPill label="Soreness"  value={session.soreness  != null ? `${session.soreness}/10`  : null} />
                <MetricPill label="Nutrition" value={session.nutrition_quality} />
                <MetricPill label="Weight"    value={session.weight    != null ? `${session.weight} lb`    : null} />
                <MetricPill label="Duration"  value={session.duration_minutes != null ? `${session.duration_minutes} min` : null} />
              </div>
            </div>

            {/* Notes */}
            {session.notes && (
              <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
                <h2 className="text-xs text-gray-400 mb-1">Notes</h2>
                <p className="text-sm text-gray-200 whitespace-pre-wrap">{session.notes}</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}