import { useState } from 'react'
import { ChevronLeft, ChevronRight, X, SkipForward, Save } from 'lucide-react'

// ── ToggleGroup ───────────────────────────────────────────────────
function ToggleGroup({ options, value, onChange, size = 'md' }) {
  return (
    <div className="flex gap-1.5">
      {options.map(opt => (
        <button key={String(opt.value)} type="button"
          onClick={() => onChange(value === opt.value ? null : opt.value)}
          className={`flex-1 ${size === 'lg' ? 'py-3.5' : 'py-2.5'} rounded-xl text-sm font-semibold transition-colors ${
            value === opt.value
              ? 'bg-orange-500 text-white'
              : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
          }`}>
          {opt.label}
        </button>
      ))}
    </div>
  )
}

// ── BigStepper — full-width drill input ───────────────────────────
function BigStepper({ value, onChange, min = 0, max = 999 }) {
  const cur = (value === '' || value == null) ? null : Number(value)
  return (
    <div className="flex items-center justify-center gap-4">
      <button type="button"
        onClick={() => onChange(cur === null ? min : Math.max(min, cur - 1))}
        className="w-16 h-16 bg-gray-800 hover:bg-gray-700 active:scale-95 rounded-2xl text-3xl font-bold text-gray-300 flex items-center justify-center transition-transform">
        −
      </button>
      <input type="number" inputMode="numeric"
        value={value ?? ''} placeholder="0"
        onChange={e => onChange(e.target.value === '' ? '' : Number(e.target.value))}
        className="w-24 bg-gray-800 border border-gray-700 rounded-2xl py-3 text-4xl font-black text-center text-white focus:outline-none focus:border-orange-500"
        min={min} max={max} />
      <button type="button"
        onClick={() => onChange(cur === null ? min : Math.min(max, cur + 1))}
        className="w-16 h-16 bg-gray-800 hover:bg-gray-700 active:scale-95 rounded-2xl text-3xl font-bold text-gray-300 flex items-center justify-center transition-transform">
        +
      </button>
    </div>
  )
}

// ── MedStepper — free throw 2-column ─────────────────────────────
function MedStepper({ value, onChange, min = 0, max = 999 }) {
  const cur = (value === '' || value == null) ? null : Number(value)
  return (
    <div className="flex items-center gap-1.5">
      <button type="button"
        onClick={() => onChange(cur === null ? min : Math.max(min, cur - 1))}
        className="w-10 h-10 bg-gray-800 hover:bg-gray-700 rounded-xl text-xl font-bold text-gray-300 flex items-center justify-center">
        −
      </button>
      <input type="number" inputMode="numeric"
        value={value ?? ''} placeholder="0"
        onChange={e => onChange(e.target.value === '' ? '' : Number(e.target.value))}
        className="w-14 bg-gray-800 border border-gray-700 rounded-xl py-2 text-2xl font-black text-center text-white focus:outline-none focus:border-orange-500"
        min={min} max={max} />
      <button type="button"
        onClick={() => onChange(cur === null ? min : Math.min(max, cur + 1))}
        className="w-10 h-10 bg-gray-800 hover:bg-gray-700 rounded-xl text-xl font-bold text-gray-300 flex items-center justify-center">
        +
      </button>
    </div>
  )
}

// ── SmallStepper — wellness metrics ──────────────────────────────
function SmallStepper({ value, onChange, min = 0, max = 99 }) {
  const cur = (value === '' || value == null) ? null : Number(value)
  return (
    <div className="flex items-center gap-1.5">
      <button type="button"
        onClick={() => onChange(cur === null ? min : Math.max(min, cur - 1))}
        className="w-11 h-11 bg-gray-800 hover:bg-gray-700 rounded-xl text-xl font-bold text-gray-300 flex items-center justify-center">
        −
      </button>
      <input type="number" inputMode="numeric"
        value={value ?? ''} placeholder="—"
        onChange={e => onChange(e.target.value === '' ? '' : Number(e.target.value))}
        className="w-14 bg-gray-800 border border-gray-700 rounded-xl py-2 text-lg font-bold text-center text-white focus:outline-none focus:border-orange-500"
        min={min} max={max} />
      <button type="button"
        onClick={() => onChange(cur === null ? min : Math.min(max, cur + 1))}
        className="w-11 h-11 bg-gray-800 hover:bg-gray-700 rounded-xl text-xl font-bold text-gray-300 flex items-center justify-center">
        +
      </button>
    </div>
  )
}

// ── Step 1: Session ───────────────────────────────────────────────
function StepSession({ draft, onChange }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-gray-400 mb-1.5">Date</label>
          <input type="date"
            value={draft.session_date ?? ''}
            onChange={e => onChange('session_date', e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-3 text-sm text-white focus:outline-none focus:border-orange-500" />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1.5">Start Time</label>
          <input type="time"
            value={draft.start_time_input ?? ''}
            onChange={e => onChange('start_time_input', e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-3 text-sm text-white focus:outline-none focus:border-orange-500" />
        </div>
      </div>

      <div>
        <label className="block text-xs text-gray-400 mb-1.5">Duration</label>
        <div className="flex items-center gap-2">
          <input type="number" inputMode="numeric" min="0"
            value={draft.duration_minutes ?? ''}
            onChange={e => onChange('duration_minutes', e.target.value === '' ? '' : parseInt(e.target.value))}
            className="w-24 bg-gray-800 border border-gray-700 rounded-xl px-3 py-3 text-sm text-white text-center focus:outline-none focus:border-orange-500" />
          <span className="text-sm text-gray-400">min</span>
        </div>
      </div>

      <div>
        <label className="block text-xs text-gray-400 mb-2">Warmup</label>
        <ToggleGroup size="lg"
          options={[
            { label: '✓ Full', value: 'full' },
            { label: '~ Half', value: 'half' },
            { label: '✗ None', value: 'none' },
          ]}
          value={draft.warmup_type}
          onChange={v => onChange('warmup_type', v)} />
      </div>
    </div>
  )
}

// ── Step 2: Opening ───────────────────────────────────────────────
function StepOpening({ draft, onChange }) {
  const fsVal = draft.first_shot_made === true ? 'made'
    : draft.first_shot_made === false ? 'missed'
    : null

  return (
    <div className="h-full flex flex-col justify-center gap-10">
      <div>
        <p className="text-center text-xs text-gray-400 uppercase tracking-wider mb-3">
          First Shot of Session
        </p>
        <div className="flex gap-3">
          <button type="button"
            onClick={() => onChange('first_shot_made', fsVal === 'made' ? null : true)}
            className={`flex-1 py-5 rounded-2xl text-lg font-bold transition-colors ${
              fsVal === 'made' ? 'bg-green-500 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}>
            ✓ Made
          </button>
          <button type="button"
            onClick={() => onChange('first_shot_made', fsVal === 'missed' ? null : false)}
            className={`flex-1 py-5 rounded-2xl text-lg font-bold transition-colors ${
              fsVal === 'missed' ? 'bg-red-500 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}>
            ✗ Missed
          </button>
        </div>
      </div>

      <div className="text-center">
        <p className="text-xs text-gray-400 uppercase tracking-wider mb-5">Opening 3s</p>
        <BigStepper
          value={draft.opening_threes_made}
          onChange={v => onChange('opening_threes_made', v)}
          min={0} max={20} />
        <p className="text-xs text-gray-500 mt-3">out of 20</p>
        {draft.opening_threes_made !== '' && draft.opening_threes_made != null && (
          <p className="text-sm font-bold text-orange-400 mt-1.5">
            {Math.round((Number(draft.opening_threes_made) / 20) * 100)}%
          </p>
        )}
      </div>
    </div>
  )
}

// ── Step 3: Wellness ──────────────────────────────────────────────
function StepWellness({ draft, onChange }) {
  return (
    <div className="space-y-3">
      {/* Sleep */}
      <div className="bg-gray-800/50 rounded-2xl p-4">
        <p className="text-xs text-gray-400 uppercase tracking-wider mb-3">Sleep</p>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 flex-shrink-0">
            <input type="number" inputMode="decimal" min="0" max="24" step="0.5"
              value={draft.sleep_hours ?? ''}
              onChange={e => onChange('sleep_hours', e.target.value === '' ? '' : parseFloat(e.target.value))}
              className="w-16 bg-gray-700 border border-gray-600 rounded-lg px-2 py-2 text-base font-bold text-white text-center focus:outline-none focus:border-orange-500" />
            <span className="text-xs text-gray-400">hrs</span>
          </div>
          <div className="flex-1">
            <ToggleGroup
              options={[
                { label: 'Good', value: 'good' },
                { label: 'Fair', value: 'fair' },
                { label: 'Poor', value: 'poor' },
              ]}
              value={draft.sleep_quality}
              onChange={v => onChange('sleep_quality', v)} />
          </div>
        </div>
      </div>

      {/* Mood + Soreness */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-gray-800/50 rounded-2xl p-4">
          <p className="text-xs text-gray-400 mb-2.5">Mood <span className="text-gray-600">/ 10</span></p>
          <SmallStepper value={draft.mood} onChange={v => onChange('mood', v)} min={1} max={10} />
        </div>
        <div className="bg-gray-800/50 rounded-2xl p-4">
          <p className="text-xs text-gray-400 mb-2.5">Soreness <span className="text-gray-600">/ 10</span></p>
          <SmallStepper value={draft.soreness} onChange={v => onChange('soreness', v)} min={0} max={10} />
        </div>
      </div>

      {/* Nutrition + Weight */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-gray-800/50 rounded-2xl p-4">
          <p className="text-xs text-gray-400 uppercase tracking-wider mb-2.5">Nutrition</p>
          <ToggleGroup
            options={[
              { label: 'Good', value: 'good' },
              { label: 'Fair', value: 'fair' },
              { label: 'Poor', value: 'poor' },
            ]}
            value={draft.nutrition_quality}
            onChange={v => onChange('nutrition_quality', v)} />
        </div>
        <div className="bg-gray-800/50 rounded-2xl p-4">
          <p className="text-xs text-gray-400 mb-2.5">Weight</p>
          <div className="flex items-center gap-1.5">
            <input type="number" inputMode="decimal" min="0" step="0.1"
              value={draft.weight ?? ''}
              onChange={e => onChange('weight', e.target.value === '' ? '' : parseFloat(e.target.value))}
              className="w-20 bg-gray-700 border border-gray-600 rounded-lg px-2 py-2 text-base font-bold text-white text-center focus:outline-none focus:border-orange-500" />
            <span className="text-xs text-gray-400">lb</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Step 4: Notes ─────────────────────────────────────────────────
function StepNotes({ draft, onChange }) {
  return (
    <div className="space-y-2">
      <textarea
        value={draft.notes ?? ''}
        onChange={e => onChange('notes', e.target.value)}
        placeholder="How did the session feel? Anything to note..."
        rows={7}
        className="w-full bg-gray-800 border border-gray-700 rounded-2xl px-4 py-4 text-sm text-white resize-none placeholder-gray-600 focus:outline-none focus:border-orange-500" />
      <p className="text-xs text-gray-600 text-center">Optional — tap Next to continue</p>
    </div>
  )
}

// ── Steps 5–N: Drills ─────────────────────────────────────────────
function StepDrill({ entry, onSkip, onFieldChange }) {
  const isMakeCount   = entry.template.drill_type === 'make_count'
  const isFreeThrow   = entry.template.drill_type === 'free_throw'
  const total         = entry.template.total_attempts
  const requiredMakes = entry.template.required_makes || 0
  const goal          = entry.template.goal_percent

  let pct = null
  if (isFreeThrow) {
    const m = parseInt(entry.shots_made)     || 0
    const a = parseInt(entry.shots_attempted) || 0
    if (a > 0) pct = Math.round((m / a) * 100)
  } else if (isMakeCount) {
    const a = parseInt(entry.shots_attempted) || 0
    if (a > 0) pct = Math.round((requiredMakes / a) * 100)
  } else {
    const m = parseInt(entry.shots_made) || 0
    if (total > 0 && entry.shots_made !== '') pct = Math.round((m / total) * 100)
  }

  const goalMet  = pct != null && goal && pct >= goal
  const pctColor = goalMet ? 'text-green-400' : (pct != null && pct >= 60) ? 'text-orange-400' : 'text-red-400'

  const typeStyle = isMakeCount
    ? 'text-purple-400 bg-purple-900/30 border border-purple-800'
    : isFreeThrow
    ? 'text-blue-400 bg-blue-900/30 border border-blue-800'
    : 'text-gray-400 bg-gray-800 border border-gray-700'

  const typeLabel = isMakeCount
    ? `Make ${requiredMakes}`
    : isFreeThrow
    ? 'Free throws'
    : `${total} attempts`

  return (
    <div className="h-full flex flex-col">

      {/* Drill name + badges */}
      <div className="flex-shrink-0 text-center space-y-2">
        <h2 className="text-2xl font-bold text-white leading-tight">{entry.template.name}</h2>
        <div className="flex items-center justify-center gap-2 flex-wrap">
          <span className={`text-xs px-3 py-1 rounded-full font-medium ${typeStyle}`}>{typeLabel}</span>
          {goal && (
            <span className="text-xs px-3 py-1 rounded-full bg-gray-800 border border-gray-700 text-gray-400">
              goal {goal}%
            </span>
          )}
        </div>
      </div>

      {/* Input area */}
      <div className="flex-1 flex flex-col items-center justify-center gap-6">
        {entry.skipped ? (
          <div className="text-center space-y-4">
            <p className="text-gray-500 text-base">Marked as skipped</p>
            <button type="button" onClick={onSkip}
              className="px-8 py-3.5 bg-gray-800 hover:bg-gray-700 rounded-xl text-sm text-white font-medium transition-colors">
              Undo — enter data
            </button>
          </div>
        ) : isFreeThrow ? (
          <>
            <div className="flex items-start justify-center gap-10">
              <div className="text-center">
                <p className="text-xs text-gray-400 uppercase tracking-wider mb-3">Makes</p>
                <MedStepper
                  value={entry.shots_made}
                  onChange={v => onFieldChange('shots_made', String(v))}
                  min={0} max={999} />
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-400 uppercase tracking-wider mb-3">Attempts</p>
                <MedStepper
                  value={entry.shots_attempted}
                  onChange={v => onFieldChange('shots_attempted', String(v))}
                  min={0} max={999} />
              </div>
            </div>
            {pct != null && (
              <p className={`text-4xl font-black ${pctColor}`}>
                {pct}%{goalMet ? ' ✓' : ''}
              </p>
            )}
          </>
        ) : (
          <>
            <BigStepper
              value={isMakeCount ? entry.shots_attempted : entry.shots_made}
              onChange={v => onFieldChange(isMakeCount ? 'shots_attempted' : 'shots_made', String(v))}
              min={0} max={isMakeCount ? 9999 : total} />
            {pct != null && (
              <div className="text-center">
                <p className={`text-4xl font-black ${pctColor}`}>
                  {pct}%{goalMet ? ' ✓' : ''}
                </p>
                {isMakeCount && (
                  <p className="text-xs text-gray-400 mt-1">efficiency</p>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Skip */}
      {!entry.skipped && (
        <div className="flex-shrink-0 flex justify-center py-2">
          <button type="button" onClick={onSkip}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-300 py-3 px-6 rounded-xl hover:bg-gray-800 transition-colors">
            <SkipForward size={14} />
            Skip this drill
          </button>
        </div>
      )}
    </div>
  )
}

// ── Wizard shell ──────────────────────────────────────────────────
export default function SessionEditWizard({
  sessionDraft,
  drillEntries,
  onDraftChange,
  onDrillFieldChange,
  onDrillSkip,
  onSave,
  onCancel,
  saving,
  error,
}) {
  const [step, setStep] = useState(0)

  const INFO_COUNT  = 4
  const totalSteps  = INFO_COUNT + drillEntries.length
  const isDrillStep = step >= INFO_COUNT
  const drillIndex  = isDrillStep ? step - INFO_COUNT : null
  const currentDrill = drillIndex != null ? drillEntries[drillIndex] : null
  const isLast      = step === totalSteps - 1

  const headingTitle = isDrillStep && currentDrill
    ? currentDrill.template.name
    : ['Session', 'Opening', 'Wellness', 'Notes'][step]

  const headingSub = isDrillStep
    ? `Drill ${drillIndex + 1} of ${drillEntries.length}`
    : `Step ${step + 1} of ${totalSteps}`

  const handleNext = () => isLast ? onSave() : setStep(s => s + 1)
  const handleBack = () => step === 0 ? onCancel() : setStep(s => s - 1)

  return (
    <div className="fixed inset-0 bg-gray-950 text-white z-50 flex flex-col">

      {/* Header + progress */}
      <div className="flex-shrink-0 bg-gray-900 border-b border-gray-800 px-4 pt-4 pb-3">
        <div className="flex items-center gap-3 max-w-2xl mx-auto">
          <button type="button" onClick={handleBack}
            className="w-8 text-gray-400 hover:text-white flex items-center">
            <ChevronLeft size={20} />
          </button>
          <div className="flex-1 text-center min-w-0">
            <p className="text-sm font-semibold text-white truncate">{headingTitle}</p>
            <p className="text-xs text-gray-500">{headingSub}</p>
          </div>
          <button type="button" onClick={onCancel}
            className="w-8 text-gray-500 hover:text-white flex items-center justify-end">
            <X size={18} />
          </button>
        </div>
        <div className="max-w-2xl mx-auto mt-3">
          <div className="h-1 bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-orange-500 rounded-full transition-all duration-300"
              style={{ width: `${Math.round(((step + 1) / totalSteps) * 100)}%` }} />
          </div>
        </div>
      </div>

      {/* Content — overflow-hidden keeps it scroll-free */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <div className="h-full max-w-2xl mx-auto px-4 py-5">
          {step === 0 && <StepSession  draft={sessionDraft} onChange={onDraftChange} />}
          {step === 1 && <StepOpening  draft={sessionDraft} onChange={onDraftChange} />}
          {step === 2 && <StepWellness draft={sessionDraft} onChange={onDraftChange} />}
          {step === 3 && <StepNotes    draft={sessionDraft} onChange={onDraftChange} />}
          {isDrillStep && currentDrill && (
            <StepDrill
              key={currentDrill.template.id}
              entry={currentDrill}
              onSkip={() => onDrillSkip(drillIndex)}
              onFieldChange={(field, val) => onDrillFieldChange(drillIndex, field, val)} />
          )}
        </div>
      </div>

      {/* Error strip */}
      {error && (
        <div className="flex-shrink-0 bg-red-900/80 border-t border-red-800 px-4 py-2">
          <p className="text-xs text-red-200 text-center max-w-2xl mx-auto">{error}</p>
        </div>
      )}

      {/* Footer nav */}
      <div className="flex-shrink-0 bg-gray-900 border-t border-gray-800 px-4 py-4">
        <div className="flex gap-3 max-w-2xl mx-auto">
          {step > 0 && (
            <button type="button" onClick={handleBack}
              className="flex items-center gap-1 px-5 py-3.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium flex-shrink-0 transition-colors">
              <ChevronLeft size={16} /> Back
            </button>
          )}
          <button type="button" onClick={handleNext} disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-sm font-bold transition-colors">
            {isLast
              ? saving ? 'Saving…' : <><Save size={16} /> Save Session</>
              : <>Next <ChevronRight size={16} /></>}
          </button>
        </div>
      </div>
    </div>
  )
}