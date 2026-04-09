import { useLocation, useNavigate } from 'react-router-dom'

const NAV_ITEMS = [
  { path: '/',        label: 'Home',    icon: '⌂' },
  { path: '/library', label: 'Drills',  icon: '🏀' },
  { path: '/prs',     label: 'PRs',     icon: '🏆' },
  { path: '/history', label: 'History', icon: '📈' },
]

export default function BottomNav() {
  const location = useLocation()
  const navigate = useNavigate()

  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0,
      background: '#0d1117', borderTop: '1px solid #1f2937',
      display: 'flex', justifyContent: 'space-around', alignItems: 'center',
      padding: '8px 0 max(8px, env(safe-area-inset-bottom))',
      zIndex: 100
    }}>
      {NAV_ITEMS.map(({ path, label, icon }) => {
        const active = location.pathname === path
        return (
          <button
            key={path}
            onClick={() => navigate(path)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
              padding: '4px 16px', borderRadius: 10,
              opacity: active ? 1 : 0.45,
              transition: 'opacity 0.15s'
            }}
          >
            <span style={{ fontSize: 22, lineHeight: 1 }}>{icon}</span>
            <span style={{
              fontSize: 10, fontWeight: 600, letterSpacing: 0.3,
              color: active ? '#f97316' : '#9ca3af'
            }}>{label}</span>
          </button>
        )
      })}
    </div>
  )
}
