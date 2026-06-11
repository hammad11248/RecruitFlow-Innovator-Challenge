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
        ? 'text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 font-semibold'
        : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60'
    }`

  return (
    <header className="border-b border-zinc-800/80 bg-zinc-950/90 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <NavLink to="/" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-500 to-violet-500 flex items-center justify-center font-bold text-white text-sm shadow-[0_0_16px_rgba(99,102,241,0.3)] group-hover:shadow-[0_0_20px_rgba(99,102,241,0.45)] transition-shadow">
              RF
            </div>
            <span className="font-bold text-zinc-100 text-lg tracking-tight">RecruitFlow</span>
          </NavLink>

          <nav className="hidden md:flex items-center gap-1">
            <NavLink to="/hr" className={getLinkClass}>
              Dashboard
            </NavLink>
            <NavLink to="/schedule" className={getLinkClass}>
              Schedule
            </NavLink>
          </nav>
        </div>

        <div className="flex items-center gap-4">
          {user && (
            <span className="text-xs text-zinc-500 hidden sm:inline-block max-w-[180px] truncate">
              {user.email}
            </span>
          )}
          <button
            onClick={handleAuthClick}
            className="px-4 py-1.5 rounded-lg text-sm font-medium bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800 hover:border-zinc-700 transition-all cursor-pointer"
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
    <div className="page-container font-sans">
      <Navbar />
      <Routes>
        <Route path="/" element={<Apply />} />
        <Route path="/login" element={<Login />} />
        <Route
          path="/candidate/:candidateId"
          element={
            <ProtectedRoute allowedRoles={['candidate', 'recruiter', 'interviewer', 'hr_manager']}>
              <CandidatePortal />
            </ProtectedRoute>
          }
        />
        <Route
          path="/assessment/:token"
          element={
            <ProtectedRoute allowedRoles={['candidate', 'recruiter', 'interviewer', 'hr_manager']}>
              <Assessment />
            </ProtectedRoute>
          }
        />
        <Route
          path="/hr"
          element={
            <ProtectedRoute allowedRoles={['recruiter', 'interviewer', 'hr_manager']}>
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
            <ProtectedRoute allowedRoles={['recruiter', 'interviewer', 'hr_manager']}>
              <Schedule />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  )
}
