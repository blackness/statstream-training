import { supabase } from './supabase'

// All queries scoped to the shooting_tracker schema
const db = () => supabase.schema('shooting_tracker')

// ── Players ───────────────────────────────────────────
export async function getPlayers() {
  return db().from('players').select('*').order('name')
}

// ── Drill Templates ───────────────────────────────────
export async function getDrillTemplates() {
  return db().from('drill_templates').select('*').order('name')
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

// ── Sessions ──────────────────────────────────────────
export async function getSessions(playerId, limit = 60) {
  return db()
    .from('sessions')
    .select(`
      *,
      session_drills (
        id, shots_made, shots_attempted,
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

// ── Session Drills ────────────────────────────────────
export async function createSessionDrills(drills) {
  return db().from('session_drills').insert(drills).select()
}

// ── RPC ───────────────────────────────────────────────
export async function duplicateLastSession(playerId, newDate, newStart) {
  return db().rpc('duplicate_last_session', {
    p_player_id: playerId,
    p_new_date: newDate,
    p_new_start: newStart
  })
}