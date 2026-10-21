export default function CalendarHeatmap({ sessions }) {
  const sessionMap = {}
  sessions.forEach(s => {
    if (s.pct_made != null) {
      sessionMap[s.session_date] = {
        pct: parseFloat(s.pct_made),
        made: s.total_made,
        attempts: s.total_attempts,
      }
    }
  })

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayStr = today.toISOString().split('T')[0]

  const days = []
  for (let i = 90; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const dateStr = d.toISOString().split('T')[0]
    const session = sessionMap[dateStr]
    days.push({
      dateStr,
      dayOfWeek: d.getDay(),
      label: d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
      pct:      session?.pct ?? null,
      made:     session?.made,
      attempts: session?.attempts,
    })
  }

  const firstDayOfWeek = days[0].dayOfWeek
  const padded = [...Array(firstDayOfWeek).fill(null), ...days]
  const weeks  = []
  for (let i = 0; i < padded.length; i += 7) weeks.push(padded.slice(i, i + 7))

  function cellColor(pct) {
    if (pct === null)   return 'bg-gray-800'
    if (pct >= 85)      return 'bg-green-400'
    if (pct >= 75)      return 'bg-green-600'
    if (pct >= 60)      return 'bg-yellow-600'
    return                     'bg-red-700'
  }

  const dayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

  return (
    <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
      <h3 className="text-sm font-medium text-gray-300 mb-3">Session Calendar (last 90 days)</h3>

      {/* Day labels */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {dayLabels.map((d, i) => (
          <div key={i} className="text-center text-xs text-gray-600">{d}</div>
        ))}
      </div>

      {/* Weeks */}
      <div className="space-y-1">
        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 gap-1">
            {week.map((day, di) => (
              <div
                key={di}
                title={
                  day
                    ? day.pct != null
                      ? `${day.label}: ${day.pct.toFixed(1)}% (${day.made}/${day.attempts})`
                      : `${day.label}: no session`
                    : ''
                }
                className={`aspect-square rounded-sm transition-opacity ${
                  day ? cellColor(day.pct) : 'bg-transparent'
                } ${day?.dateStr === todayStr ? 'ring-1 ring-white' : ''}`}
              />
            ))}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 mt-4 flex-wrap">
        {[
          { color: 'bg-gray-800', label: 'No session' },
          { color: 'bg-red-700',  label: '<60%' },
          { color: 'bg-yellow-600', label: '60–75%' },
          { color: 'bg-green-600',  label: '75–85%' },
          { color: 'bg-green-400',  label: '85%+' },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1">
            <div className={`w-3 h-3 rounded-sm ${color}`} />
            <span className="text-xs text-gray-500">{label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}