import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Login from './pages/Login'
import Today from './pages/Today'
import DrillLibrary from './pages/DrillLibrary'
import History from './pages/History'

export default function App() {
  const { user, loading } = useAuth()

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#030712' }}>
      <p style={{ color: '#4b5563' }}>Loading...</p>
    </div>
  )

  return (
    <Routes>
      <Route path="/login" element={!user ? <Login /> : <Navigate to="/" />} />
      <Route path="/" element={user ? <Today /> : <Navigate to="/login" />} />
      <Route path="/library" element={user ? <DrillLibrary /> : <Navigate to="/login" />} />
      <Route path="/history" element={user ? <History /> : <Navigate to="/login" />} />
    </Routes>
  )
}
