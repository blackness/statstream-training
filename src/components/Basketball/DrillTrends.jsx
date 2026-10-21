import { useState } from 'react'
import {
  LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine
} from 'recharts'

function fmtDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function DrillTrends({ sessions }) {
  const [selectedId, setSelectedId] = useState(null)

  // Build drill map from sessions
  const drillMap = {}
  sessions.forEach(s => {
    ;(s.session_drills || []).forEach(sd => {
      const name = sd.drill_templates?.name || sd.custom_name || 'Unknown'
      const id   = sd.drill_template_id || name
      if (!drillMap[id]) {
        drillMap[id] = { id, name, goal: sd.drill_templates?.goal_percent || null, points: [] }
      }
      if (sd.shots_attempted > 0) {
        drillMap[id].points.push({
          date:      s.session_date,
          dateLabel: fmtDate(s.session_date),
          pct:       Math.round((sd.shots_made / sd.shots_attempted) * 1000) / 10,
          made:      sd.shots_made,
          attempted: sd.shots_attempted,
        })
      }
    })
  })

  const drills = Object.values(drillMap)
    .filter(d => d.points.length > 0)
    .map(d => ({ ...d, points: [...d.points].sort((a, b) => a.date.localeCompare(b.date)) }))

  const active = drills.find(d => d.id === selectedId) || drills[0]

  if (drills.length === 0) {
    return (
      <div className="bg-gray-900 rounded-xl p-8 border border-gray-800 text-center text-gray-500 text-sm">
        No drill data yet. Log a session with drills to see trends.
      </div>
    )
  }

  const avgPct  = active ? (active.points.reduce((s, p) => s + p.pct, 0) / active.points.length).toFixed(1) : null
  const bestPct = active ? Math.max(...active.points.map(p => p.pct)) : null
  const lastPct = active?.points[active.points.length - 1]?.pct

  return (
    <div className="space-y-3">
      {/* Drill selector */}
      <div className="flex gap-2 flex-wrap">
        {drills.map(d => (
          <button
            key={d.id}
            onClick={() => setSelectedId(d.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              active?.id === d.id
                ? 'bg-orange-500 text-white'
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            }`}
          >
            {d.name}
          </button>
        ))}
      </div>

      {active && (
        <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
          <h3 className="text-sm font-medium text-gray-300 mb-3 truncate">{active.name}</h3>

          {active.points.length < 2 ? (
            <p className="text-gray-500 text-sm py-6 text-center">Need at least 2 sessions to show a trend</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={active.points}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="dateLabel" tick={{ fill: '#6b7280', fontSize: 10 }} />
                <YAxis domain={[0, 100]} tick={{ fill: '#6b7280', fontSize: 10 }} unit="%" width={36} />
                <Tooltip
                  contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: '8px', fontSize: '12px' }}
                  formatter={(val, _, props) => [
                    `${val}%  (${props.payload.made}/${props.payload.attempted})`,
                    'Shooting %'
                  ]}
                />
                {active.goal && (
                  <ReferenceLine y={active.goal} stroke="#374151" strokeDasharray="4 4"
                    label={{ value: `Goal ${active.goal}%`, fill: '#6b7280', fontSize: 10, position: 'insideTopRight' }}
                  />
                )}
                <Line
                  type="monotone" dataKey="pct" stroke="#f97316" strokeWidth={2}
                  dot={{ r: 4, fill: '#f97316', strokeWidth: 0 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}

          {/* Stats row */}
          <div className="flex gap-4 mt-3 pt-3 border-t border-gray-800">
            {[
              { label: 'Sessions', value: active.points.length },
              { label: 'Average',  value: avgPct  != null ? `${avgPct}%`  : '—' },
              { label: 'Best',     value: bestPct  != null ? `${bestPct}%` : '—' },
              { label: 'Last',     value: lastPct  != null ? `${lastPct}%` : '—' },
            ].map(stat => (
              <div key={stat.label}>
                <div className="text-xs text-gray-500">{stat.label}</div>
                <div className="text-sm font-bold text-white">{stat.value}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}