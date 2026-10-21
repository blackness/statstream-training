import { useState, useRef } from 'react'
import { Trash2 } from 'lucide-react'

const THRESHOLD = 75

export default function SwipeToDelete({ onDelete, children }) {
  const [offset, setOffset]       = useState(0)
  const [swiped, setSwiped]       = useState(false)
  const [confirming, setConfirming] = useState(false)
  const startX  = useRef(null)
  const startY  = useRef(null)
  const tracking = useRef(false)

  function handleTouchStart(e) {
    startX.current  = e.touches[0].clientX
    startY.current  = e.touches[0].clientY
    tracking.current = false
  }

  function handleTouchMove(e) {
    if (startX.current === null) return
    const deltaX = e.touches[0].clientX - startX.current
    const deltaY = e.touches[0].clientY - startY.current

    // if more vertical than horizontal on first move, ignore (allow scroll)
    if (!tracking.current) {
      if (Math.abs(deltaY) > Math.abs(deltaX)) return
      tracking.current = true
    }

    if (deltaX < 0) {
      setOffset(Math.max(deltaX, -THRESHOLD))
    } else if (swiped) {
      setOffset(Math.min(0, deltaX - THRESHOLD))
    }
  }

  function handleTouchEnd() {
    if (!tracking.current) { startX.current = null; return }
    if (offset <= -(THRESHOLD * 0.55)) {
      setOffset(-THRESHOLD)
      setSwiped(true)
    } else {
      setOffset(0)
      setSwiped(false)
    }
    startX.current = null
  }

  function handleContentClick() {
    if (swiped) {
      setOffset(0)
      setSwiped(false)
    }
  }

  function handleDeleteTap(e) {
    e.stopPropagation()
    setConfirming(true)
  }

  async function confirmDelete() {
    setConfirming(false)
    setOffset(0)
    setSwiped(false)
    await onDelete()
  }

  function cancelDelete() {
    setConfirming(false)
    setOffset(0)
    setSwiped(false)
  }

  return (
    <>
      {/* Confirm modal */}
      {confirming && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center px-6">
          <div className="bg-gray-900 rounded-2xl p-6 border border-gray-700 w-full max-w-sm shadow-2xl">
            <h2 className="text-base font-bold text-white mb-1">Delete Session?</h2>
            <p className="text-sm text-gray-400 mb-5">This cannot be undone.</p>
            <div className="flex gap-3">
              <button
                onClick={cancelDelete}
                className="flex-1 py-3 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-bold"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Swipeable row */}
      <div className="relative overflow-hidden">
        {/* Red delete button revealed behind */}
        <div
          className="absolute right-0 top-0 bottom-0 w-20 bg-red-600 flex flex-col items-center justify-center gap-1 cursor-pointer"
          onClick={handleDeleteTap}
        >
          <Trash2 size={18} className="text-white" />
          <span className="text-xs text-white font-medium">Delete</span>
        </div>

        {/* Sliding content */}
        <div
          style={{
            transform:  `translateX(${offset}px)`,
            transition: startX.current === null ? 'transform 0.2s ease' : 'none',
            position:   'relative',
            zIndex:     1,
          }}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onClick={handleContentClick}
        >
          {children}
        </div>
      </div>
    </>
  )
}