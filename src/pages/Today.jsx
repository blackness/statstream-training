import { useState, useEffect } from 'react'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import DrillRunner from '../components/DrillRunner/DrillRunner'

export default function Today() {
  const { user, profile } = useAuth()
  const [drill, setDrill] = useState(null)
  const [spots, setSpots] = useState([])
  const [activeDrill, setActiveDrill] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: drillData } = await supabase
        .from('drills')
        .select('*')
        .eq('id', 'f0e00e3b-2be1-4c3c-aef9-f39bb84b00f4')
        .single()

      const { data: spotData } = await supabase
        .from('drill_spots')
        .select('*')
        .eq('drill_id', 'f0e00e3b-2be1-4c3c-aef9-f39bb84b00f4')
        .order('spot_order')

      setDrill(drillData)
      setSpots(spotData ?? [])
    }
    load()
  }, [])

  if (activeDrill && drill && spots.length) {
    return (
      <DrillRunner
        drill={drill}
        spots={spots}
        playerId={user.id}
        onComplete={() => setActiveDrill(false)}
      />
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#030712', padding: 24, color: '#fff' }}>
      <p style={{ color: '#6b7280', margin: 0 }}>Welcome, {profile?.full_name || 'Player'}</p>
      <h1 style={{ fontSize: 26, fontWeight: 800, margin: '4px 0 24px' }}>Today's Workout</h1>
      {drill && (
        <div style={{ background: '#111827', borderRadius: 16, padding: 20 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 6px' }}>{drill.name}</h2>
<a href="/library" style={{ color: '#f97316', fontSize: 14, textDecoration: 'none' }}>
  Drill Library →
</a>
<a href="/history" style={{ color: '#9ca3af', fontSize: 14, textDecoration: 'none', marginLeft: 16 }}>
  History →
</a>
          <p style={{ color: '#9ca3af', fontSize: 14, margin: '0 0 4px' }}>{drill.description}</p>
          <p style={{ color: '#6b7280', fontSize: 13, margin: '0 0 16px' }}>Target: {drill.make_target} makes</p>
          <button
            onClick={() => setActiveDrill(true)}
            style={{
              width: '100%',
              background: '#f97316',
              border: 'none',
              borderRadius: 12,
              color: '#fff',
              fontSize: 16,
              fontWeight: 700,
              padding: '14px 0',
              cursor: 'pointer'
            }}
          >
            Start Drill
          </button>
        </div>
      )}
    </div>
  )
}