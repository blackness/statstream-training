import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine
} from 'recharts'
import { Plus, TrendingUp, Target, Zap, ChevronRight } from 'lucide-react'
import { getPlayers, getSessions } from '../../lib/basketballClient'
import CorrelationChart from '../../components/Basketball/CorrelationChart'
import CalendarHeatmap  from '../../components/Basketball/CalendarHeatmap'
import DrillTrends      from '../../components/Basketball/DrillTrends'

function enrichSession(s) {
  const drills       = s.session_drills || []
  const totalMade    = drills.reduce((sum, d) => sum + (d.shots_made     || 0), 0)
  const totalAttempts = drills.reduce((sum, d) => sum + (d.shots_attempted || 0), 0)
  const pctMade      = totalAttempts > 0 ? (100 * totalMade) / totalAttempts : null
  return { ...s, total_made: totalMade, total_attempts: totalAttempts, pct_made: pctMade }
}

function fmtChartDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function fmtSessionDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
}

const TABS = [
  { key: 'overview',    label: 'Overview' },
  { key: 'correlation', label: 'Correlation' },
  { key: 'calendar',    label: 'Calendar' },
  { key: 'drills',      label: 'Drills' },
]

export default function Dashboard() {
  const navigate = useNavigate()
  const [players, setPlayers]           = useState([])
  const [selectedPlayer, setSelectedPlayer] = useState(null)
  const [sessions, setSessions]         = useState([])
  const [loading, setLoading]           = useState(true)
  const [chartRange, setChartRange]     = useState(30)
  const [activeTab, setActiveTab]       = useState('overview')

  useEffect(() => { loadPlayers() }, [])
  useEffect(() => { if (selectedPlayer) loadSessions(selectedPlayer.id) }, [selectedPlayer])

  async function loadPlayers() {
    const { data } = await getPlayers()
    if (data?.length) { setPlayers(data); setSelectedPlayer(data[0]) }
    setLoading(false)
  }

  async function loadSessions(playerId) {
    const { data } = await getSessions(playerId)
    setSessions((data || []).map(enrichSession))
  }

  const chronological = [...sessions].reverse()
  const chartData = chronological.slice(-chartRange).map((s, i, arr) => {
    const window = arr.slice(Math.max(0, i - 6), i + 1)
    const avg7   = window.reduce((sum, r) => sum + (r.pct_made || 0), 0) / window.length
    return {
      date:     fmtChartDate(s.session_date),
      pct:      s.pct_made ? Math.round(s.pct_made * 10) / 10 : null,
      avg7:     Math.round(avg7 * 10) / 10,
    }
  })

  const avgPct   = sessions.length
    ? (sessions.reduce((s, r) => s + (r.pct_made || 0), 0) / sessions.length).toFixed(1)
    : '—'
  const totalMade  = sessions.reduce((s, r) => s + (r.total_made || 0), 0)
  const recentSessions = sessions.slice(0, 8)

  if (loading) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <p className="text-gray-500">Loading...</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-950 text-white pb-24">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 px-4 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between max-w-2xl mx-auto">
          <h1 className="text-xl font-bold">🏀 Shooting Tracker</h1>
          <button
            onClick={() => navigate('/basketball/entry')}
            className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium"
          >
            <Plus size={16} /> Log Session
          </button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">
        {/* Player selector */}
        <div className="flex gap-2 flex-wrap">
          {players.map(p => (
            <button key={p.id} onClick={() => setSelectedPlayer(p)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedPlayer?.id === p.id
                  ? 'bg-orange-500 text-white'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}>
              {p.name}
            </button>
          ))}
        </div>

        {/* Stat cards — always visible */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Avg %',       value: `${avgPct}%`,              icon: <TrendingUp size={12} />, color: 'text-orange-400' },
            { label: 'Sessions',    value: sessions.length,            icon: <Zap size={12} />,        color: 'text-white' },
            { label: 'Total Makes', value: totalMade.toLocaleString(), icon: <Target size={12} />,     color: 'text-white' },
          ].map(card => (
            <div key={card.label} className="bg-gray-900 rounded-xl p-3 border border-gray-800">
              <div className="flex items-center gap-1 text-gray-400 text-xs mb-1">{card.icon} {card.label}</div>
              <div className={`text-2xl font-bold ${card.color}`}>{card.value}</div>
            </div>
          ))}
        </div>

        {/* Tab navigation */}
        <div className="flex bg-gray-900 rounded-xl p-1 border border-gray-800">
          {TABS.map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={`flex-1 py-2 px-1 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                activeTab === tab.key ? 'bg-orange-500 text-white' : 'text-gray-400 hover:text-white'
              }`}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── Overview ── */}
        {activeTab === 'overview' && (
          <>
            {chartData.length > 1 && (
              <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-4 text-xs text-gray-400">
                    <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-orange-400 inline-block" /> Session %</span>
                    <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-blue-400 inline-block" /> 7-day avg</span>
                  </div>
                  <div className="flex gap-1">
                    {[7, 30].map(r => (
                      <button key={r} onClick={() => setChartRange(r)}
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          chartRange === r ? 'bg-orange-500 text-white' : 'bg-gray-800 text-gray-400'
                        }`}>
                        {r}d
                      </button>
                    ))}
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                    <XAxis dataKey="date" tick={{ fill: '#6b7280', fontSize: 10 }} />
                    <YAxis domain={[0, 100]} tick={{ fill: '#6b7280', fontSize: 10 }} unit="%" width={36} />
                    <Tooltip
                      contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: '8px', fontSize: '12px' }}
                      labelStyle={{ color: '#f9fafb' }}
                      formatter={(val, name) => [`${val}%`, name === 'pct' ? 'Session %' : '7-day avg']}
                    />
                    <ReferenceLine y={80} stroke="#374151" strokeDasharray="4 4" />
                    <Line type="monotone" dataKey="pct"  stroke="#f97316" strokeWidth={2} dot={false} connectNulls />
                    <Line type="monotone" dataKey="avg7" stroke="#60a5fa" strokeWidth={2} dot={false} strokeDasharray="5 3" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-800">
                <h2 className="text-sm font-medium text-gray-300">Recent Sessions</h2>
              </div>
              {recentSessions.length === 0 ? (
                <div className="px-4 py-8 text-center text-gray-500 text-sm">
                  No sessions yet — tap Log Session to get started
                </div>
              ) : recentSessions.map(s => {
                const pct      = s.pct_made
                const pctColor = pct >= 80 ? 'text-green-400' : pct >= 60 ? 'text-orange-400' : 'text-red-400'
                return (
                  <div key={s.id} className="px-4 py-3 flex items-center justify-between border-b border-gray-800 last:border-0">
                    <div>
                      <div className="text-sm font-medium">{fmtSessionDate(s.session_date)}</div>
                      <div className="text-xs text-gray-400 mt-0.5">
                        {s.total_made}/{s.total_attempts} makes
                        {s.mood        != null && ` · mood ${s.mood}/10`}
                        {s.sleep_hours != null && ` · sleep ${s.sleep_hours}h`}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-lg font-bold ${pctColor}`}>
                        {pct != null ? `${pct.toFixed(1)}%` : '—'}
                      </span>
                      <ChevronRight size={16} className="text-gray-600" />
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}

        {activeTab === 'correlation' && <CorrelationChart sessions={sessions} />}
        {activeTab === 'calendar'    && <CalendarHeatmap  sessions={sessions} />}
        {activeTab === 'drills'      && <DrillTrends      sessions={sessions} />}
      </div>

      {/* Bottom nav */}
      <div className="fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-800 flex justify-around py-3">
        <button onClick={() => navigate('/basketball')} className="flex flex-col items-center gap-1 text-orange-400">
          <TrendingUp size={20} /><span className="text-xs">Dashboard</span>
        </button>
        <button onClick={() => navigate('/basketball/entry')} className="flex flex-col items-center gap-1 text-gray-400 hover:text-white">
          <Plus size={20} /><span className="text-xs">Log</span>
        </button>
        <button onClick={() => navigate('/basketball/templates')} className="flex flex-col items-center gap-1 text-gray-400 hover:text-white">
          <Target size={20} /><span className="text-xs">Drills</span>
        </button>
      </div>
    </div>
  )
}