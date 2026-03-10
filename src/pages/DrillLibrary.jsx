import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import DrillRunner from '../components/DrillRunner/DrillRunner'

const SHOT_TYPES = ['2PT', '3PT', 'FT']
const TAGS = ['shooting', 'volume', 'game_prep', 'off_dribble', 'free_throw', 'conditioning']

function DrillModal({ drill, onClose, onSaved, userId, teamId }) {
  const editing = !!drill
  const [name, setName] = useState(drill?.name ?? '')
  const [description, setDescription] = useState(drill?.description ?? '')
  const [makeTarget, setMakeTarget] = useState(drill?.make_target ?? '')
  const [rounds, setRounds] = useState(drill?.rounds ?? 4)
  const [tags, setTags] = useState(drill?.tags ?? [])
  const [visibility, setVisibility] = useState(drill?.visibility ?? 'public')
  const [drillType, setDrillType] = useState(drill?.drill_type ?? 'fixed')
  const [spots, setSpots] = useState([])
  const isQuota = drillType === 'quota'
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [historyDrill, setHistoryDrill] = useState(null)

  useEffect(() => {
    if (drill?.id) {
      supabase.from('drill_spots').select('*')
        .eq('drill_id', drill.id).order('spot_order')
        .then(({ data }) => setSpots(data ?? []))
    } else {
      setSpots([{ label: '', shot_type: '3PT', reps: 5, make_quota: 5 }])
    }
  }, [drill])

  function toggleTag(tag) {
    setTags(t => t.includes(tag) ? t.filter(x => x !== tag) : [...t, tag])
  }

  function updateSpot(i, field, val) {
    const updated = [...spots]
    updated[i] = { ...updated[i], [field]: val }
    setSpots(updated)
  }

  function addSpot() {
    setSpots([...spots, { label: '', shot_type: '3PT', reps: 5, make_quota: 5 }])
  }

  function removeSpot(i) {
    setSpots(spots.filter((_, idx) => idx !== i))
  }

  async function handleSave() {
    if (!name.trim()) { setError('Name is required'); return }
    if (spots.some(s => !s.label.trim())) { setError('All spots need a label'); return }
    setSaving(true)

    const drillPayload = {
      name: name.trim(),
      description: description.trim(),
      make_target: isQuota ? null : (makeTarget ? parseInt(makeTarget) : null),
      rounds: parseInt(rounds),
      tags,
      drill_type: drillType,
      created_by: userId,
      team_id: teamId,
      visibility,
      is_public: visibility === 'public',
    }

    let drillId = drill?.id
    if (editing) {
      await supabase.from('drills').update(drillPayload).eq('id', drillId)
      await supabase.from('drill_spots').delete().eq('drill_id', drillId)
    } else {
      const { data } = await supabase.from('drills').insert(drillPayload).select('id').single()
      drillId = data.id
    }

    const spotRows = spots.map((s, i) => ({
      drill_id: drillId,
      spot_order: i + 1,
      label: s.label,
      shot_type: s.shot_type,
      reps: parseInt(s.reps),
      make_quota: isQuota ? parseInt(s.make_quota) : null,
      zone: s.zone ?? null
    }))
    await supabase.from('drill_spots').insert(spotRows)

    setSaving(false)
    onSaved()
  }

  const overlay = {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
    display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
    zIndex: 50, padding: 0
  }
  const drawer = {
    background: '#0d1117', borderRadius: '20px 20px 0 0',
    width: '100%', maxWidth: 600, maxHeight: '90vh',
    overflowY: 'auto', padding: 24, boxSizing: 'border-box'
  }
  const labelStyle = { fontSize: 12, color: '#6b7280', marginBottom: 6, display: 'block' }
  const inputStyle = {
    width: '100%', background: '#111827', border: '1.5px solid #1f2937',
    borderRadius: 10, color: '#fff', fontSize: 15, padding: '10px 12px',
    outline: 'none', boxSizing: 'border-box'
  }

  return (
    <div style={overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={drawer}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ color: '#fff', fontSize: 20, fontWeight: 700, margin: 0 }}>
            {editing ? 'Edit Drill' : 'New Drill'}
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#6b7280', fontSize: 22, cursor: 'pointer' }}>✕</button>
        </div>

        {error && (
          <div style={{ background: '#7f1d1d', color: '#fca5a5', borderRadius: 8, padding: '8px 12px', fontSize: 13, marginBottom: 16 }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={labelStyle}>Drill Name</label>
            <input style={inputStyle} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. 25s" />
          </div>

          <div>
            <label style={labelStyle}>Description</label>
            <input style={inputStyle} value={description} onChange={e => setDescription(e.target.value)} placeholder="Optional" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {!isQuota && (
              <div>
                <label style={labelStyle}>Make Target</label>
                <input style={inputStyle} type="number" value={makeTarget} onChange={e => setMakeTarget(e.target.value)} placeholder="e.g. 75" />
              </div>
            )}
            <div>
              <label style={labelStyle}>Rounds</label>
              <input style={inputStyle} type="number" value={rounds} onChange={e => setRounds(e.target.value)} placeholder="e.g. 4" />
            </div>
          </div>

          {/* Drill Type */}
          <div>
            <label style={labelStyle}>Drill Type</label>
            <div style={{ display: 'flex', background: '#111827', borderRadius: 10, padding: 4, gap: 4 }}>
              {[['fixed', '🎯 Fixed Reps', 'Set shots per spot, track makes'], ['quota', '✅ Make Quota', 'Shoot until you hit a make target']].map(([key, lbl, desc]) => (
                <button key={key} onClick={() => setDrillType(key)} style={{
                  flex: 1, padding: '10px 8px', borderRadius: 8, border: 'none',
                  background: drillType === key ? '#f97316' : 'transparent',
                  color: drillType === key ? '#fff' : '#6b7280',
                  fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
                  display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center'
                }}>
                  <span>{lbl}</span>
                  <span style={{ fontSize: 10, opacity: 0.7, fontWeight: 400 }}>{desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Visibility */}
          <div>
            <label style={labelStyle}>Visibility</label>
            <div style={{ display: 'flex', background: '#111827', borderRadius: 10, padding: 4, gap: 4 }}>
              {[['public', 'Public'], ['team', 'Team Only'], ['private', 'Private']].map(([key, lbl]) => (
                <button key={key} onClick={() => setVisibility(key)} style={{
                  flex: 1, padding: '8px 0', borderRadius: 8, border: 'none',
                  background: visibility === key ? '#f97316' : 'transparent',
                  color: visibility === key ? '#fff' : '#6b7280',
                  fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s'
                }}>{lbl}</button>
              ))}
            </div>
          </div>

          {/* Tags */}
          <div>
            <label style={labelStyle}>Tags</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {TAGS.map(tag => (
                <button key={tag} onClick={() => toggleTag(tag)} style={{
                  padding: '5px 12px', borderRadius: 999, fontSize: 12, fontWeight: 600,
                  border: `1.5px solid ${tags.includes(tag) ? '#f97316' : '#1f2937'}`,
                  background: tags.includes(tag) ? '#f9731622' : 'transparent',
                  color: tags.includes(tag) ? '#f97316' : '#6b7280', cursor: 'pointer'
                }}>
                  {tag}
                </button>
              ))}
            </div>
          </div>

          {/* Spots */}
          <div>
            <label style={labelStyle}>Spots</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {spots.map((spot, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input
                    style={{ ...inputStyle, flex: 2 }}
                    value={spot.label}
                    onChange={e => updateSpot(i, 'label', e.target.value)}
                    placeholder={`Spot ${i + 1} label`}
                  />
                  <select
                    value={spot.shot_type}
                    onChange={e => updateSpot(i, 'shot_type', e.target.value)}
                    style={{ ...inputStyle, flex: 1, padding: '10px 8px' }}
                  >
                    {SHOT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  {isQuota ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                      <input
                        style={{ ...inputStyle, width: 56, flex: 'none', textAlign: 'center' }}
                        type="number"
                        value={spot.make_quota ?? 5}
                        onChange={e => updateSpot(i, 'make_quota', e.target.value)}
                        placeholder="5"
                      />
                      <span style={{ fontSize: 9, color: '#4b5563' }}>makes</span>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                      <input
                        style={{ ...inputStyle, width: 56, flex: 'none', textAlign: 'center' }}
                        type="number"
                        value={spot.reps}
                        onChange={e => updateSpot(i, 'reps', e.target.value)}
                        placeholder="5"
                      />
                      <span style={{ fontSize: 9, color: '#4b5563' }}>shots</span>
                    </div>
                  )}
                  <button onClick={() => removeSpot(i)} style={{
                    background: 'none', border: 'none', color: '#4b5563',
                    fontSize: 18, cursor: 'pointer', padding: '0 4px'
                  }}>✕</button>
                </div>
              ))}
              <button onClick={addSpot} style={{
                background: '#111827', border: '1.5px dashed #1f2937',
                borderRadius: 10, color: '#6b7280', fontSize: 13,
                padding: '10px 0', cursor: 'pointer', width: '100%'
              }}>
                + Add Spot
              </button>
            </div>
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              width: '100%', background: saving ? '#374151' : '#f97316',
              border: 'none', borderRadius: 12, color: '#fff',
              fontSize: 16, fontWeight: 700, padding: '14px 0',
              cursor: saving ? 'not-allowed' : 'pointer', marginTop: 4
            }}
          >
            {saving ? 'Saving...' : editing ? 'Save Changes' : 'Create Drill'}
          </button>
        </div>
      </div>
    </div>
  )
}

function DrillCard({ drill, lastAttempt, onEdit, onStart }) {
  return (
    <div style={{ background: '#0d1117', borderRadius: 16, padding: 18, border: '1.5px solid #1f2937' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div style={{ flex: 1 }}>
          <h3 style={{ color: '#fff', fontSize: 18, fontWeight: 700, margin: '0 0 4px' }}>{drill.name}</h3>
          {drill.description && <p style={{ color: '#6b7280', fontSize: 13, margin: 0 }}>{drill.description}</p>}
        </div>
        <button onClick={() => onEdit(drill)} style={{
          background: 'none', border: 'none', color: '#4b5563',
          fontSize: 18, cursor: 'pointer', padding: '0 0 0 8px'
        }}>✎</button>
      </div>

      <div style={{ display: 'flex', gap: 16, marginBottom: 12, flexWrap: 'wrap' }}>
        {drill.make_target && drill.drill_type !== 'quota' && (
          <span style={{ fontSize: 12, color: '#9ca3af' }}>🎯 {drill.make_target} makes</span>
        )}
        <span style={{ fontSize: 12, color: '#9ca3af' }}>🔁 {drill.rounds} rounds</span>
        <span style={{ fontSize: 11, color: '#4b5563' }}>
          {drill.drill_type === 'quota' ? '✅ Quota' : '🎯 Fixed'}
        </span>
        {lastAttempt && (
          <span style={{ fontSize: 12, color: '#6b7280' }}>
            🕐 {new Date(lastAttempt.completed_at).toLocaleDateString()} · {lastAttempt.score}/{lastAttempt.total_reps}
          </span>
        )}
        <span style={{ fontSize: 11, color: '#4b5563', textTransform: 'capitalize' }}>
          {drill.visibility === 'public' ? '🌐 Public' : drill.visibility === 'team' ? '👥 Team' : '🔒 Private'}
        </span>
      </div>

      {drill.tags?.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
          {drill.tags.map(tag => (
            <span key={tag} style={{
              fontSize: 11, padding: '3px 10px', borderRadius: 999,
              background: '#1f2937', color: '#6b7280'
            }}>{tag}</span>
          ))}
        </div>
      )}

<div style={{ display: 'flex', gap: 8 }}>
  <button onClick={() => onHistory(drill)} style={{
    flex: 1, background: '#1f2937', border: 'none',
    borderRadius: 10, color: '#9ca3af', fontSize: 14,
    fontWeight: 600, padding: '11px 0', cursor: 'pointer'
  }}>
    History
  </button>
  <button onClick={() => onStart(drill)} style={{
    flex: 2, background: '#f97316', border: 'none',
    borderRadius: 10, color: '#fff', fontSize: 14,
    fontWeight: 700, padding: '11px 0', cursor: 'pointer'
  }}>
    Start Drill
  </button>
</div>
    </div>
  )
}

export default function DrillLibrary() {
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const [drills, setDrills] = useState([])
  const [lastAttempts, setLastAttempts] = useState({})
  const [spotMeta, setSpotMeta] = useState({})
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingDrill, setEditingDrill] = useState(null)
  const [activeDrill, setActiveDrill] = useState(null)
  const [activeSpots, setActiveSpots] = useState([])

  useEffect(() => { loadDrills() }, [])

  async function loadDrills() {
    setLoading(true)

    const { data: drillData } = await supabase
      .from('drills')
      .select('*')
      .or(`visibility.eq.public,and(visibility.eq.team,team_id.eq.${profile?.team_id}),and(visibility.eq.private,created_by.eq.${user.id})`)
      .order('created_at', { ascending: false })

    if (!drillData) { setLoading(false); return }

    const { data: attempts } = await supabase
      .from('drill_attempts')
      .select('drill_id, score, total_reps, completed_at')
      .eq('player_id', user.id)
      .not('completed_at', 'is', null)
      .order('completed_at', { ascending: false })

    const lastMap = {}
    attempts?.forEach(a => { if (!lastMap[a.drill_id]) lastMap[a.drill_id] = a })

    const { data: spotData } = await supabase
      .from('drill_spots')
      .select('drill_id, reps')
      .in('drill_id', drillData.map(d => d.id))

    const metaMap = {}
    spotData?.forEach(s => {
      if (!metaMap[s.drill_id]) metaMap[s.drill_id] = { count: 0, reps: s.reps }
      metaMap[s.drill_id].count++
    })

    setDrills(drillData)
    setLastAttempts(lastMap)
    setSpotMeta(metaMap)
    setLoading(false)
  }

  async function handleStart(drill) {
    const { data: spots } = await supabase
      .from('drill_spots')
      .select('*')
      .eq('drill_id', drill.id)
      .order('spot_order')
    setActiveSpots(spots ?? [])
    setActiveDrill(drill)
  }

  function handleEdit(drill) {
    setEditingDrill(drill)
    setModalOpen(true)
  }

  function handleNew() {
    setEditingDrill(null)
    setModalOpen(true)
  }

  if (activeDrill && activeSpots.length) {
    return (
      <DrillRunner
        drill={activeDrill}
        spots={activeSpots}
        playerId={user.id}
        onComplete={() => { setActiveDrill(null); setActiveSpots([]); loadDrills() }}
      />
    )
  }

  return (
    <div style={{ minHeight: '100dvh', background: '#030712', padding: 20, boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <button onClick={() => navigate('/')} style={{
            background: 'none', border: 'none', color: '#6b7280',
            fontSize: 13, cursor: 'pointer', padding: 0, marginBottom: 4
          }}>← Today</button>
          <h1 style={{ color: '#fff', fontSize: 24, fontWeight: 800, margin: 0 }}>Drill Library</h1>
        </div>
        <button onClick={handleNew} style={{
          background: '#f97316', border: 'none', borderRadius: 10,
          color: '#fff', fontSize: 13, fontWeight: 700,
          padding: '10px 16px', cursor: 'pointer'
        }}>
          + New Drill
        </button>
      </div>

      {loading ? (
        <p style={{ color: '#4b5563', textAlign: 'center', marginTop: 60 }}>Loading...</p>
      ) : drills.length === 0 ? (
        <div style={{ textAlign: 'center', marginTop: 60 }}>
          <p style={{ color: '#4b5563', marginBottom: 16 }}>No drills yet</p>
          <button onClick={handleNew} style={{
            background: '#f97316', border: 'none', borderRadius: 10,
            color: '#fff', fontSize: 14, fontWeight: 700,
            padding: '12px 24px', cursor: 'pointer'
          }}>Create your first drill</button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {drills.map(drill => (
            <DrillCard
              key={drill.id}
              drill={{
                ...drill,
                _spotCount: spotMeta[drill.id]?.count ?? 0,
                _repsPerSpot: spotMeta[drill.id]?.reps ?? 5
              }}
              lastAttempt={lastAttempts[drill.id]}
              onEdit={handleEdit}
              onStart={handleStart}
            />
          ))}
        </div>
      )}

      {modalOpen && (
        <DrillModal
          drill={editingDrill}
          userId={user.id}
          teamId={profile?.team_id}
          onClose={() => { setModalOpen(false); setEditingDrill(null) }}
          onSaved={() => { setModalOpen(false); setEditingDrill(null); loadDrills() }}
        />
      )}
    </div>
  )
}
