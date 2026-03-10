import { useState } from 'react'
import { supabase } from '../lib/supabase'

export function useDrill(drill, spots, playerId) {
  const isQuota = drill.drill_type === 'quota'
  const totalRounds = drill.rounds
  const totalSpots = spots.length
  const repsPerSpot = spots[0]?.reps ?? 5
  const quotaPerSpot = spots[0]?.make_quota ?? 5
  const totalMinShots = isQuota
    ? totalRounds * spots.reduce((sum, s) => sum + (s.make_quota ?? 5), 0)
    : totalRounds * totalSpots * repsPerSpot

  const [round, setRound] = useState(1)
  const [spotIndex, setSpotIndex] = useState(0)
  const [allResults, setAllResults] = useState([])
  const [roundResults, setRoundResults] = useState([])
  const [attemptId, setAttemptId] = useState(null)
  const [completed, setCompleted] = useState(false)

  const currentSpot = spots[spotIndex]
  const totalMakes = allResults.reduce((sum, r) => sum + r.makes, 0)
  const totalShotsTaken = allResults.reduce((sum, r) => sum + r.shots, 0)
  const overQuota = totalShotsTaken - totalMakes

  async function ensureAttempt() {
    if (attemptId) return attemptId
    const { data } = await supabase
      .from('drill_attempts')
      .insert({ drill_id: drill.id, player_id: playerId, total_reps: totalMinShots })
      .select('id')
      .single()
    setAttemptId(data.id)
    return data.id
  }

  async function saveShots(aId, spotIdx, makes, shotsTotal) {
    const misses = shotsTotal - makes
    const shots = [
      ...Array(makes).fill(null).map(() => ({
        attempt_id: aId, spot_order: spotIdx + 1,
        shot_type: spots[spotIdx].shot_type, zone: spots[spotIdx].zone ?? null,
        made: true, taken_at: new Date().toISOString()
      })),
      ...Array(misses).fill(null).map(() => ({
        attempt_id: aId, spot_order: spotIdx + 1,
        shot_type: spots[spotIdx].shot_type, zone: spots[spotIdx].zone ?? null,
        made: false, taken_at: new Date().toISOString()
      }))
    ]
    if (shots.length) await supabase.from('training_shots').insert(shots)
  }

  async function finishAttempt(aId, finalResults) {
    const totalMakesFinal = finalResults.reduce((sum, r) => sum + r.makes, 0)
    const totalShotsFinal = finalResults.reduce((sum, r) => sum + r.shots, 0)
    await supabase.from('drill_attempts').update({
      completed_at: new Date().toISOString(),
      score: isQuota ? totalShotsFinal - totalMakesFinal : totalMakesFinal,
      total_reps: totalShotsFinal,
      passed: isQuota ? true : totalMakesFinal >= (drill.make_target ?? 0)
    }).eq('id', aId)
    setCompleted(true)
  }

  async function advance(makes, shotsTotal, currentAllResults, currentRoundResults) {
    const aId = await ensureAttempt()
    await saveShots(aId, spotIndex, makes, shotsTotal)
    const result = { spot: spots[spotIndex], spotIndex, makes, shots: shotsTotal }
    const newRoundResults = [...currentRoundResults, result]
    const newAllResults = [...currentAllResults, result]
    const nextSpot = spotIndex + 1
    if (nextSpot < totalSpots) {
      setSpotIndex(nextSpot); setRoundResults(newRoundResults); setAllResults(newAllResults)
    } else {
      const nextRound = round + 1
      if (nextRound <= totalRounds) {
        setRound(nextRound); setSpotIndex(0); setRoundResults([]); setAllResults(newAllResults)
      } else {
        setAllResults(newAllResults)
        await finishAttempt(aId, newAllResults)
      }
    }
  }

  async function submitSpot(makes) {
    await advance(makes, repsPerSpot, allResults, roundResults)
  }

  async function submitRound(makesBySpot) {
    const aId = await ensureAttempt()
    const newResults = []
    for (let i = 0; i < makesBySpot.length; i++) {
      await saveShots(aId, i, makesBySpot[i], repsPerSpot)
      newResults.push({ spot: spots[i], spotIndex: i, makes: makesBySpot[i], shots: repsPerSpot })
    }
    const newAllResults = [...allResults, ...newResults]
    const nextRound = round + 1
    if (nextRound <= totalRounds) {
      setRound(nextRound); setSpotIndex(0); setRoundResults([]); setAllResults(newAllResults)
    } else {
      setAllResults(newAllResults); await finishAttempt(aId, newAllResults)
    }
  }

  async function submitRoundTotal(totalMakesThisRound) {
    const base = Math.floor(totalMakesThisRound / totalSpots)
    const remainder = totalMakesThisRound % totalSpots
    await submitRound(Array(totalSpots).fill(base).map((v, i) => i === totalSpots - 1 ? v + remainder : v))
  }

  async function submitQuotaSpot(shotsTaken) {
    await advance(currentSpot.make_quota ?? quotaPerSpot, shotsTaken, allResults, roundResults)
  }

  async function submitQuotaRound(shotsBySpot) {
    const aId = await ensureAttempt()
    const newResults = []
    for (let i = 0; i < shotsBySpot.length; i++) {
      const makes = spots[i].make_quota ?? quotaPerSpot
      await saveShots(aId, i, makes, shotsBySpot[i])
      newResults.push({ spot: spots[i], spotIndex: i, makes, shots: shotsBySpot[i] })
    }
    const newAllResults = [...allResults, ...newResults]
    const nextRound = round + 1
    if (nextRound <= totalRounds) {
      setRound(nextRound); setSpotIndex(0); setRoundResults([]); setAllResults(newAllResults)
    } else {
      setAllResults(newAllResults); await finishAttempt(aId, newAllResults)
    }
  }

  async function submitQuotaRoundTotal(totalShotsThisRound) {
    const base = Math.floor(totalShotsThisRound / totalSpots)
    const remainder = totalShotsThisRound % totalSpots
    await submitQuotaRound(Array(totalSpots).fill(base).map((v, i) => i === totalSpots - 1 ? v + remainder : v))
  }

  return {
    isQuota, round, totalRounds, currentSpot, spotIndex, totalSpots,
    repsPerSpot, quotaPerSpot, totalMinShots,
    makes: totalMakes, shotsTaken: totalShotsTaken, overQuota,
    completed,
    passed: isQuota ? true : totalMakes >= (drill.make_target ?? 0),
    submitSpot, submitRound, submitRoundTotal,
    submitQuotaSpot, submitQuotaRound, submitQuotaRoundTotal,
  }
}
