import { useState, useEffect, useRef } from 'react'
import { useDrill } from '../../hooks/useDrill'
import ScoreBar from './ScoreBar'

export default function DrillRunner({ drill, spots, playerId, onComplete }) {
  const [mode, setMode] = useState('by25')
  const [input, setInput] = useState('')
  const [roundInputs, setRoundInputs] = useState(Array(spots.length).fill(''))
  const [activeRoundSpot, setActiveRoundSpot] = useState(0)
  const [error, setError] = useState('')
  const inputRef = useRef(null)

  const {
    isQuota, round, totalRounds,
    currentSpot, spotIndex, totalSpots,
    repsPerSpot, quotaPerSpot, totalMinShots,
    makes, shotsTaken, overQuota,
    completed, passed,
    submitSpot, submitRound, submitRoundTotal,
    submitQuotaSpot, submitQuotaRound, submitQuotaRoundTotal,
  } = useDrill(drill, spots, playerId)

  const spotQuota = currentSpot?.make_quota ?? quotaPerSpot
  const roundQuota = spots.reduce((sum, s) => sum + (s.make_quota ?? quotaPerSpot), 0)
  const maxBy25 = totalSpots * repsPerSpot

  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 50) }, [spotIndex, round, mode, activeRoundSpot])
  useEffect(() => { setInput(''); setRoundInputs(Array(spots.length).fill('')); setActiveRoundSpot(0); setError('') }, [mode])

  function handleBy5KeyDown(e) {
    if (e.key !== 'Enter') return
    const val = parseInt(input)
    if (isQuota) {
      if (isNaN(val) || val < spotQuota) { setError(`Must be at least ${spotQuota}`); return }
    } else {
      if (isNaN(val) || val < 0 || val > repsPerSpot) { setError(`Enter 0–${repsPerSpot}`); return }
    }
    setError(''); setInput('')
    isQuota ? submitQuotaSpot(val) : submitSpot(val)
  }

  function handleRoundInput(i, val) {
    const updated = [...roundInputs]; updated[i] = val; setRoundInputs(updated)
  }

  function handleRoundKeyDown(e, i) {
    if (e.key !== 'Enter' && e.key !== 'Tab') return
    e.preventDefault()
    const val = parseInt(roundInputs[i])
    const quota = spots[i]?.make_quota ?? quotaPerSpot
    if (isQuota) {
      if (isNaN(val) || val < quota) { setError(`Must be at least ${quota} for ${spots[i].label}`); return }
    } else {
      if (isNaN(val) || val < 0 || val > repsPerSpot) { setError(`Enter 0–${repsPerSpot}`); return }
    }
    setError('')
    if (i < spots.length - 1) {
      setActiveRoundSpot(i + 1)
    } else {
      const values = roundInputs.map((v, idx) => idx === i ? val : parseInt(v))
      if (values.some(isNaN)) { setError('Fill in all spots'); return }
      setRoundInputs(Array(spots.length).fill('')); setActiveRoundSpot(0)
      isQuota ? submitQuotaRound(values) : submitRound(values)
    }
  }

  function handleBy25KeyDown(e) {
    if (e.key !== 'Enter') return
    const val = parseInt(input)
    if (isQuota) {
      if (isNaN(val) || val < roundQuota) { setError(`Must be at least ${roundQuota}`); return }
    } else {
      if (isNaN(val) || val < 0 || val > maxBy25) { setError(`Enter 0–${maxBy25}`); return }
    }
    setError(''); setInput('')
    isQuota ? submitQuotaRoundTotal(val) : submitRoundTotal(val)
  }

  if (completed) {
    const pct = shotsTaken > 0 ? Math.round((makes / shotsTaken) * 100) : 0
    return (
      <div style={{ minHeight: '100dvh', background: '#030712', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, gap: 20, textAlign: 'center', boxSizing: 'border-box' }}>
        <div style={{ fontSize: 72 }}>{isQuota ? (overQuota === 0 ? '🏆' : '💪') : passed ? '🏆' : '💪'}</div>
        <div style={{ fontSize: 32, fontWeight: 800, color: '#fff' }}>
          {passed || isQuota ? 'Drill Complete!' : 'Keep Working'}
        </div>
        {isQuota ? (
          <>
            <div style={{ fontSize: 56, fontWeight: 800, color: overQuota === 0 ? '#4ade80' : '#f97316' }}>+{overQuota}</div>
            <div style={{ fontSize: 18, color: '#9ca3af' }}>shots over quota</div>
            <div style={{ fontSize: 14, color: '#6b7280', marginTop: 4 }}>{makes} makes · {shotsTaken} shots · {pct}%</div>
          </>
        ) : (
          <>
            <div style={{ fontSize: 56, fontWeight: 800, color: passed ? '#4ade80' : '#f97316' }}>
              {makes}<span style={{ fontSize: 28, color: '#6b7280' }}>/{totalMinShots}</span>
            </div>
            <div style={{ fontSize: 18, color: '#9ca3af' }}>{pct}% · Target was {drill.make_target}</div>
          </>
        )}
        <button onClick={onComplete} style={{ marginTop: 16, background: '#f97316', border: 'none', borderRadius: 14, color: '#fff', fontSize: 16, fontWeight: 700, padding: '14px 40px', cursor: 'pointer' }}>
          Done
        </button>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100dvh', background: '#030712', display: 'flex', flexDirection: 'column', padding: 20, gap: 20, boxSizing: 'border-box', overflowY: 'auto' }}>
      <ScoreBar isQuota={isQuota} makes={makes} shotsTaken={shotsTaken} totalMinShots={totalMinShots} makeTarget={drill.make_target} overQuota={overQuota} />

      <div style={{ display: 'flex', background: '#111827', borderRadius: 12, padding: 4, gap: 4 }}>
        {[['by25', isQuota ? `Round (${roundQuota})` : 'By 25'], ['byRound', 'By Spot'], ['bySpot', 'One Spot']].map(([key, label]) => (
          <button key={key} onClick={() => setMode(key)} style={{ flex: 1, padding: '8px 0', borderRadius: 8, border: 'none', background: mode === key ? '#f97316' : 'transparent', color: mode === key ? '#fff' : '#6b7280', fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s' }}>{label}</button>
        ))}
      </div>

      <div style={{ textAlign: 'center' }}>
        <span style={{ background: '#1f2937', borderRadius: 999, padding: '4px 16px', fontSize: 13, color: '#9ca3af' }}>
          Round {round} of {totalRounds}
        </span>
      </div>

      {mode === 'by25' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 28, alignItems: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 15, color: '#6b7280', marginBottom: 8 }}>
              {isQuota ? `Shots taken this round (need ${roundQuota} makes)` : 'Total makes this round'}
            </div>
            <div style={{ fontSize: 44, fontWeight: 800, color: '#fff', letterSpacing: -1 }}>{drill.name}</div>
            <div style={{ fontSize: 14, color: '#4b5563', marginTop: 6 }}>
              {totalSpots} spots · {isQuota ? `${roundQuota} makes required` : `${maxBy25} shots`}
            </div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <input ref={inputRef} type="number" min={isQuota ? roundQuota : 0} value={input}
              onChange={e => { setInput(e.target.value); setError('') }} onKeyDown={handleBy25KeyDown}
              placeholder={isQuota ? `≥${roundQuota}` : `0–${maxBy25}`}
              style={{ width: 120, textAlign: 'center', fontSize: 48, fontWeight: 800, background: '#111827', border: '2px solid #374151', borderRadius: 16, color: '#fff', padding: '16px 0', outline: 'none', caretColor: '#f97316' }}
            />
            <div style={{ fontSize: 22, color: '#374151', marginTop: 8 }}>{isQuota ? 'shots' : `/ ${maxBy25}`}</div>
            {error && <div style={{ color: '#f87171', fontSize: 13, marginTop: 8 }}>{error}</div>}
            <div style={{ color: '#374151', fontSize: 12, marginTop: 12 }}>Press Enter to advance</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {Array.from({ length: totalRounds }).map((_, i) => (
              <div key={i} style={{ width: i === round - 1 ? 28 : 10, height: 10, borderRadius: 999, background: i < round - 1 ? '#4ade80' : i === round - 1 ? '#f97316' : '#1f2937', transition: 'all 0.3s ease' }} />
            ))}
          </div>
        </div>
      )}

      {mode === 'byRound' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 10 }}>
          {spots.map((spot, i) => {
            const quota = spot.make_quota ?? quotaPerSpot
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, background: i === activeRoundSpot ? '#1a2332' : '#0d1117', borderRadius: 12, padding: '12px 16px', border: `2px solid ${i === activeRoundSpot ? '#f97316' : 'transparent'}`, transition: 'all 0.15s' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: i === activeRoundSpot ? '#fff' : '#9ca3af' }}>{spot.label}</div>
                  <div style={{ fontSize: 12, color: '#4b5563' }}>{spot.shot_type} · {isQuota ? `make ${quota}` : `${repsPerSpot} shots`}</div>
                </div>
                <input ref={i === activeRoundSpot ? inputRef : null} type="number"
                  min={isQuota ? quota : 0} max={isQuota ? undefined : repsPerSpot}
                  value={roundInputs[i]} onChange={e => handleRoundInput(i, e.target.value)} onKeyDown={e => handleRoundKeyDown(e, i)}
                  placeholder={isQuota ? `≥${quota}` : `0–${repsPerSpot}`}
                  style={{ width: 72, textAlign: 'center', fontSize: 22, fontWeight: 700, background: '#030712', border: `2px solid ${i === activeRoundSpot ? '#f97316' : '#1f2937'}`, borderRadius: 8, color: '#fff', padding: '8px 0', outline: 'none' }}
                />
              </div>
            )
          })}
          {error && <div style={{ color: '#f87171', fontSize: 13, textAlign: 'center' }}>{error}</div>}
          <div style={{ color: '#374151', fontSize: 12, textAlign: 'center', marginTop: 4 }}>Tab or Enter to advance · Enter on last spot to submit</div>
        </div>
      )}

      {mode === 'bySpot' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 28 }}>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8 }}>
            {spots.map((_, i) => (
              <div key={i} style={{ width: i === spotIndex ? 28 : 10, height: 10, borderRadius: 999, background: i < spotIndex ? '#4ade80' : i === spotIndex ? '#f97316' : '#1f2937', transition: 'all 0.3s ease' }} />
            ))}
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 8 }}>Spot {spotIndex + 1} of {totalSpots}</div>
            <div style={{ fontSize: 44, fontWeight: 800, color: '#fff', letterSpacing: -1 }}>{currentSpot.label}</div>
            <div style={{ fontSize: 14, color: '#6b7280', marginTop: 6 }}>{currentSpot.shot_type} · {isQuota ? `make ${spotQuota}` : `${repsPerSpot} shots`}</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 13, color: '#9ca3af', marginBottom: 10 }}>
              {isQuota ? `Shots taken to make ${spotQuota}` : `Makes out of ${repsPerSpot}`}
            </div>
            <input ref={inputRef} type="number" min={isQuota ? spotQuota : 0} max={isQuota ? undefined : repsPerSpot}
              value={input} onChange={e => { setInput(e.target.value); setError('') }} onKeyDown={handleBy5KeyDown}
              placeholder={isQuota ? `≥${spotQuota}` : `0–${repsPerSpot}`}
              style={{ width: 100, textAlign: 'center', fontSize: 36, fontWeight: 700, background: '#111827', border: '2px solid #374151', borderRadius: 12, color: '#fff', padding: '12px 0', outline: 'none', caretColor: '#f97316' }}
            />
            {error && <div style={{ color: '#f87171', fontSize: 13, marginTop: 8 }}>{error}</div>}
            <div style={{ color: '#374151', fontSize: 12, marginTop: 10 }}>Press Enter to advance</div>
          </div>
        </div>
      )}
    </div>
  )
}
