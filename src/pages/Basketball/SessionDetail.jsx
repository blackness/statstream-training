import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ChevronLeft, Trash2, Pencil } from 'lucide-react'
import {
  getSession, deleteSession,
  getDrillTemplates, updateSessionDrills, updateSession,
} from '../../lib/basketballClient'
import SessionEditWizard from '../../components/Basketball/SessionEditWizard'

// ── Helpers ───────────────────────────────────────────────────────
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

function toTimeInput(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function MetricPill({ label, value }) {
  if (value == null || value === '') return null
  return (
    <div className="bg-gray-800 rounded-xl p-3 flex flex-col items-center gap-1 text-center">
      <div className="text-xs text-gray-400">{label}</div>
      <div className="text-sm font-semibold text-white">{value}</div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────
export default function SessionDetail() {
  const { sessionId } = useParams()
  const navigate      = useNavigate()

  const [session, setSession]             = useState(null)
  const [loading, setLoading]             = useState(true)
  const [error, setError]                 = useState(null)
  const [deleting, setDeleting]           = useState(false)
  const [editingDrills, setEditingDrills] = useState(false)
  const [drillEntries, setDrillEntries]   = useState([])
  const [sessionDraft, setSessionDraft]   = useState(null)
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

    // Drills with previous data carry forward; drills never entered start pre-skipped
    setDrillEntries(templates.map(t => {
      const existing = existingMap[t.id]
      return {
        template:        t,
        shots_made:      existing ? String(existing.shots_made      ?? '') : '',
        shots_attempted: existing ? String(existing.shots_attempted ?? '') : '',
        skipped:         !existing,
      }
    }))

    setSessionDraft({
      session_date:        session.session_date,
      start_time_input:    toTimeInput(session.start_time),
      duration_minutes:    session.duration_minutes    ?? '',
      warmup_type:         session.warmup_type         ?? null,
      first_shot_made:     session.first_shot_made     ?? null,
      opening_threes_made: session.opening_threes_made ?? '',
      sleep_hours:         session.sleep_hours         ?? '',
      sleep_quality:       session.sleep_quality       ?? null,
      mood:                session.mood                ?? '',
      soreness:            session.soreness            ?? '',
      nutrition_quality:   session.nutrition_quality   ?? null,
      weight:              session.weight              ?? '',
      notes:               session.notes               ?? '',
    })

    setDrillError(null)
    setEditingDrills(true)
  }

  const setDrillField = (i, k, v) =>
    setDrillEntries(prev => prev.map((e, idx) => idx === i ? { ...e, [k]: v } : e))

  const setDraftField = (k, v) =>
    setSessionDraft(prev => ({ ...prev, [k]: v }))

  async function handleSaveDrills() {
    setSavingDrills(true)
    setDrillError(null)

    // ── 1. Save session fields ─────────────────────────────────
    const toInt   = v => (v !== '' && v != null) ? parseInt(v)   : null
    const toFloat = v => (v !== '' && v != null) ? parseFloat(v) : null

    const { error: sessionErr } = await updateSession(sessionId, {
      session_date:        sessionDraft.session_date,
      start_time:          sessionDraft.start_time_input
        ? new Date(`${sessionDraft.session_date}T${sessionDraft.start_time_input}`).toISOString()
        : null,
      duration_minutes:    toInt(sessionDraft.duration_minutes),
      warmup_type:         sessionDraft.warmup_type,
      first_shot_made:     sessionDraft.first_shot_made,
      opening_threes_made: toInt(sessionDraft.opening_threes_made),
      sleep_hours:         toFloat(sessionDraft.sleep_hours),
      sleep_quality:       sessionDraft.sleep_quality,
      mood:                toInt(sessionDraft.mood),
      soreness:            toInt(sessionDraft.soreness),
      nutrition_quality:   sessionDraft.nutrition_quality,
      weight:              toFloat(sessionDraft.weight),
      notes:               sessionDraft.notes || null,
    })

    if (sessionErr) {
      setDrillError(sessionErr.message)
      setSavingDrills(false)
      return
    }

    // ── 2. Save drills ─────────────────────────────────────────
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

    const { error: drillErr } = await updateSessionDrills(sessionId, payloads)
    if (drillErr) { setDrillError(drillErr.message); setSavingDrills(false); return }

    await loadSession()
    setEditingDrills(false)
    setSavingDrills(false)
  }

  // ── Loading / error ───────────────────────────────────────────
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
  const pctColor    = overallPct >= 80 ? 'text-green-400' : overallPct >= 60 ? 'text-orange-400' : 'text-red-400'
  const warmupLabel = { full: '✓ Full warmup', half: '~ Half warmup', none: '✗ No warmup' }

  return (
    <div className="min-h-screen bg-gray-950 text-white pb-10">

      {/* ── Wizard overlay ── */}
      {editingDrills && sessionDraft && (
        <SessionEditWizard
          sessionDraft={sessionDraft}
          drillEntries={drillEntries}
          onDraftChange={setDraftField}
          onDrillFieldChange={setDrillField}
          onDrillSkip={i => setDrillField(i, 'skipped', !drillEntries[i].skipped)}
          onSave={handleSaveDrills}
          onCancel={() => setEditingDrills(false)}
          saving={savingDrills}
          error={drillError} />
      )}

      {/* ── Delete confirm ── */}
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

      {/* ── Header ── */}
      <div className="bg-gray-900 border-b border-gray-800 px-4 py-4 sticky top-0 z-10">
        <div className="flex items-center gap-3 max-w-2xl mx-auto">
          <button onClick={() => navigate('/basketball')} className="text-gray-400 hover:text-white">
            <ChevronLeft size={20} />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-bold truncate">{fmtDate(session.session_date)}</h1>
            <p className="text-xs text-gray-400">
              {session.players?.name}
              {fmtTime(session.start_time) && ` · ${fmtTime(session.start_time)}`}
              {session.duration_minutes    && ` · ${session.duration_minutes} min`}
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={startEditDrills}
              className="text-gray-400 hover:text-orange-400 p-1.5 rounded-lg hover:bg-gray-800 transition-colors"
              title="Edit session">
              <Pencil size={18} />
            </button>
            <button onClick={() => setDeleting(true)}
              className="text-gray-600 hover:text-red-400 p-1.5 rounded-lg hover:bg-gray-800 transition-colors">
              <Trash2 size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* ── View mode ── */}
      <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">

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
              <button onClick={startEditDrills}
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
              {drills.length === 0 && <span className="text-xs text-gray-600">— none recorded</span>}
            </div>
            <button onClick={startEditDrills}
              className="text-xs text-orange-400 hover:text-orange-300 flex items-center gap-1">
              <Pencil size={12} /> Edit
            </button>
          </div>
          {drills.length === 0 ? (
            <div className="px-4 py-6 text-center space-y-3">
              <p className="text-gray-500 text-sm">No drills recorded for this session</p>
              <button onClick={startEditDrills}
                className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-medium">
                Add Drill Data
              </button>
            </div>
          ) : (
            drills.map(d => {
              const name        = d.drill_templates?.name || d.custom_name || 'Unknown drill'
              const goal        = d.drill_templates?.goal_percent
              const isMakeCount = d.drill_templates?.drill_type === 'make_count'
              const isFreeThrow = d.drill_templates?.drill_type === 'free_throw'
              const pct         = d.shots_attempted > 0
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
                        : <span>{d.shots_made}/{d.shots_attempted} makes</span>}
                      {d.contested && <span>· contested</span>}
                      {goal && <span>· goal {goal}%{goalMet ? ' ✓' : ''}</span>}
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
            <MetricPill label="Sleep"
              value={session.sleep_hours != null
                ? `${session.sleep_hours}h${session.sleep_quality ? ` · ${session.sleep_quality}` : ''}`
                : null} />
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
      </div>
    </div>
  )
}