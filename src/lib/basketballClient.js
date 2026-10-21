import { supabase } from './supabase'

const db = () => supabase.schema('shooting_tracker')

export async function getPlayers() {
  return db().from('players').select('*').order('name')
}

export async function getDrillTemplates() {
  return db()
    .from('drill_templates')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('name',       { ascending: true })
}

export async function createDrillTemplate(payload) {
  return db().from('drill_templates').insert([payload]).select().single()
}

export async function updateDrillTemplate(id, payload) {
  return db().from('drill_templates').update(payload).eq('id', id).select().single()
}

export async function deleteDrillTemplate(id) {
  return db().from('drill_templates').delete().eq('id', id)
}

export async function saveDrillTemplateOrder(orderedTemplates) {
  // orderedTemplates: [{ id, sort_order }, ...]
  const updates = orderedTemplates.map(({ id, sort_order }) =>
    db().from('drill_templates').update({ sort_order }).eq('id', id)
  )
  return Promise.all(updates)
}

export async function getSessions(playerId, limit = 60) {
  return db()
    .from('sessions')
    .select(`
      *,
      session_drills (
        id, shots_made, shots_attempted, sort_order,
        drill_template_id, contested, notes,
        drill_templates ( name, goal_percent )
      )
    `)
    .eq('player_id', playerId)
    .order('session_date', { ascending: false })
    .limit(limit)
}

export async function createSession(payload) {
  return db().from('sessions').insert([payload]).select().single()
}

export async function createSessionDrills(drills) {
  return db().from('session_drills').insert(drills).select()
}

export async function duplicateLastSession(playerId, newDate, newStart) {
  return db().rpc('duplicate_last_session', {
    p_player_id: playerId,
    p_new_date:  newDate,
    p_new_start: newStart,
  })
}