import React, { useState, useEffect } from 'react'
import { Routes, Route } from 'react-router-dom'
import FileUpload from './components/FileUpload'
import Dashboard from './components/Dashboard'
import Login from './pages/Login'
import Assessment from './pages/Assessment'
import Schedule from './pages/Schedule'
import ProtectedRoute from './components/ProtectedRoute'
import { Sparkles } from 'lucide-react'

const API_BASE = 'http://127.0.0.1:8001'

// 🔌 Connection debug test — fires once on app load
function useBackendConnectionTest() {
  useEffect(() => {
    fetch(`${API_BASE}/api/health`)
      .then(res => res.json())
      .then(data => {
        console.log('%c✅ Backend Connected', 'color: #22c55e; font-weight: bold', data)
      })
      .catch(err => {
        console.error('%c❌ Backend Unreachable', 'color: #ef4444; font-weight: bold', err.message)
        console.warn('Make sure uvicorn is running: python -m uvicorn backend.main:app --host 127.0.0.1 --port 8001')
      })
  }, [])
}

function RecruitFlowFunnel() {
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  useBackendConnectionTest() // 🔌 Debug: logs connection status to browser console

  const handleUploadSuccess = (candidate) => {
    setRefreshTrigger(prev => prev + 1)
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-indigo-500 selection:text-white pb-12">
      {/* Header Banner */}
      <header className="border-b border-slate-900 bg-slate-950/80 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-500 to-violet-500 flex items-center justify-center font-bold text-white text-sm shadow-md shadow-indigo-500/20">
              RF
            </div>
            <div>
              <span className="font-bold text-slate-200 text-lg">RecruitFlow</span>
              <span className="text-xs text-indigo-400 font-semibold uppercase tracking-wider ml-2 px-2 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/20">Free Tier</span>
            </div>
          </div>
          <div className="flex items-center gap-1 text-slate-400 text-xs hover:text-slate-200 cursor-default">
            <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
            <span>Autonomous HR Pipeline</span>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 mt-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* File Upload Section (Left Pane) */}
          <div className="lg:col-span-4 lg:sticky lg:top-24">
            <FileUpload onUploadSuccess={handleUploadSuccess} />
          </div>

          {/* Candidate Dashboard Section (Right Pane) */}
          <div className="lg:col-span-8">
            <Dashboard refreshTrigger={refreshTrigger} />
          </div>
        </div>
      </main>
    </div>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<RecruitFlowFunnel />} />
      <Route path="/login" element={<Login />} />
      <Route path="/assessment/:token" element={<Assessment />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <RecruitFlowFunnel />
          </ProtectedRoute>
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
    </Routes>
  )
}
