# Wiring CameraTracker into DrillRunner.jsx
# =============================================
# Make 3 small edits to your existing DrillRunner.jsx

# ── 1. Add import at the top ──────────────────────────────────────────────────

import CameraTracker from './CameraTracker'

# ── 2. Add state inside the component (after your existing useState lines) ────

const [cameraActive, setCameraActive] = useState(false)

# ── 3. Add the camera toggle button to your mode switcher row ─────────────────
# Find your existing mode switcher div (the one with by25 / byRound / bySpot)
# and add a camera button AFTER it:

<button
  onClick={() => setCameraActive(true)}
  style={{
    width: '100%',
    marginTop: 4,
    padding: '10px 0',
    borderRadius: 10,
    border: '1px solid #1f2937',
    background: 'transparent',
    color: '#6b7280',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    letterSpacing: 1,
  }}
>
  📷  AUTO-TRACK
</button>

# ── 4. Add CameraTracker just before the closing </div> of your return ─────────
# (add it right before the final closing tag of the outer div)

<CameraTracker
  drill={drill}
  makes={makes}
  shotsTaken={shotsTaken}
  onMade={() => submitRoundTotal(makes + 1)}
  onMissed={() => {}}
  onAutoComplete={onComplete}
  active={cameraActive}
  onClose={() => setCameraActive(false)}
/>

# ── 5. Install TensorFlow dependencies ────────────────────────────────────────

npm install @tensorflow/tfjs @tensorflow-models/coco-ssd

# ── Notes ─────────────────────────────────────────────────────────────────────
# - The manual +MAKE / +MISS buttons are shown on screen as fallback override
# - COCO-SSD detects "sports ball" — it will pick up a basketball reliably
# - The rim is inferred at ~32% from top of frame (typical hoop height when
#   shooting from ~15-20 feet). You can tune RIM_PROXIMITY and the inferredRim
#   y value in CameraTracker.jsx constants at the top of the file
# - Arc angle is calculated from the ball's upward trajectory — works best
#   when the phone is placed at court level facing the shooter sideways
# - For better rim detection, the next upgrade is a fine-tuned YOLO model
#   (your basketball_detector.mlpackage from earlier) via a server endpoint
