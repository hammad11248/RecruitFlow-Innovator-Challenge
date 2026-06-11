import React from 'react'
import { Routes, Route, NavLink, useNavigate, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import Login from './pages/Login'
import Assessment from './pages/Assessment'
import Schedule from './pages/Schedule'
import Apply from './pages/Apply'
import CandidatePortal from './pages/CandidatePortal'
import HrDashboard from './pages/HrDashboard'
import ProtectedRoute from './components/ProtectedRoute'

export function Navbar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleAuthClick = async () => {
    if (user) {
      try {
        await logout()
        navigate('/login')
      } catch (err) {
        console.error("Sign out failed:", err)
      }
    } else {
      navigate('/login')
    }
  }

  const getLinkClass = ({ isActive }) =>
    `px-3 py-2 rounded-lg text-sm font-medium transition-all ${
      isActive
        ? 'text-indigo-400 bg-indigo-500/10 font-semibold'
        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
    }`

  return (
    <header className="border-b border-slate-900 bg-slate-950/80 backdrop-blur sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* Left: Logo and Links */}
        <div className="flex items-center gap-8">
          <NavLink to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-500 to-violet-500 flex items-center justify-center font-bold text-white text-sm shadow-md shadow-indigo-500/20">
              RF
            </div>
            <span className="font-bold text-slate-200 text-lg">RecruitFlow</span>
          </NavLink>

          <nav className="hidden md:flex items-center gap-2">
            <NavLink to="/hr" className={getLinkClass}>
              Dashboard
            </NavLink>
            <NavLink to="/schedule" className={getLinkClass}>
              Schedule
            </NavLink>
          </nav>
        </div>

        {/* Right: Auth status / Actions */}
        <div className="flex items-center gap-4">
          {user && (
            <span className="text-xs text-slate-400 hidden sm:inline-block max-w-[150px] truncate">
              {user.email}
            </span>
          )}
          <button
            onClick={handleAuthClick}
            className="px-4 py-1.5 rounded-lg text-sm font-medium bg-slate-900 border border-slate-800 text-slate-300 hover:text-slate-100 hover:bg-slate-800 hover:border-slate-700 transition-all cursor-pointer"
          >
            {user ? 'Sign Out' : 'Sign In'}
          </button>
        </div>
      </div>
    </header>
  )
}

export default function App() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans">
      <Navbar />
      <Routes>
        <Route path="/" element={<Apply />} />
        <Route path="/login" element={<Login />} />
        <Route path="/candidate/:candidateId" element={<CandidatePortal />} />
        <Route path="/assessment/:token" element={<Assessment />} />
        <Route
          path="/hr"
          element={
            <ProtectedRoute>
              <HrDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard"
          element={
            <Navigate to="/hr" replace />
          }
        />
        <Route
          path="/schedule"
          element={
            <ProtectedRoute>
              <Schedule />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  )
}
