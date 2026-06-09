import { useState, useMemo } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useCandidates } from '../hooks/useCandidates'
import { useNavigate, Link } from 'react-router-dom'
import CandidateTable from '../components/CandidateTable'
import CandidateDrawer from '../components/CandidateDrawer'
import StatusPill from '../components/StatusPill'

const STATUS_FILTERS = [
  { value: '', label: 'All Candidates' },
  { value: 'PROCESSING', label: 'Processing' },
  { value: 'AI_SCREENING_PASSED', label: 'Screening Passed' },
  { value: 'AI_SCREENING_FAILED', label: 'Screening Failed' },
  { value: 'ASSESSMENT_SENT', label: 'Assessment Sent' },
  { value: 'ASSESSMENT_SUBMITTED', label: 'Submitted' },
  { value: 'SCORED', label: 'Scored' },
  { value: 'INTERVIEW_SCHEDULED', label: 'Interview' },
  { value: 'REJECTED', label: 'Rejected' },
]

export default function Dashboard() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [statusFilter, setStatusFilter] = useState('')
  const [selectedCandidate, setSelectedCandidate] = useState(null)
  const [drawerOpen, setDrawerOpen] = useState(false)

  const filters = useMemo(() => ({
    status: statusFilter || undefined,
    limit: 100,
  }), [statusFilter])

  const { candidates, loading, error } = useCandidates(filters)

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  const openDrawer = (candidate) => {
    setSelectedCandidate(candidate)
    setDrawerOpen(true)
  }

  const closeDrawer = () => {
    setDrawerOpen(false)
    setTimeout(() => setSelectedCandidate(null), 300)
  }

  // Stats
  const stats = useMemo(() => {
    const total = candidates.length
    const passed = candidates.filter((c) => ['AI_SCREENING_PASSED', 'ASSESSMENT_SENT', 'ASSESSMENT_SUBMITTED', 'SCORED', 'INTERVIEW_SCHEDULED'].includes(c.status)).length
    const interviews = candidates.filter((c) => c.status === 'INTERVIEW_SCHEDULED').length
    const avgScore = total > 0 ? candidates.reduce((sum, c) => sum + (c.compositeScore || 0), 0) / total : 0
    return { total, passed, interviews, avgScore }
  }, [candidates])

  return (
    <div className="page-container min-h-screen" id="dashboard-page">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 h-full w-64 glass-sidebar p-6 flex flex-col z-30">
        <div className="flex items-center gap-3 mb-10">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-violet-500 flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          </div>
          <div>
            <p className="font-bold text-surface-100 text-sm">HR Recruitment</p>
            <p className="text-surface-500 text-xs">Enterprise Dashboard</p>
          </div>
        </div>

        <nav className="space-y-2 flex-1">
          <Link to="/dashboard" className="nav-link nav-link-active">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
            Dashboard
          </Link>
          <Link to="/schedule" className="nav-link">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            Schedule
          </Link>
        </nav>

        <div className="border-t border-surface-700/30 pt-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-full bg-primary-500/20 flex items-center justify-center text-primary-400 text-sm font-bold">
              {user?.email?.[0]?.toUpperCase() || 'H'}
            </div>
            <div className="overflow-hidden">
              <p className="text-surface-200 text-sm font-medium truncate">{user?.email || 'HR User'}</p>
            </div>
          </div>
          <button onClick={handleLogout} className="text-surface-500 text-sm hover:text-rose-400 transition-colors flex items-center gap-2" id="logout-btn">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="ml-64 p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="section-title text-3xl">Recruitment Dashboard</h1>
          <p className="section-subtitle mt-1">Real-time candidate pipeline overview</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-5 mb-8">
          {[
            { label: 'Total Candidates', value: stats.total, icon: '👥', color: 'from-indigo-600 to-violet-500' },
            { label: 'Passed Screening', value: stats.passed, icon: '✅', color: 'from-emerald-600 to-teal-500' },
            { label: 'Interviews Scheduled', value: stats.interviews, icon: '📅', color: 'from-cyan-600 to-blue-500' },
            { label: 'Avg. Composite Score', value: stats.avgScore.toFixed(1), icon: '📊', color: 'from-purple-600 to-fuchsia-500' },
          ].map((stat) => (
            <div key={stat.label} className="glass-card-hover p-6 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-white/5 to-white/0 rounded-full blur-2xl transition-all duration-300 group-hover:scale-150" />
              <div className="flex items-center justify-between mb-4">
                <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${stat.color} flex items-center justify-center text-xl shadow-lg shadow-primary-500/10`}>
                  {stat.icon}
                </div>
              </div>
              <p className="text-3xl font-extrabold text-surface-50 tracking-tight">{stat.value}</p>
              <p className="text-surface-400 text-sm font-medium mt-1.5">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 mb-6 flex-wrap">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${statusFilter === f.value ? 'bg-primary-500/20 text-primary-400 border border-primary-500/30' : 'text-surface-400 hover:text-surface-200 hover:bg-surface-800/50 border border-transparent'}`}
              id={`filter-${f.value || 'all'}`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Candidates Table */}
        {loading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 loading-shimmer rounded-xl" />
            ))}
          </div>
        ) : error ? (
          <div className="glass-card p-10 text-center">
            <p className="text-rose-400 mb-2">Error loading candidates</p>
            <p className="text-surface-500 text-sm">{error}</p>
          </div>
        ) : (
          <CandidateTable candidates={candidates} onSelectCandidate={openDrawer} />
        )}
      </main>

      {/* Candidate Drawer */}
      <CandidateDrawer candidate={selectedCandidate} open={drawerOpen} onClose={closeDrawer} />
    </div>
  )
}
