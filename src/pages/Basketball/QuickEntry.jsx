import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import { ChevronLeft, Save, SkipForward, Copy } from 'lucide-react'
import {
  getPlayers, getDrillTemplates,
  createSession, createSessionDrills, duplicateLastSession
} from '../../lib/basketballClient'

const DEFAULT_METRICS = {
  sleep_hours: '',
  sleep_quality: 'good',
  mood: 7,
  soreness: 0,
  nutrition_quality: 'good',
  weight: '',
  duration_minutes: '',
  notes: '',
}

export default function QuickEntry() {
  const navigate = useNavigate()
  const [players, setPlayers]           = useState([])
  const [selectedPlayer, setSelectedPlayer] = useState(null)
  const [sessionDate, setSessionDate]   = useState(format(new Date(), 'yyyy-MM-dd'))
  const [startTime, setStartTime]       = useState(format(new Date(), 'HH:mm'))
  const [metrics, setMetrics]           = useState(DEFAULT_METRICS)
  const [drillEntries, setDrillEntries] = useState([])  // { template, shots_made, skipped }
  const [step, setStep]                 = useState('metrics')  // 'metrics' | 'drills'
  const [saving, setSaving]             = useState(false)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const [{ data: pData }, { data: tData }] = await Promise.all([
      getPlayers(),
      getDrillTemplates(),
    ])
    if (pData?.length) { setPlayers(pData); setSelectedPlayer(pData[0]) }
    if (tData?.length) {
      setDrillEntries(tData.map(t => ({ template: t, shots_made: '', skipped: false })))
    }
  }

  const setMetric  = (k, v) => setMetrics(m => ({ ...m, [k]: v }))
  const setDrillField = (i, k, v) =>
    setDrillEntries(prev => prev.map((e, idx) => idx === i ? { ...e, [k]: v } : e))

  function adjustMakes(i, delta) {
    const entry = drillEntries[i]
    const cur = parseInt(entry.shots_made) || 0
    const next = Math.min(entry.template.total_attempts, Math.max(0, cur + delta))
    setDrillField(i, 'shots_made', String(next))
  }

  async function handleSave() {
    if (!selectedPlayer) return
    setSaving(true)

    const { data: session, error: sErr } = await createSession({
      player_id:        selectedPlayer.id,
      session_date:     sessionDate,
      start_time:       `${sessionDate}T${startTime}:00+00:00`,
      duration_minutes: metrics.duration_minutes ? parseInt(metrics.duration_minutes) : null,
      notes:            metrics.notes || null,
      sleep_hours:      metrics.sleep_hours ? parseFloat(metrics.sleep_hours) : null,
      sleep_quality:    metrics.sleep_quality || null,
      mood:             metrics.mood != null ? parseInt(metrics.mood) : null,
      soreness:         metrics.soreness != null ? parseInt(metrics.soreness) : null,
      nutrition_quality: metrics.nutrition_quality || null,
      weight:           metrics.weight ? parseFloat(metrics.weight) : null,
    })

    if (sErr || !session) {
      alert('Error saving session: ' + sErr?.message)
      setSaving(false)
      return
    }

    const drillPayloads = drillEntries
      .filter(e => !e.skipped && e.shots_made !== '' && e.shots_made !== null)
      .map(e => ({
        session_id:        session.id,
        drill_template_id: e.template.id,
        shots_made:        parseInt(e.shots_made),
        shots_attempted:   e.template.total_attempts,
        contested:         e.template.contested,
      }))

    if (drillPayloads.length > 0) {
      const { error: dErr } = await createSessionDrills(drillPayloads)
      if (dErr) { alert('Error saving drills: ' + dErr?.message); setSaving(false); return }
    }

    setSaving(false)
    navigate('/basketball')
  }

  async function handleRepeatLast() {
    if (!selectedPlayer) return
    setSaving(true)
    const { error } = await duplicateLastSession(
      selectedPlayer.id,
      sessionDate,
      `${sessionDate}T${startTime}:00+00:00`
    )
    setSaving(false)
    if (error) { alert('Error: ' + error.message); return }
    navigate('/basketball')
  }

  const completedDrills = drillEntries.filter(e => !e.skipped && e.shots_made !== '').length

  return (
    <div className="min-h-screen bg-gray-950 text-white pb-32">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 px-4 py-4 sticky top-0 z-10">
        <div className="flex items-center gap-3 max-w-2xl mx-auto">
          <button onClick={() => navigate('/basketball')} className="text-gray-400 hover:text-white">
            <ChevronLeft size={20} />
          </button>
          <h1 className="text-lg font-bold flex-1">Log Session</h1>
          <button
            onClick={handleRepeatLast}
            disabled={saving}
            className="flex items-center gap-1 text-xs bg-gray-800 hover:bg-gray-700 px-3 py-1.5 rounded-lg text-gray-300 disabled:opacity-50"
          >
            <Copy size={14} /> Repeat Last
          </button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">
        {/* Player + date/time */}
        <div className="bg-gray-900 rounded-xl p-4 border border-gray-800 space-y-3">
          <div className="flex gap-2 flex-wrap">
            {players.map(p => (
              <button
                key={p.id}
                onClick={() => setSelectedPlayer(p)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  selectedPlayer?.id === p.id ? 'bg-orange-500 text-white' : 'bg-gray-800 text-gray-300'
                }`}
              >
                {p.name}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-400 block mb-1">Date</label>
              <input type="date" value={sessionDate} onChange={e => setSessionDate(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white" />
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Start Time</label>
              <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white" />
            </div>
          </div>
        </div>

        {/* Step toggle */}
        <div className="flex bg-gray-900 rounded-xl p-1 border border-gray-800">
          {[
            { key: 'metrics', label: 'Session Info' },
            { key: 'drills',  label: `Drills (${completedDrills}/${drillEntries.length})` },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setStep(tab.key)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                step === tab.key ? 'bg-orange-500 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── Session metrics ── */}
        {step === 'metrics' && (
          <div className="bg-gray-900 rounded-xl p-4 border border-gray-800 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-400 block mb-1">Sleep Hours</label>
                <input type="number" step="0.5" min="0" max="24" placeholder="8"
                  value={metrics.sleep_hours} onChange={e => setMetric('sleep_hours', e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white" />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Sleep Quality</label>
                <select value={metrics.sleep_quality} onChange={e => setMetric('sleep_quality', e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white">
                  <option value="good">Good</option>
                  <option value="fair">Fair</option>
                  <option value="poor">Poor</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs text-gray-400 block mb-2">
                Mood: <span className="text-white font-medium">{metrics.mood}/10</span>
              </label>
              <input type="range" min="1" max="10" value={metrics.mood}
                onChange={e => setMetric('mood', e.target.value)}
                className="w-full accent-orange-500" />
              <div className="flex justify-between text-xs text-gray-600 mt-1">
                <span>Terrible</span><span>Excellent</span>
              </div>
            </div>

            <div>
              <label className="text-xs text-gray-400 block mb-2">
                Soreness: <span className="text-white font-medium">{metrics.soreness}/10</span>
              </label>
              <input type="range" min="0" max="10" value={metrics.soreness}
                onChange={e => setMetric('soreness', e.target.value)}
                className="w-full accent-orange-500" />
              <div className="flex justify-between text-xs text-gray-600 mt-1">
                <span>None</span><span>Max</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-400 block mb-1">Nutrition</label>
                <select value={metrics.nutrition_quality} onChange={e => setMetric('nutrition_quality', e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white">
                  <option value="good">Good</option>
                  <option value="fair">Fair</option>
                  <option value="poor">Poor</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Weight (lb)</label>
                <input type="number" step="0.5" placeholder="160"
                  value={metrics.weight} onChange={e => setMetric('weight', e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-400 block mb-1">Duration (min)</label>
                <input type="number" placeholder="90"
                  value={metrics.duration_minutes} onChange={e => setMetric('duration_minutes', e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white" />
              </div>
            </div>

            <div>
              <label className="text-xs text-gray-400 block mb-1">Notes</label>
              <textarea rows={2} placeholder="Session notes..."
                value={metrics.notes} onChange={e => setMetric('notes', e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white resize-none" />
            </div>

            <button onClick={() => setStep('drills')}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white py-3 rounded-xl font-medium">
              Next: Enter Drills →
            </button>
          </div>
        )}

        {/* ── Drill entries ── */}
        {step === 'drills' && (
          <div className="space-y-3">
            {drillEntries.length === 0 && (
              <div className="bg-gray-900 rounded-xl p-6 border border-gray-800 text-center text-gray-500 text-sm">
                No drill templates yet.{' '}
                <button onClick={() => navigate('/basketball/templates')} className="text-orange-400 underline">
                  Add some drills
                </button>
              </div>
            )}
            {drillEntries.map((entry, i) => {
              const made    = parseInt(entry.shots_made) || 0
              const total   = entry.template.total_attempts
              const pct     = entry.shots_made !== '' ? Math.round((made / total) * 100) : null
              const goalMet = pct != null && entry.template.goal_percent && pct >= entry.template.goal_percent

              return (
                <div key={entry.template.id}
                  className={`bg-gray-900 rounded-xl p-4 border transition-opacity ${
                    entry.skipped ? 'border-gray-800 opacity-40' : 'border-gray-700'
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="font-medium text-sm">{entry.template.name}</div>
                      <div className="text-xs text-gray-400 mt-0.5 space-x-2">
                        <span>{total} shots</span>
                        {entry.template.contested && <span>· contested</span>}
                        {entry.template.goal_percent && <span>· goal {entry.template.goal_percent}%</span>}
                      </div>
                    </div>
                    <button
                      onClick={() => setDrillField(i, 'skipped', !entry.skipped)}
                      className={`flex items-center gap-1 text-xs px-2 py-1 rounded-lg ${
                        entry.skipped ? 'bg-gray-700 text-gray-300' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                      }`}
                    >
                      <SkipForward size={12} /> {entry.skipped ? 'Skipped' : 'Skip'}
                    </button>
                  </div>

                  {!entry.skipped && (
                    <div className="flex items-center gap-3">
                      <button onClick={() => adjustMakes(i, -1)}
                        className="w-11 h-11 bg-gray-800 hover:bg-gray-700 rounded-xl text-2xl font-bold text-gray-300 flex items-center justify-center">
                        −
                      </button>
                      <div className="flex-1 text-center">
                        <input
                          type="number" inputMode="numeric" min="0" max={total}
                          value={entry.shots_made} placeholder="0"
                          onChange={e => setDrillField(i, 'shots_made', e.target.value)}
                          className="w-20 bg-gray-800 border border-gray-700 rounded-xl px-2 py-2 text-2xl font-bold text-center text-white"
                        />
                        <div className="text-xs text-gray-400 mt-1">
                          of {total}
                          {pct != null && (
                            <span className={`ml-1 font-medium ${goalMet ? 'text-green-400' : 'text-orange-400'}`}>
                              · {pct}%{goalMet ? ' ✓' : ''}
                            </span>
                          )}
                        </div>
                      </div>
                      <button onClick={() => adjustMakes(i, 1)}
                        className="w-11 h-11 bg-gray-800 hover:bg-gray-700 rounded-xl text-2xl font-bold text-gray-300 flex items-center justify-center">
                        +
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Fixed save button */}
      <div className="fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-800 p-4">
        <div className="max-w-2xl mx-auto">
          <button
            onClick={handleSave}
            disabled={saving || !selectedPlayer}
            className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 text-base"
          >
            <Save size={18} />
            {saving ? 'Saving...' : 'Save Session'}
          </button>
        </div>
      </div>
    </div>
  )
}