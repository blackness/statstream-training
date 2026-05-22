import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import BottomNav from '../components/BottomNav'

// ── Constants ──────────────────────────────────────────────────
const RACE_DISTANCES = [
  { label: '1K',       km: 1 },
  { label: '1 Mile',   km: 1.60934 },
  { label: '5K',       km: 5 },
  { label: '8K',       km: 8 },
  { label: '10K',      km: 10 },
  { label: '15K',      km: 15 },
  { label: 'Half',     km: 21.0975 },
  { label: 'Marathon', km: 42.195 },
]

const SPLIT_MARKS = {
  '5K':       [1, 2, 3, 4, 5],
  '8K':       [1, 2, 3, 4, 5, 6, 7, 8],
  '10K':      [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  '15K':      [5, 10, 15],
  'Half':     [5, 10, 15, 21.0975],
  'Marathon': [5, 10, 15, 20, 25, 30, 35, 40, 42.195],
}

// ── Formatters ─────────────────────────────────────────────────
function secsToDisplay(secs) {
  if (!secs || secs <= 0) return ''
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = Math.floor(secs % 60)
  if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
  return `${m}:${String(s).padStart(2,'0')}`
}

function paceSecs(totalSecs, distKm) {
  if (!totalSecs || !distKm) return null
  return totalSecs / distKm
}

function paceDisplay(secsPerKm, unit = 'km') {
  if (!secsPerKm || secsPerKm <= 0) return '—'
  const s = unit === 'mi' ? secsPerKm * 1.60934 : secsPerKm
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${String(sec).padStart(2,'0')}/${unit}`
}

function parseTimeInput(h, m, s) {
  const hh = parseInt(h) || 0
  const mm = parseInt(m) || 0
  const ss = parseInt(s) || 0
  if (hh === 0 && mm === 0 && ss === 0) return null
  return hh * 3600 + mm * 60 + ss
}

function parsePaceInput(m, s) {
  const mm = parseInt(m) || 0
  const ss = parseInt(s) || 0
  if (mm === 0 && ss === 0) return null
  return mm * 60 + ss
}

function timeForDist(secsPerKm, km) {
  if (!secsPerKm || !km) return null
  return secsPerKm * km
}

// ── Input components ────────────────────────────────────────────
function TimeInput({ label, h, m, s, onChange, highlight }) {
  const S = inputStyles
  return (
    <div>
      <div style={{ fontSize:11, color: highlight?'#f97316':'#6b7280', fontWeight:700, letterSpacing:1, marginBottom:6, textTransform:'uppercase' }}>
        {label}
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:4 }}>
        <input
          type="number" min="0" max="99"
          value={h} onChange={e=>onChange('h', e.target.value)}
          placeholder="0" style={{ ...S.box, width:48 }}
        />
        <span style={S.colon}>h</span>
        <input
          type="number" min="0" max="59"
          value={m} onChange={e=>onChange('m', e.target.value)}
          placeholder="00" style={{ ...S.box, width:48 }}
        />
        <span style={S.colon}>m</span>
        <input
          type="number" min="0" max="59"
          value={s} onChange={e=>onChange('s', e.target.value)}
          placeholder="00" style={{ ...S.box, width:48 }}
        />
        <span style={S.colon}>s</span>
      </div>
    </div>
  )
}

function PaceInput({ label, m, s, unit, onChange, highlight }) {
  const S = inputStyles
  return (
    <div>
      <div style={{ fontSize:11, color: highlight?'#f97316':'#6b7280', fontWeight:700, letterSpacing:1, marginBottom:6, textTransform:'uppercase' }}>
        {label} <span style={{ color:'#4b5563', fontWeight:400 }}>/{unit}</span>
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:4 }}>
        <input
          type="number" min="0" max="99"
          value={m} onChange={e=>onChange('m', e.target.value)}
          placeholder="0" style={{ ...S.box, width:48 }}
        />
        <span style={S.colon}>:</span>
        <input
          type="number" min="0" max="59"
          value={s} onChange={e=>onChange('s', e.target.value)}
          placeholder="00" style={{ ...S.box, width:56 }}
        />
      </div>
    </div>
  )
}

const inputStyles = {
  box: {
    background:'#111827', border:'1.5px solid #1f2937', borderRadius:8,
    color:'#fff', fontSize:20, fontWeight:700, padding:'10px 8px',
    outline:'none', textAlign:'center', fontVariantNumeric:'tabular-nums',
    WebkitAppearance:'none', MozAppearance:'textfield'
  },
  colon: { color:'#4b5563', fontSize:16, fontWeight:700, userSelect:'none' }
}

// ── Main ───────────────────────────────────────────────────────
export default function PaceCalculator() {
  const navigate = useNavigate()
  const [unit, setUnit] = useState('km') // 'km' | 'mi'
  const [activeCalc, setActiveCalc] = useState('pace') // 'pace' | 'time' | 'distance'

  // Distance input
  const [distKm, setDistKm] = useState('')
  const [distCustom, setDistCustom] = useState('')
  const [distUnit, setDistUnit] = useState('km')

  // Time inputs
  const [timeH, setTimeH] = useState('')
  const [timeM, setTimeM] = useState('')
  const [timeS, setTimeS] = useState('')

  // Pace inputs (per unit)
  const [paceM, setPaceM] = useState('')
  const [paceS, setPaceS] = useState('')

  // Derived values
  const [result, setResult] = useState(null)
  const [selectedRace, setSelectedRace] = useState('5K')

  // Effective distance in km
  const effectiveDistKm = distKm
    ? RACE_DISTANCES.find(d=>d.label===distKm)?.km
    : distCustom
      ? parseFloat(distCustom) * (distUnit==='mi' ? 1.60934 : 1)
      : null

  // Pace in secs/km (internal)
  const paceSecsPerUnit = parsePaceInput(paceM, paceS)
  const paceSecsPerKm = paceSecsPerUnit
    ? (unit === 'mi' ? paceSecsPerUnit / 1.60934 : paceSecsPerUnit)
    : null

  const totalSecs = parseTimeInput(timeH, timeM, timeS)

  useEffect(() => {
    calculate()
  }, [timeH, timeM, timeS, paceM, paceS, effectiveDistKm, activeCalc, unit])

  function calculate() {
    if (activeCalc === 'pace') {
      // Know time + distance → find pace
      if (!totalSecs || !effectiveDistKm) { setResult(null); return }
      const sPerKm = totalSecs / effectiveDistKm
      setResult({ type:'pace', secsPerKm: sPerKm })
    } else if (activeCalc === 'time') {
      // Know pace + distance → find time
      if (!paceSecsPerKm || !effectiveDistKm) { setResult(null); return }
      const secs = paceSecsPerKm * effectiveDistKm
      setResult({ type:'time', secs })
    } else {
      // Know pace + time → find distance
      if (!paceSecsPerKm || !totalSecs) { setResult(null); return }
      const km = totalSecs / paceSecsPerKm
      setResult({ type:'distance', km })
    }
  }

  function clearAll() {
    setTimeH(''); setTimeM(''); setTimeS('')
    setPaceM(''); setPaceS('')
    setDistKm(''); setDistCustom('')
    setResult(null)
  }

  // Result display
  const resultSecsPerKm = result?.type === 'pace' ? result.secsPerKm
    : result?.type === 'time' ? paceSecsPerKm
    : result?.type === 'distance' ? paceSecsPerKm
    : null

  const resultTotalSecs = result?.type === 'time' ? result.secs
    : result?.type === 'pace' ? totalSecs
    : result?.type === 'distance' ? totalSecs
    : null

  const resultKm = result?.type === 'distance' ? result.km : effectiveDistKm

  // Splits for selected race
  const splitsForRace = SPLIT_MARKS[selectedRace] || []
  const raceKm = RACE_DISTANCES.find(d=>d.label===selectedRace)?.km

  return (
    <div style={{ minHeight:'100dvh', background:'#030712', paddingBottom:80, boxSizing:'border-box', fontFamily:"'Barlow', sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700;800;900&family=Barlow:wght@300;400;500;600&display=swap" rel="stylesheet" />

      {/* Header */}
      <div style={{ padding:'24px 20px 16px', borderBottom:'1px solid #1f2937', background:'linear-gradient(180deg,#0d1117 0%,#030712 100%)' }}>
        <button onClick={()=>navigate(-1)} style={{ background:'none', border:'none', color:'#4b5563', fontSize:13, cursor:'pointer', padding:'0 0 10px', display:'flex', alignItems:'center', gap:4 }}>
          ← Back
        </button>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
          <div>
            <h1 style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:28, fontWeight:900, color:'#f0f4f8', margin:0, letterSpacing:-0.5 }}>
              Pace Calculator
            </h1>
            <p style={{ color:'#4b5563', fontSize:14, margin:'4px 0 0' }}>Time · Pace · Distance</p>
          </div>
          {/* Unit toggle */}
          <div style={{ display:'flex', background:'#111827', borderRadius:10, padding:3, gap:2 }}>
            {['km','mi'].map(u => (
              <button key={u} onClick={()=>setUnit(u)} style={{
                padding:'6px 14px', borderRadius:8, border:'none', cursor:'pointer',
                background: unit===u ? '#f97316' : 'transparent',
                color: unit===u ? '#fff' : '#6b7280',
                fontFamily:"'Barlow Condensed',sans-serif",
                fontSize:14, fontWeight:800, letterSpacing:1, textTransform:'uppercase'
              }}>{u}</button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ padding:'16px 20px', display:'flex', flexDirection:'column', gap:16 }}>

        {/* Calc mode tabs */}
        <div style={{ display:'flex', gap:0, background:'#111827', borderRadius:12, padding:4 }}>
          {[
            { id:'pace',     label:'Find Pace' },
            { id:'time',     label:'Find Time' },
            { id:'distance', label:'Find Distance' },
          ].map(tab => (
            <button key={tab.id} onClick={()=>{ setActiveCalc(tab.id); setResult(null) }} style={{
              flex:1, padding:'9px 0', borderRadius:9, border:'none', fontSize:13, fontWeight:700,
              background: activeCalc===tab.id ? '#1f2937' : 'transparent',
              color:      activeCalc===tab.id ? '#f97316' : '#6b7280',
              cursor:'pointer', transition:'all 0.15s',
              borderTop: activeCalc===tab.id ? '2px solid #f97316' : '2px solid transparent',
            }}>{tab.label}</button>
          ))}
        </div>

        {/* Inputs card */}
        <div style={{ background:'#0d1117', borderRadius:16, border:'1.5px solid #1f2937', padding:'20px 16px', display:'flex', flexDirection:'column', gap:18 }}>

          {/* Distance — hidden when finding distance */}
          {activeCalc !== 'distance' && (
            <div>
              <div style={{ fontSize:11, color:'#6b7280', fontWeight:700, letterSpacing:1, marginBottom:8, textTransform:'uppercase' }}>Distance</div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:8 }}>
                {RACE_DISTANCES.map(d => (
                  <button key={d.label} onClick={()=>{ setDistKm(d.label); setDistCustom('') }} style={{
                    padding:'6px 12px', borderRadius:999, fontSize:13, fontWeight:600, cursor:'pointer',
                    border:`1.5px solid ${distKm===d.label?'#f97316':'#1f2937'}`,
                    background: distKm===d.label?'#f9731622':'#111827',
                    color: distKm===d.label?'#f97316':'#6b7280',
                  }}>{d.label}</button>
                ))}
              </div>
              <div style={{ display:'flex', gap:8 }}>
                <input
                  type="number" min="0"
                  value={distCustom}
                  onChange={e=>{ setDistCustom(e.target.value); setDistKm('') }}
                  placeholder="Custom distance"
                  style={{ ...inputStyles.box, flex:1, textAlign:'left', padding:'10px 14px', fontSize:15 }}
                />
                <div style={{ display:'flex', background:'#111827', borderRadius:8, overflow:'hidden', border:'1.5px solid #1f2937' }}>
                  {['km','mi'].map(u => (
                    <button key={u} onClick={()=>setDistUnit(u)} style={{
                      padding:'0 12px', border:'none', cursor:'pointer',
                      background: distUnit===u?'#374151':'transparent',
                      color: distUnit===u?'#fff':'#4b5563',
                      fontSize:13, fontWeight:700
                    }}>{u}</button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Time — hidden when finding time */}
          {activeCalc !== 'time' && (
            <TimeInput
              label="Time"
              h={timeH} m={timeM} s={timeS}
              onChange={(field, val) => {
                if (field==='h') setTimeH(val)
                if (field==='m') setTimeM(val)
                if (field==='s') setTimeS(val)
              }}
              highlight={activeCalc==='distance'}
            />
          )}

          {/* Pace — hidden when finding pace */}
          {activeCalc !== 'pace' && (
            <PaceInput
              label="Pace"
              m={paceM} s={paceS} unit={unit}
              onChange={(field, val) => {
                if (field==='m') setPaceM(val)
                if (field==='s') setPaceS(val)
              }}
              highlight={activeCalc==='time' || activeCalc==='distance'}
            />
          )}

          <button onClick={clearAll} style={{ background:'none', border:'none', color:'#374151', fontSize:12, cursor:'pointer', textAlign:'left', padding:0, fontWeight:600 }}>
            Clear all
          </button>
        </div>

        {/* Result */}
        {result && (
          <div style={{ background:'linear-gradient(135deg,#0f2a1a,#0d1117)', borderRadius:16, border:'1.5px solid #4ade8044', padding:'20px 16px' }}>
            <div style={{ fontSize:11, color:'#4ade80', fontWeight:700, letterSpacing:2, marginBottom:12, textTransform:'uppercase' }}>Result</div>
            <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>

              {result.type === 'pace' && (
                <>
                  <ResultBox label={`Pace/${unit}`} value={paceDisplay(resultSecsPerKm, unit)} accent />
                  {unit === 'km'
                    ? <ResultBox label="Pace/mi" value={paceDisplay(resultSecsPerKm, 'mi')} />
                    : <ResultBox label="Pace/km" value={paceDisplay(resultSecsPerKm, 'km')} />
                  }
                </>
              )}

              {result.type === 'time' && (
                <ResultBox label="Finish Time" value={secsToDisplay(resultTotalSecs)} accent large />
              )}

              {result.type === 'distance' && (
                <>
                  <ResultBox label="Distance (km)" value={result.km.toFixed(2) + ' km'} accent />
                  <ResultBox label="Distance (mi)" value={(result.km / 1.60934).toFixed(2) + ' mi'} />
                </>
              )}

            </div>
          </div>
        )}

        {/* Split predictions */}
        {resultSecsPerKm && (
          <div style={{ background:'#0d1117', borderRadius:16, border:'1.5px solid #1f2937', overflow:'hidden' }}>
            <div style={{ padding:'14px 16px 0' }}>
              <div style={{ fontSize:11, color:'#6b7280', fontWeight:700, letterSpacing:1, marginBottom:10, textTransform:'uppercase' }}>Race Predictions</div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:14 }}>
                {RACE_DISTANCES.filter(d=>['5K','10K','Half','Marathon'].includes(d.label)).map(d => (
                  <button key={d.label} onClick={()=>setSelectedRace(d.label)} style={{
                    padding:'6px 14px', borderRadius:999, fontSize:13, fontWeight:700, cursor:'pointer',
                    border:`1.5px solid ${selectedRace===d.label?'#f97316':'#1f2937'}`,
                    background: selectedRace===d.label?'#f9731622':'#111827',
                    color: selectedRace===d.label?'#f97316':'#6b7280',
                  }}>{d.label}</button>
                ))}
              </div>
            </div>

            {/* Predicted finish */}
            {raceKm && (
              <div style={{ padding:'0 16px 14px' }}>
                <div style={{ background:'#111827', borderRadius:12, padding:'12px 14px', marginBottom:10, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <span style={{ color:'#4ade80', fontSize:13, fontWeight:700 }}>🏁 Predicted Finish</span>
                  <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:24, fontWeight:900, color:'#4ade80', letterSpacing:-0.5, fontVariantNumeric:'tabular-nums' }}>
                    {secsToDisplay(timeForDist(resultSecsPerKm, raceKm))}
                  </span>
                </div>

                {/* Splits table */}
                <div style={{ display:'flex', flexDirection:'column', gap:1, borderRadius:10, overflow:'hidden' }}>
                  {splitsForRace.map((km, i) => {
                    const prev = i === 0 ? 0 : splitsForRace[i-1]
                    const segKm = km - prev
                    const cumSecs = timeForDist(resultSecsPerKm, km)
                    const segSecs = timeForDist(resultSecsPerKm, segKm)
                    const isFinal = km === raceKm
                    return (
                      <div key={km} style={{
                        display:'flex', justifyContent:'space-between', alignItems:'center',
                        padding:'9px 12px',
                        background: isFinal ? '#14532d' : i%2===0 ? '#111827' : '#0d1117',
                      }}>
                        <div style={{ display:'flex', gap:10, alignItems:'center' }}>
                          <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:12, fontWeight:700, color: isFinal?'#4ade80':'#4b5563', minWidth:36 }}>
                            {isFinal ? '🏁' : `${km}km`}
                          </span>
                          <span style={{ fontSize:11, color:'#374151' }}>+{segKm.toFixed(segKm%1===0?0:3)}km</span>
                        </div>
                        <div style={{ textAlign:'right' }}>
                          <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:15, fontWeight:700, color: isFinal?'#4ade80':'#f0f4f8', fontVariantNumeric:'tabular-nums' }}>
                            {secsToDisplay(segSecs)}
                          </div>
                          <div style={{ fontSize:11, color:'#4b5563', fontVariantNumeric:'tabular-nums' }}>
                            {secsToDisplay(cumSecs)}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}

      </div>

      <BottomNav />

      <style>{`
        input[type=number]::-webkit-inner-spin-button,
        input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; }
        input[type=number] { -moz-appearance: textfield; }
        input::placeholder { color: #374151; }
        input:focus { border-color: #f97316 !important; outline: none; }
      `}</style>
    </div>
  )
}

function ResultBox({ label, value, accent, large }) {
  return (
    <div style={{
      flex:1, minWidth:120,
      background: accent ? 'rgba(74,222,128,0.06)' : '#111827',
      border: `1.5px solid ${accent ? '#4ade8044' : '#1f2937'}`,
      borderRadius:12, padding:'12px 14px'
    }}>
      <div style={{ fontSize:11, color: accent?'#4ade80':'#4b5563', fontWeight:600, letterSpacing:0.5, marginBottom:4 }}>{label}</div>
      <div style={{
        fontFamily:"'Barlow Condensed',sans-serif",
        fontSize: large ? 28 : 22,
        fontWeight:900, color: accent?'#4ade80':'#f0f4f8',
        letterSpacing:-0.5, fontVariantNumeric:'tabular-nums'
      }}>{value}</div>
    </div>
  )
}
