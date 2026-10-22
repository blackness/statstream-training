import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Save, Copy } from 'lucide-react'
import {
  getPlayers, getDrillTemplates,
  createSession, createSessionDrills, duplicateLastSession,
} from '../../lib/basketballClient'

// ── Helpers ───────────────────────────────────────────────────────
const todayStr   = () => new Date().toISOString().split('T')[0]
const nowTimeStr = () => new Date().toTimeString().slice(0, 5)
const fmtShort   = s => s
  ? new Date(s + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  : ''
const toInt   = v => (v === '' || v == null) ? null : parseInt(v)
const toFloat = v => (v === '' || v == null) ? null : parseFloat(v)
const toNum   = v => (v === '' || v == null) ? null : Number(v)
const cap     = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : ''

// ── Shared UI ─────────────────────────────────────────────────────
function ToggleGroup({ options, value, onChange }) {
  return (
    <div className="flex gap-2">
      {options.map(o => (
        <button key={String(o.value)} type="button"
          onClick={() => onChange(value === o.value ? null : o.value)}
          className={`flex-1 py-3.5 rounded-xl text-sm font-semibold transition-colors ${
            value === o.value
              ? 'bg-orange-500 text-white'
              : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
          }`}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

// Integer stepper — for mood, soreness, opening 3s, drill makes/attempts
function Stepper({ value, onChange, min = 0, max = 999 }) {
  const n = toNum(value)
  return (
    <div className="flex items-center gap-3 justify-center">
      <button type="button"
        onClick={() => onChange(n == null ? min : Math.max(min, n - 1))}
        className="w-14 h-14 bg-gray-800 hover:bg-gray-700 rounded-2xl text-3xl font-bold text-gray-300 flex items-center justify-center">
        −
      </button>
      <input
        type="number" inputMode="numeric"
        value={value ?? ''}
        onChange={e => onChange(e.target.value === '' ? null : Number(e.target.value))}
        className="w-24 bg-gray-800 border border-gray-700 rounded-2xl py-3 text-4xl font-black text-center text-white"
        min={min} max={max} />
      <button type="button"
        onClick={() => onChange(n == null ? (min === 0 ? 1 : min) : Math.min(max, n + 1))}
        className="w-14 h-14 bg-gray-800 hover:bg-gray-700 rounded-2xl text-3xl font-bold text-gray-300 flex items-center justify-center">
        +
      </button>
    </div>
  )
}

// Decimal stepper — for sleep hours, weight
function DecimalStepper({ value, onChange, step = 0.5, min = 0, max = 999, placeholder = '0' }) {
  const n = parseFloat(value) || 0
  return (
    <div className="flex items-center gap-3 justify-center">
      <button type="button"
        onClick={() => onChange(String(Math.max(min, parseFloat((n - step).toFixed(1)))))}
        className="w-14 h-14 bg-gray-800 hover:bg-gray-700 rounded-2xl text-3xl font-bold text-gray-300 flex items-center justify-center">
        −
      </button>
      <input
        type="number" inputMode="decimal" step={step} min={min} max={max}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-28 bg-gray-800 border border-gray-700 rounded-2xl py-3 text-4xl font-black text-center text-white placeholder-gray-700" />
      <button type="button"
        onClick={() => onChange(String(Math.min(max, parseFloat((n + step).toFixed(1)))))}
        className="w-14 h-14 bg-gray-800 hover:bg-gray-700 rounded-2xl text-3xl font-bold text-gray-300 flex items-center justify-center">
        +
      </button>
    </div>
  )
}

// Step card wrapper
function StepShell({ badge, badgeColor = 'text-orange-400', title, subtitle, children }) {
  return (
    <div className="space-y-6">
      <div>
        {badge && (
          <p className={`text-xs font-semibold uppercase tracking-wider mb-2 ${badgeColor}`}>
            {badge}
          </p>
        )}
        <h2 className="text-2xl font-bold text-white leading-snug">{title}</h2>
        {subtitle && <p className="text-sm text-gray-400 mt-1.5">{subtitle}</p>}
      </div>
      <div>{children}</div>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────
export default function QuickEntry() {
  const navigate = useNavigate()

  // ── Data ──────────────────────────────────────────────────────
  const [players,    setPlayers]    = useState([])
  const [dataLoaded, setDataLoaded] = useState(false)

  // ── Form state ────────────────────────────────────────────────
  const [player,    setPlayer]    = useState(null)
  const [date,      setDate]      = useState(todayStr())
  const [time,      setTime]      = useState(nowTimeStr())
  const [warmup,    setWarmup]    = useState(null)      // 'full'|'half'|'none'|null
  const [firstShot, setFirstShot] = useState(null)     // true|false|null
  const [threes,    setThrees]    = useState(null)     // 0–20|null
  const [sleepHrs,  setSleepHrs]  = useState('')
  const [sleepQual, setSleepQual] = useState(null)     // 'good'|'fair'|'poor'|null
  const [mood,      setMood]      = useState(null)     // 1–10|null
  const [soreness,  setSoreness]  = useState(null)     // 0–10|null
  const [nutrition, setNutrition] = useState(null)     // 'good'|'fair'|'poor'|null
  const [weight,    setWeight]    = useState('')
  const [duration,  setDuration]  = useState('')
  const [notes,     setNotes]     = useState('')
  const [drills,    setDrills]    = useState([])       // [{template, shots_made, shots_attempted, skipped}]

  // ── Nav ───────────────────────────────────────────────────────
  const [stepIdx, setStepIdx] = useState(0)
  const [saving,  setSaving]  = useState(false)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const [{ data: pData }, { data: tData }] = await Promise.all([
      getPlayers(), getDrillTemplates(),
    ])
    if (pData?.length) { setPlayers(pData); setPlayer(pData[0]) }
    if (tData?.length) {
      setDrills(tData.map(t => ({
        template:        t,
        shots_made:      null,
        shots_attempted: null,
        skipped:         false,
      })))
    }
    setDataLoaded(true)
  }

  const setDrillField = (i, k, v) =>
    setDrills(prev => prev.map((e, idx) => idx === i ? { ...e, [k]: v } : e))

  // ── Build step list ───────────────────────────────────────────
  const steps = useMemo(() => {
    if (!dataLoaded) return []
    const s = []
    if (players.length > 1) s.push('player')
    s.push('datetime')
    s.push('warmup')
    s.push('first_shot')
    s.push('opening_3s')
    s.push('sleep')
    s.push('mood')
    s.push('soreness')
    s.push('nutrition')
    s.push('weight')
    s.push('details')
    drills.forEach((_, i) => s.push(`drill_${i}`))
    s.push('done')
    return s
  }, [dataLoaded, players.length, drills.length])

  const curStep  = steps[stepIdx] ?? ''
  const isDone   = curStep === 'done'
  const progress = steps.length > 1 ? Math.round(((stepIdx + 1) / steps.length) * 100) : 100

  // Step label shown in header
  const STEP_LABELS = {
    player: 'Player', datetime: 'Date & Time', warmup: 'Warmup',
    first_shot: 'First Shot', opening_3s: 'Opening 3s', sleep: 'Sleep',
    mood: 'Mood', soreness: 'Soreness', nutrition: 'Nutrition',
    weight: 'Weight', details: 'Details', done: 'Review',
  }
  function stepLabel(s) {
    if (s.startsWith('drill_')) {
      const di = parseInt(s.split('_')[1])
      return drills[di]?.template.name ?? 'Drill'
    }
    return STEP_LABELS[s] ?? s
  }

  const goNext = () => setStepIdx(i => Math.min(steps.length - 1, i + 1))
  const goBack = () => {
    if (stepIdx > 0) setStepIdx(i => i - 1)
    else navigate('/basketball')
  }

  // ── Save ──────────────────────────────────────────────────────
  async function handleSave() {
    if (!player) return
    setSaving(true)

    const { data: sess, error: sErr } = await createSession({
      player_id:           player.id,
      session_date:        date,
      start_time:          `${date}T${time}:00+00:00`,
      duration_minutes:    toInt(duration),
      notes:               notes || null,
      sleep_hours:         toFloat(sleepHrs),
      sleep_quality:       sleepQual,
      mood:                mood     != null ? parseInt(mood)     : null,
      soreness:            soreness != null ? parseInt(soreness) : null,
      nutrition_quality:   nutrition,
      weight:              toFloat(weight),
      warmup_type:         warmup,
      first_shot_made:     firstShot,
      opening_threes_made: threes   != null ? parseInt(threes)  : null,
    })

    if (sErr || !sess) {
      alert('Error saving session: ' + sErr?.message)
      setSaving(false)
      return
    }

    const drillPayloads = drills
      .filter(e => {
        if (e.skipped) return false
        const mc = e.template.drill_type === 'make_count'
        const ft = e.template.drill_type === 'free_throw'
        if (mc) return e.shots_attempted != null
        if (ft) return (e.shots_attempted || 0) > 0
        return e.shots_made != null
      })
      .map((e, i) => {
        const mc = e.template.drill_type === 'make_count'
        const ft = e.template.drill_type === 'free_throw'
        return {
          session_id:        sess.id,
          drill_template_id: e.template.id,
          shots_made:        mc ? (e.template.required_makes || 0) : (parseInt(e.shots_made)      || 0),
          shots_attempted:   (mc || ft) ? (parseInt(e.shots_attempted) || 0) : (e.template.total_attempts || 0),
          contested:         e.template.contested || false,
          sort_order:        i,
        }
      })

    if (drillPayloads.length > 0) {
      const { error: dErr } = await createSessionDrills(drillPayloads)
      if (dErr) { alert('Error saving drills: ' + dErr?.message); setSaving(false); return }
    }

    setSaving(false)
    navigate('/basketball')
  }

  async function handleRepeatLast() {
    if (!player) return
    setSaving(true)
    const { error } = await duplicateLastSession(player.id, date, `${date}T${time}:00+00:00`)
    setSaving(false)
    if (error) { alert('Error: ' + error.message); return }
    navigate('/basketball')
  }

  // ── Step renderer ─────────────────────────────────────────────
  function renderStep() {

    // ── Player ──────────────────────────────────────────────────
    if (curStep === 'player') return (
      <StepShell badge="Player" title="Who's shooting?">
        <div className="flex flex-col gap-3">
          {players.map(p => (
            <button key={p.id}
              onClick={() => { setPlayer(p); goNext() }}
              className={`py-5 rounded-2xl text-xl font-bold transition-colors ${
                player?.id === p.id
                  ? 'bg-orange-500 text-white'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}>
              {p.name}
            </button>
          ))}
        </div>
      </StepShell>
    )

    // ── Date & Time ──────────────────────────────────────────────
    if (curStep === 'datetime') return (
      <StepShell badge="Date & Time" title="When was this session?">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-400 block mb-1.5">Date</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-3 text-sm text-white" />
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1.5">Start Time</label>
            <input type="time" value={time} onChange={e => setTime(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-3 text-sm text-white" />
          </div>
        </div>
      </StepShell>
    )

    // ── Warmup ───────────────────────────────────────────────────
    if (curStep === 'warmup') return (
      <StepShell badge="Warmup" title="How did you warm up?" subtitle="optional">
        <ToggleGroup
          options={[
            { label: 'Full', value: 'full' },
            { label: 'Half', value: 'half' },
            { label: 'None', value: 'none' },
          ]}
          value={warmup}
          onChange={setWarmup} />
      </StepShell>
    )

    // ── First Shot ───────────────────────────────────────────────
    if (curStep === 'first_shot') return (
      <StepShell badge="First Shot" title="Was the first shot made?" subtitle="optional · tap again to clear">
        <div className="flex gap-3">
          <button onClick={() => setFirstShot(firstShot === true ? null : true)}
            className={`flex-1 py-7 rounded-2xl text-xl font-bold transition-colors ${
              firstShot === true ? 'bg-green-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}>
            ✓ Made
          </button>
          <button onClick={() => setFirstShot(firstShot === false ? null : false)}
            className={`flex-1 py-7 rounded-2xl text-xl font-bold transition-colors ${
              firstShot === false ? 'bg-red-700 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}>
            ✗ Missed
          </button>
        </div>
      </StepShell>
    )

    // ── Opening 3s ───────────────────────────────────────────────
    if (curStep === 'opening_3s') {
      const pct = threes != null ? Math.round(threes / 20 * 100) : null
      return (
        <StepShell badge="Opening 3-Pointers" title="How many 3s did you make?" subtitle="out of 20 · optional">
          <div className="text-center space-y-5">
            <Stepper value={threes} onChange={setThrees} min={0} max={20} />
            <p className="text-xs text-gray-500">of 20</p>
            <div className="h-10 flex items-center justify-center">
              {pct != null
                ? <span className={`text-4xl font-black ${pct >= 50 ? 'text-green-400' : 'text-orange-400'}`}>{pct}%</span>
                : <span className="text-gray-600 text-sm">tap + to enter</span>}
            </div>
          </div>
        </StepShell>
      )
    }

    // ── Sleep ─────────────────────────────────────────────────────
    if (curStep === 'sleep') return (
      <StepShell badge="Sleep" title="How did you sleep?" subtitle="optional">
        <div className="space-y-6">
          <div className="text-center">
            <p className="text-xs text-gray-400 mb-3">Hours</p>
            <DecimalStepper
              value={sleepHrs} onChange={setSleepHrs}
              step={0.5} min={0} max={24} placeholder="0" />
            {sleepHrs !== '' && (
              <p className="text-gray-400 text-sm mt-2">{sleepHrs} hours</p>
            )}
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-2">Quality</p>
            <ToggleGroup
              options={[
                { label: 'Good', value: 'good' },
                { label: 'Fair', value: 'fair' },
                { label: 'Poor', value: 'poor' },
              ]}
              value={sleepQual}
              onChange={setSleepQual} />
          </div>
        </div>
      </StepShell>
    )

    // ── Mood ──────────────────────────────────────────────────────
    if (curStep === 'mood') return (
      <StepShell badge="Mood" title="How's your mood?" subtitle="1 = terrible · 10 = excellent · optional">
        <div className="text-center space-y-5">
          <Stepper value={mood} onChange={setMood} min={1} max={10} />
          <div className="h-10 flex items-center justify-center">
            {mood != null
              ? <span className="text-4xl font-black text-orange-400">{mood} / 10</span>
              : <span className="text-gray-600 text-sm">tap + to enter</span>}
          </div>
        </div>
      </StepShell>
    )

    // ── Soreness ──────────────────────────────────────────────────
    if (curStep === 'soreness') return (
      <StepShell badge="Soreness" title="Any soreness?" subtitle="0 = none · 10 = max · optional">
        <div className="text-center space-y-5">
          <Stepper value={soreness} onChange={setSoreness} min={0} max={10} />
          <div className="h-10 flex items-center justify-center">
            {soreness != null
              ? <span className={`text-4xl font-black ${
                  soreness <= 3 ? 'text-green-400' : soreness <= 6 ? 'text-orange-400' : 'text-red-400'
                }`}>{soreness} / 10</span>
              : <span className="text-gray-600 text-sm">tap + to enter</span>}
          </div>
        </div>
      </StepShell>
    )

    // ── Nutrition ─────────────────────────────────────────────────
    if (curStep === 'nutrition') return (
      <StepShell badge="Nutrition" title="How was your nutrition?" subtitle="optional">
        <ToggleGroup
          options={[
            { label: 'Good', value: 'good' },
            { label: 'Fair', value: 'fair' },
            { label: 'Poor', value: 'poor' },
          ]}
          value={nutrition}
          onChange={setNutrition} />
      </StepShell>
    )

    // ── Weight ────────────────────────────────────────────────────
    if (curStep === 'weight') return (
      <StepShell badge="Weight" title="What's your weight today?" subtitle="optional · lb">
        <div className="text-center space-y-3">
          <DecimalStepper
            value={weight} onChange={setWeight}
            step={0.5} min={0} placeholder="160" />
          {weight !== '' && (
            <p className="text-gray-400 text-sm">{weight} lb</p>
          )}
        </div>
      </StepShell>
    )

    // ── Details (duration + notes) ────────────────────────────────
    if (curStep === 'details') return (
      <StepShell badge="Details" title="Anything else to add?" subtitle="optional">
        <div className="space-y-4">
          <div>
            <label className="text-xs text-gray-400 block mb-1.5">Duration</label>
            <div className="flex items-center gap-2">
              <input type="number" inputMode="numeric" min="0"
                value={duration} onChange={e => setDuration(e.target.value)}
                placeholder="90"
                className="w-28 bg-gray-800 border border-gray-700 rounded-xl px-3 py-3 text-2xl font-bold text-white placeholder-gray-700" />
              <span className="text-gray-400 text-sm">min</span>
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1.5">Notes</label>
            <textarea rows={4}
              value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Anything to note about this session..."
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-3 text-sm text-white resize-none placeholder-gray-600" />
          </div>
        </div>
      </StepShell>
    )

    // ── Drills ────────────────────────────────────────────────────
    if (curStep.startsWith('drill_')) {
      const di    = parseInt(curStep.split('_')[1])
      const entry = drills[di]
      const tmpl  = entry.template
      const mc    = tmpl.drill_type === 'make_count'
      const ft    = tmpl.drill_type === 'free_throw'
      const at    = !mc && !ft
      const goal  = tmpl.goal_percent

      let pct = null
      if (at  && entry.shots_made      != null) pct = tmpl.total_attempts > 0 ? Math.round((entry.shots_made / tmpl.total_attempts) * 100) : null
      if (mc  && entry.shots_attempted  > 0)    pct = Math.round(((tmpl.required_makes || 0) / entry.shots_attempted) * 100)
      if (ft  && entry.shots_attempted  > 0)    pct = Math.round(((entry.shots_made || 0) / entry.shots_attempted) * 100)

      const goalMet      = pct != null && goal && pct >= goal
      const pctColor     = goalMet ? 'text-green-400' : 'text-orange-400'
      const accentColor  = mc ? 'text-purple-400' : ft ? 'text-blue-400' : 'text-orange-400'
      const borderColor  = mc ? 'border-purple-900' : ft ? 'border-blue-900' : 'border-gray-700'

      return (
        <div className="space-y-6">

          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className={`text-xs font-semibold uppercase tracking-wider mb-2 ${accentColor}`}>
                Drill {di + 1} of {drills.length}
              </p>
              <h2 className="text-2xl font-bold text-white leading-snug truncate">{tmpl.name}</h2>
              <p className="text-sm text-gray-400 mt-1.5">
                {mc && <span className="text-purple-400">Make {tmpl.required_makes} · enter attempts</span>}
                {ft && <span className="text-blue-400">Enter makes + attempts</span>}
                {at && <span>{tmpl.total_attempts} attempts</span>}
                {goal && <span className="text-gray-500"> · goal {goal}%</span>}
              </p>
            </div>
            <button
              onClick={() => setDrillField(di, 'skipped', !entry.skipped)}
              className={`flex-shrink-0 text-xs px-3 py-1.5 rounded-lg transition-colors ${
                entry.skipped
                  ? 'bg-orange-500/20 text-orange-400'
                  : 'bg-gray-800 text-gray-500 hover:text-gray-300 hover:bg-gray-700'
              }`}>
              {entry.skipped ? 'Undo skip' : 'Skip'}
            </button>
          </div>

          {/* Input */}
          {entry.skipped ? (
            <div className={`bg-gray-800 rounded-2xl p-10 text-center border ${borderColor} opacity-40`}>
              <p className="text-gray-400">Drill skipped</p>
            </div>
          ) : ft ? (
            <div className="space-y-6">
              <div className="text-center">
                <p className="text-xs text-blue-400 font-medium mb-3">Makes</p>
                <Stepper value={entry.shots_made}
                  onChange={v => setDrillField(di, 'shots_made', v)} min={0} />
              </div>
              <div className="text-center">
                <p className="text-xs text-blue-400 font-medium mb-3">Attempts</p>
                <Stepper value={entry.shots_attempted}
                  onChange={v => setDrillField(di, 'shots_attempted', v)} min={0} />
              </div>
              {pct != null && (
                <p className={`text-center text-5xl font-black ${pctColor}`}>
                  {pct}%{goalMet ? ' ✓' : ''}
                </p>
              )}
            </div>
          ) : mc ? (
            <div className="text-center space-y-4">
              <p className="text-xs text-purple-400 font-medium">Attempts to make {tmpl.required_makes}</p>
              <Stepper value={entry.shots_attempted}
                onChange={v => setDrillField(di, 'shots_attempted', v)} min={0} />
              {pct != null && (
                <p className={`text-5xl font-black ${pctColor}`}>{pct}% eff.{goalMet ? ' ✓' : ''}</p>
              )}
            </div>
          ) : (
            <div className="text-center space-y-3">
              <p className="text-xs text-gray-400 font-medium">Makes</p>
              <Stepper value={entry.shots_made}
                onChange={v => setDrillField(di, 'shots_made', v)}
                min={0} max={tmpl.total_attempts} />
              <p className="text-sm text-gray-500">of {tmpl.total_attempts}</p>
              {pct != null && (
                <p className={`text-5xl font-black ${pctColor}`}>{pct}%{goalMet ? ' ✓' : ''}</p>
              )}
            </div>
          )}
        </div>
      )
    }

    // ── Done / Summary ────────────────────────────────────────────
    if (curStep === 'done') {
      const doneDrills = drills.filter(e =>
        !e.skipped && (e.shots_made != null || e.shots_attempted != null)
      ).length

      const rows = [
        { label: 'Player',     value: player?.name },
        { label: 'Date',       value: fmtShort(date) },
        warmup      &&    { label: 'Warmup',     value: cap(warmup) },
        firstShot != null && { label: 'First Shot', value: firstShot ? '✓ Made' : '✗ Missed' },
        threes != null && { label: 'Opening 3s', value: `${threes}/20 · ${Math.round(threes / 20 * 100)}%` },
        sleepHrs    &&    { label: 'Sleep',      value: `${sleepHrs}h${sleepQual ? ` · ${sleepQual}` : ''}` },
        mood     != null && { label: 'Mood',      value: `${mood}/10` },
        soreness != null && { label: 'Soreness',  value: `${soreness}/10` },
        nutrition && { label: 'Nutrition',  value: cap(nutrition) },
        weight    && { label: 'Weight',     value: `${weight} lb` },
        duration  && { label: 'Duration',   value: `${duration} min` },
        drills.length > 0 && { label: 'Drills', value: `${doneDrills} / ${drills.length} completed` },
      ].filter(Boolean)

      return (
        <div className="space-y-5">
          <div>
            <p className="text-xs font-semibold text-green-400 uppercase tracking-wider mb-2">Ready to save</p>
            <h2 className="text-2xl font-bold text-white">Session Summary</h2>
          </div>

          <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
            {rows.map((row, i) => (
              <div key={i} className="flex justify-between items-center px-4 py-3 border-b border-gray-800 last:border-0">
                <span className="text-sm text-gray-400">{row.label}</span>
                <span className="text-sm text-white font-medium">{row.value}</span>
              </div>
            ))}
          </div>

          {notes && (
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
              <p className="text-xs text-gray-500 mb-1">Notes</p>
              <p className="text-sm text-gray-200 whitespace-pre-wrap">{notes}</p>
            </div>
          )}

          <button
            onClick={handleSave}
            disabled={saving || !player}
            className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 text-base">
            <Save size={20} />
            {saving ? 'Saving...' : 'Save Session'}
          </button>
        </div>
      )
    }

    return null
  }

  // ── Loading ───────────────────────────────────────────────────
  if (!dataLoaded) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <p className="text-gray-500">Loading...</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-950 text-white pb-28">

      {/* Header + progress bar */}
      <div className="bg-gray-900 border-b border-gray-800 px-4 py-4 sticky top-0 z-10">
        <div className="flex items-center gap-3 max-w-2xl mx-auto">
          <button onClick={goBack} className="text-gray-400 hover:text-white flex-shrink-0">
            <ChevronLeft size={20} />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-2">
              <div className="min-w-0">
                <span className="text-xs text-gray-500 mr-2">{stepIdx + 1}/{steps.length}</span>
                <span className="text-xs font-medium text-gray-300 truncate">
                  {stepLabel(curStep)}
                </span>
              </div>
              {stepIdx === 0 && (
                <button onClick={handleRepeatLast} disabled={saving}
                  className="flex items-center gap-1 text-xs bg-gray-800 hover:bg-gray-700 px-2.5 py-1.5 rounded-lg text-gray-400 disabled:opacity-50 flex-shrink-0 ml-2">
                  <Copy size={12} /> Repeat Last
                </button>
              )}
            </div>
            <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-orange-500 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }} />
            </div>
          </div>
        </div>
      </div>

      {/* Step content */}
      <div className="max-w-2xl mx-auto px-4 pt-8 pb-8">
        {renderStep()}
      </div>

      {/* Next button — hidden on done step (save button is inline there) */}
      {!isDone && (
        <div className="fixed bottom-0 left-0 right-0 bg-gray-900/95 backdrop-blur-sm border-t border-gray-800 p-4">
          <div className="max-w-2xl mx-auto">
            <button onClick={goNext}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white py-3.5 rounded-2xl font-bold flex items-center justify-center gap-2 text-base">
              {stepIdx === steps.length - 2 ? 'Review Session' : 'Next'}
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}