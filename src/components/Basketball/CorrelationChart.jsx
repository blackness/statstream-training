import { useState } from 'react'
import {
  ScatterChart, Scatter, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts'

function computeRegression(points) {
  const n = points.length
  if (n < 3) return null
  const sumX  = points.reduce((s, p) => s + p.x, 0)
  const sumY  = points.reduce((s, p) => s + p.y, 0)
  const sumXY = points.reduce((s, p) => s + p.x * p.y, 0)
  const sumX2 = points.reduce((s, p) => s + p.x * p.x, 0)
  const slope     = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX)
  const intercept = (sumY - slope * sumX) / n
  const meanX = sumX / n
  const meanY = sumY / n
  const num = points.reduce((s, p) => s + (p.x - meanX) * (p.y - meanY), 0)
  const den = Math.sqrt(
    points.reduce((s, p) => s + Math.pow(p.x - meanX, 2), 0) *
    points.reduce((s, p) => s + Math.pow(p.y - meanY, 2), 0)
  )
  const r = den === 0 ? 0 : num / den
  return { slope, intercept, r }
}

function trendPoints(reg, points) {
  const xs  = points.map(p => p.x)
  const min = Math.min(...xs)
  const max = Math.max(...xs)
  return [
    { x: min, y: Math.max(0, Math.min(100, reg.slope * min + reg.intercept)) },
    { x: max, y: Math.max(0, Math.min(100, reg.slope * max + reg.intercept)) },
  ]
}

function rBadge(r) {
  if (Math.abs(r) < 0.2) return { text: `r = ${r.toFixed(2)} · weak`, bg: 'bg-gray-800', color: 'text-gray-400' }
  if (r > 0)             return { text: `r = ${r.toFixed(2)} ↑ positive`, bg: 'bg-green-900', color: 'text-green-300' }
  return                        { text: `r = ${r.toFixed(2)} ↓ negative`, bg: 'bg-red-900',   color: 'text-red-300' }
}

function ScatterPlot({ title, xLabel, xUnit, points }) {
  const reg   = computeRegression(points)
  const trend = reg ? trendPoints(reg, points) : []
  const badge = reg ? rBadge(reg.r) : null

  return (
    <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h3 className="text-sm font-medium text-gray-300">{title}</h3>
        {badge && (
          <span className={`text-xs font-medium px-2 py-1 rounded-lg ${badge.bg} ${badge.color}`}>
            {badge.text}
          </span>
        )}
      </div>
      {points.length < 3 ? (
        <p className="text-gray-500 text-sm py-8 text-center">Need at least 3 sessions with this data</p>
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <ScatterChart margin={{ top: 5, right: 10, bottom: 20, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
            <XAxis
              type="number" dataKey="x" name={xLabel}
              tick={{ fill: '#6b7280', fontSize: 10 }}
              label={{ value: `${xLabel}${xUnit ? ` (${xUnit})` : ''}`, position: 'insideBottom', offset: -10, fill: '#6b7280', fontSize: 10 }}
              domain={['auto', 'auto']}
            />
            <YAxis
              type="number" dataKey="y" name="Shooting %"
              tick={{ fill: '#6b7280', fontSize: 10 }}
              unit="%" width={36} domain={[0, 100]}
            />
            <Tooltip
              contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: '8px', fontSize: '12px' }}
              cursor={{ strokeDasharray: '3 3' }}
              formatter={(val, name) => name === 'x'
                ? [`${val}${xUnit}`, xLabel]
                : [`${Number(val).toFixed(1)}%`, 'Shooting %']}
            />
            <Scatter data={points} fill="#f97316" opacity={0.85} />
            {trend.length === 2 && (
              <Scatter
                data={trend}
                fill="transparent"
                line={{ stroke: '#60a5fa', strokeWidth: 2, strokeDasharray: '5 3' }}
                shape={(p) => <circle cx={p.cx} cy={p.cy} r={2} fill="#60a5fa" opacity={0.4} />}
              />
            )}
          </ScatterChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}

const METRICS = [
  { key: 'sleep',    label: 'Sleep',    xLabel: 'Sleep Hours', xUnit: 'h',   getter: s => s.sleep_hours != null ? parseFloat(s.sleep_hours) : null },
  { key: 'mood',     label: 'Mood',     xLabel: 'Mood',        xUnit: '/10', getter: s => s.mood != null ? parseInt(s.mood) : null },
  { key: 'soreness', label: 'Soreness', xLabel: 'Soreness',    xUnit: '/10', getter: s => s.soreness != null ? parseInt(s.soreness) : null },
]

export default function CorrelationChart({ sessions }) {
  const [metric, setMetric] = useState('sleep')
  const active = METRICS.find(m => m.key === metric)

  const points = sessions
    .filter(s => active.getter(s) != null && s.pct_made != null)
    .map(s => ({ x: active.getter(s), y: parseFloat(s.pct_made) }))

  return (
    <div className="space-y-3">
      <div className="flex gap-2 flex-wrap">
        {METRICS.map(m => (
          <button key={m.key} onClick={() => setMetric(m.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              metric === m.key ? 'bg-orange-500 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            }`}>
            {m.label}
          </button>
        ))}
      </div>
      <ScatterPlot
        title={`${active.xLabel} vs Shooting %`}
        xLabel={active.xLabel}
        xUnit={active.xUnit}
        points={points}
      />
      <p className="text-xs text-gray-600 text-center">Each dot is one session · blue dashed line shows trend</p>
    </div>
  )
}