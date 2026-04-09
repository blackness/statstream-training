/**
 * CameraTracker.jsx
 *
 * Drop into your project at src/components/drill/CameraTracker.jsx
 *
 * Usage inside DrillRunner — add a camera toggle button and render:
 *   <CameraTracker
 *     drill={drill}
 *     makes={makes}
 *     shotsTaken={shotsTaken}
 *     onMade={() => submitRoundTotal(makes + 1)}   // or whichever submit fn fits
 *     onMissed={() => submitRoundTotal(makes)}
 *     onAutoComplete={onComplete}
 *     active={cameraActive}
 *     onClose={() => setCameraActive(false)}
 *   />
 *
 * Dependencies (all browser-native or CDN, no install needed):
 *   - @tensorflow/tfjs          (npm install @tensorflow/tfjs)
 *   - @tensorflow-models/coco-ssd (npm install @tensorflow-models/coco-ssd)
 *
 * Install:
 *   npm install @tensorflow/tfjs @tensorflow-models/coco-ssd
 */

import { useEffect, useRef, useState, useCallback } from 'react'

// ─── Constants ────────────────────────────────────────────────────────────────

const HISTORY_FRAMES   = 24   // frames to keep for trajectory analysis
const MIN_BALL_CONF    = 0.35  // minimum COCO confidence for "sports ball"
const RIM_PROXIMITY    = 0.18  // fraction of frame width to consider "near rim"
const DOWNWARD_THRESH  = 4     // px/frame to consider ball moving downward
const ARC_IDEAL_MIN    = 42    // ideal release angle degrees
const ARC_IDEAL_MAX    = 58
const AUTO_COMPLETE_DELAY = 1200  // ms after target hit before closing

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getCenter(box) {
  // COCO-SSD box: [x, y, width, height]
  return { x: box[0] + box[2] / 2, y: box[1] + box[3] / 2, w: box[2], h: box[3] }
}

function calcAngle(p1, p2) {
  const dx = p2.x - p1.x
  const dy = p1.y - p2.y  // inverted because canvas y goes down
  return Math.round(Math.atan2(dy, Math.abs(dx)) * (180 / Math.PI))
}

function calcArcQuality(angle) {
  if (angle >= ARC_IDEAL_MIN && angle <= ARC_IDEAL_MAX) return 'great'
  if (angle >= 35 && angle < ARC_IDEAL_MIN) return 'low'
  if (angle > ARC_IDEAL_MAX && angle <= 65) return 'high'
  return 'poor'
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function CameraTracker({
  drill,
  makes,
  shotsTaken,
  onMade,
  onMissed,
  onAutoComplete,
  active,
  onClose,
}) {
  const videoRef    = useRef(null)
  const canvasRef   = useRef(null)
  const modelRef    = useRef(null)
  const rafRef      = useRef(null)
  const historyRef  = useRef([])   // [{x,y,frame}]
  const rimRef      = useRef(null) // last known rim position
  const shotRef     = useRef({ pending: false, frame: 0 })
  const frameRef    = useRef(0)
  const streamRef   = useRef(null)

  const [status, setStatus]         = useState('loading') // loading | ready | error
  const [localMakes, setLocalMakes] = useState(makes)
  const [localShots, setLocalShots] = useState(shotsTaken)
  const [arcAngle, setArcAngle]     = useState(null)
  const [arcQuality, setArcQuality] = useState(null)
  const [lastEvent, setLastEvent]   = useState(null) // 'made' | 'missed'
  const [rimDetected, setRimDetected] = useState(false)
  const [autoCompleting, setAutoCompleting] = useState(false)

  const pct = localShots > 0 ? Math.round((localMakes / localShots) * 100) : 0
  const target = drill?.make_target ?? null

  // ── Load model + camera ───────────────────────────────────────────────────

  useEffect(() => {
    if (!active) return
    let cancelled = false

    async function init() {
      try {
        setStatus('loading')

        // Lazy-load TF + COCO-SSD only when camera is opened
        const tf      = await import('@tensorflow/tfjs')
        const cocoSsd = await import('@tensorflow-models/coco-ssd')

        await tf.ready()
        const model = await cocoSsd.load({ base: 'lite_mobilenet_v2' })
        if (cancelled) return
        modelRef.current = model

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        })
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return }
        streamRef.current = stream

        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
        }

        setStatus('ready')
        startLoop()
      } catch (err) {
        console.error('CameraTracker init error:', err)
        setStatus('error')
      }
    }

    init()
    return () => {
      cancelled = true
      stopLoop()
      streamRef.current?.getTracks().forEach(t => t.stop())
    }
  }, [active])

  // ── Detection loop ────────────────────────────────────────────────────────

  function startLoop() {
    async function loop() {
      if (!videoRef.current || !modelRef.current || !canvasRef.current) {
        rafRef.current = requestAnimationFrame(loop)
        return
      }
      const video  = videoRef.current
      const canvas = canvasRef.current
      const ctx    = canvas.getContext('2d')

      canvas.width  = video.videoWidth  || 640
      canvas.height = video.videoHeight || 360

      // Draw mirrored video frame
ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

      // Run detection
      const predictions = await modelRef.current.detect(canvas)
      console.log(predictions) // ← add this
      frameRef.current++

      const ball = predictions
        .filter(p => p.class === 'sports ball' && p.score >= MIN_BALL_CONF)
        .sort((a, b) => b.score - a.score)[0]

      // Use person bounding box top as a rough rim proxy if no dedicated rim detected
      // (COCO-SSD doesn't detect rims — we infer position from context)
      // A better model would label rims explicitly; for now we use a fixed rim zone
      // at ~35% from top of frame as default hoop position when shooting from typical angle
      const inferredRim = {
        x: canvas.width * 0.5,
        y: canvas.height * 0.32,
        w: canvas.width * 0.12,
        h: canvas.height * 0.04,
      }
      rimRef.current = inferredRim
      setRimDetected(true)

      if (ball) {
        const center = getCenter(ball.bbox)
        historyRef.current.push({ x: center.x, y: center.y, frame: frameRef.current })
        if (historyRef.current.length > HISTORY_FRAMES) historyRef.current.shift()

        // Draw ball indicator
        ctx.beginPath()
        ctx.arc(center.x, center.y, center.w / 2 + 4, 0, 2 * Math.PI)
        ctx.strokeStyle = '#f97316'
        ctx.lineWidth   = 3
        ctx.stroke()

        // Arc analysis — use last 8 frames of upward motion
        const history = historyRef.current
        if (history.length >= 8) {
          const upFrames = history.slice(-8).filter((p, i, arr) => i === 0 || p.y < arr[i - 1].y)
          if (upFrames.length >= 4) {
            const oldest = upFrames[0]
            const newest = upFrames[upFrames.length - 1]
            const angle  = calcAngle(oldest, newest)
            if (angle > 0) {
              setArcAngle(angle)
              setArcQuality(calcArcQuality(angle))
            }
          }
        }

        // Shot detection
        processShot(center, inferredRim, canvas)
      }

      // Draw rim zone (subtle)
      ctx.beginPath()
      ctx.ellipse(inferredRim.x, inferredRim.y, inferredRim.w, inferredRim.h, 0, 0, 2 * Math.PI)
      ctx.strokeStyle = 'rgba(251,191,36,0.4)'
      ctx.lineWidth   = 2
      ctx.stroke()

      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)
  }

  function stopLoop() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
  }

  // ── Shot logic ────────────────────────────────────────────────────────────

  function processShot(ballCenter, rim, canvas) {
    const history = historyRef.current
    if (history.length < 5) return

    const recent = history.slice(-5)
    const dy     = recent[recent.length - 1].y - recent[0].y
    const movingDown = dy > DOWNWARD_THRESH

    const proximityX = Math.abs(ballCenter.x - rim.x)
    const proximityY = Math.abs(ballCenter.y - rim.y)
    const threshold  = canvas.width * RIM_PROXIMITY
    const nearRim    = proximityX < threshold && proximityY < canvas.height * 0.15

    const shot = shotRef.current

    if (nearRim && movingDown && !shot.pending) {
      shot.pending = true
      shot.frame   = frameRef.current
    }

    if (shot.pending && frameRef.current - shot.frame > 4) {
      const passedThrough = proximityX < rim.w * 0.9 && ballCenter.y > rim.y + rim.h
      const cleared       = ballCenter.y > rim.y + canvas.height * 0.12

      if (passedThrough) {
        registerMake()
        resetShot()
      } else if (cleared) {
        registerMiss()
        resetShot()
      }
    }
  }

  function resetShot() {
    shotRef.current = { pending: false, frame: 0 }
    historyRef.current = []
  }

  function registerMake() {
    setLocalMakes(m => {
      const next = m + 1
      onMade?.()
      setLastEvent('made')
      setTimeout(() => setLastEvent(null), 1200)

      // Auto-complete check
      if (target && next >= target) {
        setAutoCompleting(true)
        setTimeout(() => onAutoComplete?.(), AUTO_COMPLETE_DELAY)
      }
      return next
    })
    setLocalShots(s => s + 1)
  }

  function registerMiss() {
    setLocalShots(s => s + 1)
    onMissed?.()
    setLastEvent('missed')
    setTimeout(() => setLastEvent(null), 1200)
  }

  // ── UI ────────────────────────────────────────────────────────────────────

  if (!active) return null

  const arcColor = {
    great: '#4ade80',
    low:   '#facc15',
    high:  '#fb923c',
    poor:  '#f87171',
  }[arcQuality] ?? '#6b7280'

  const arcLabel = {
    great: '✓ Perfect arc',
    low:   '↑ Arc too flat',
    high:  '↓ Arc too high',
    poor:  '⚠ Check release',
  }[arcQuality] ?? ''

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: '#000',
      display: 'flex', flexDirection: 'column',
      fontFamily: "'Barlow Condensed', 'Arial Narrow', sans-serif",
    }}>

      {/* Camera canvas */}
      <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
      <video ref={videoRef} style={{ display: 'none' }} playsInline muted />

      {/* Loading overlay */}
      {status === 'loading' && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, background: 'rgba(0,0,0,0.85)' }}>
          <div style={{ width: 48, height: 48, border: '3px solid #f97316', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          <div style={{ color: '#9ca3af', fontSize: 18, fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase' }}>Loading detector...</div>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {/* Error overlay */}
      {status === 'error' && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, background: 'rgba(0,0,0,0.9)' }}>
          <div style={{ fontSize: 48 }}>📷</div>
          <div style={{ color: '#f87171', fontSize: 20, fontWeight: 700 }}>Camera unavailable</div>
          <div style={{ color: '#6b7280', fontSize: 14, textAlign: 'center', maxWidth: 260 }}>Make sure you've allowed camera access in your browser settings</div>
          <button onClick={onClose} style={{ marginTop: 8, background: '#f97316', border: 'none', borderRadius: 10, color: '#fff', fontSize: 15, fontWeight: 700, padding: '12px 32px', cursor: 'pointer' }}>Close</button>
        </div>
      )}

      {/* Top bar */}
      {status === 'ready' && (
        <div style={{ position: 'relative', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', background: 'linear-gradient(to bottom, rgba(0,0,0,0.75), transparent)' }}>
          <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
            {/* Makes */}
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 36, fontWeight: 900, color: '#fff', lineHeight: 1 }}>{localMakes}</div>
              <div style={{ fontSize: 11, color: '#9ca3af', letterSpacing: 1, textTransform: 'uppercase' }}>Makes</div>
            </div>
            {/* Divider */}
            <div style={{ width: 1, height: 36, background: 'rgba(255,255,255,0.15)' }} />
            {/* Pct */}
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 36, fontWeight: 900, color: pct >= 50 ? '#4ade80' : '#f97316', lineHeight: 1 }}>{pct}%</div>
              <div style={{ fontSize: 11, color: '#9ca3af', letterSpacing: 1, textTransform: 'uppercase' }}>FG%</div>
            </div>
            {/* Divider */}
            <div style={{ width: 1, height: 36, background: 'rgba(255,255,255,0.15)' }} />
            {/* Shots */}
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 36, fontWeight: 900, color: '#fff', lineHeight: 1 }}>{localShots}</div>
              <div style={{ fontSize: 11, color: '#9ca3af', letterSpacing: 1, textTransform: 'uppercase' }}>Shots</div>
            </div>
          </div>

          {/* Close */}
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 10, color: '#fff', fontSize: 13, fontWeight: 700, padding: '8px 16px', cursor: 'pointer', backdropFilter: 'blur(8px)', letterSpacing: 1 }}>
            CLOSE
          </button>
        </div>
      )}

      {/* Target progress bar */}
      {status === 'ready' && target && (
        <div style={{ position: 'relative', zIndex: 10, padding: '0 20px' }}>
          <div style={{ background: 'rgba(0,0,0,0.4)', borderRadius: 999, height: 6, overflow: 'hidden', backdropFilter: 'blur(4px)' }}>
            <div style={{ height: '100%', borderRadius: 999, background: 'linear-gradient(90deg, #f97316, #fbbf24)', width: `${Math.min(100, (localMakes / target) * 100)}%`, transition: 'width 0.4s ease' }} />
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', textAlign: 'right', marginTop: 4, letterSpacing: 1 }}>
            {localMakes} / {target} TARGET
          </div>
        </div>
      )}

      {/* Arc feedback */}
      {status === 'ready' && arcAngle !== null && (
        <div style={{ position: 'absolute', zIndex: 10, bottom: 100, left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(12px)', borderRadius: 12, padding: '10px 20px', border: `1px solid ${arcColor}40`, textAlign: 'center', minWidth: 160 }}>
          <div style={{ fontSize: 28, fontWeight: 900, color: arcColor, lineHeight: 1 }}>{arcAngle}°</div>
          <div style={{ fontSize: 12, color: arcColor, letterSpacing: 1, marginTop: 2 }}>{arcLabel}</div>
          <div style={{ fontSize: 10, color: '#4b5563', marginTop: 4 }}>RELEASE ANGLE</div>
        </div>
      )}

      {/* Rim detected indicator */}
      {status === 'ready' && (
        <div style={{ position: 'absolute', zIndex: 10, top: 90, left: 20, display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: rimDetected ? '#4ade80' : '#6b7280', boxShadow: rimDetected ? '0 0 8px #4ade80' : 'none' }} />
          <div style={{ fontSize: 11, color: rimDetected ? '#4ade80' : '#6b7280', letterSpacing: 1, textTransform: 'uppercase' }}>{rimDetected ? 'Rim locked' : 'Finding rim...'}</div>
        </div>
      )}

      {/* Made / Missed flash */}
      {lastEvent && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 20,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          pointerEvents: 'none',
          animation: 'fadeOut 1.2s ease forwards',
        }}>
          <div style={{
            fontSize: 72, fontWeight: 900,
            color: lastEvent === 'made' ? '#4ade80' : '#f87171',
            textShadow: `0 0 40px ${lastEvent === 'made' ? '#4ade8080' : '#f8717180'}`,
            letterSpacing: -2,
            animation: 'popIn 0.25s ease',
          }}>
            {lastEvent === 'made' ? '🏀 MADE' : '✗ MISS'}
          </div>
        </div>
      )}

      {/* Auto-complete overlay */}
      {autoCompleting && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 30, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.85)', gap: 16 }}>
          <div style={{ fontSize: 64 }}>🏆</div>
          <div style={{ fontSize: 32, fontWeight: 900, color: '#4ade80', letterSpacing: -1 }}>TARGET HIT!</div>
          <div style={{ fontSize: 18, color: '#9ca3af' }}>{localMakes} makes · {pct}%</div>
        </div>
      )}

      {/* Manual override buttons (bottom) */}
      {status === 'ready' && (
        <div style={{ position: 'absolute', zIndex: 10, bottom: 32, left: 0, right: 0, display: 'flex', gap: 12, padding: '0 20px', justifyContent: 'center' }}>
          <button
            onClick={registerMiss}
            style={{ flex: 1, maxWidth: 160, padding: '14px 0', background: 'rgba(248,113,113,0.15)', border: '1px solid rgba(248,113,113,0.4)', borderRadius: 14, color: '#f87171', fontSize: 15, fontWeight: 800, cursor: 'pointer', letterSpacing: 1, backdropFilter: 'blur(8px)' }}
          >
            + MISS
          </button>
          <button
            onClick={registerMake}
            style={{ flex: 1, maxWidth: 160, padding: '14px 0', background: 'rgba(74,222,128,0.15)', border: '1px solid rgba(74,222,128,0.4)', borderRadius: 14, color: '#4ade80', fontSize: 15, fontWeight: 800, cursor: 'pointer', letterSpacing: 1, backdropFilter: 'blur(8px)' }}
          >
            + MAKE
          </button>
        </div>
      )}

      <style>{`
        @keyframes fadeOut { 0% { opacity: 1 } 60% { opacity: 1 } 100% { opacity: 0 } }
        @keyframes popIn   { 0% { transform: scale(0.6) } 100% { transform: scale(1) } }
      `}</style>
    </div>
  )
}
