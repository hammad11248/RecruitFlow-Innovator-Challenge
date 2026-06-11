import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useNavigate, Link } from 'react-router-dom'
import client from '../api/client'
import { 
  Users, CheckCircle, BarChart3, Calendar, TrendingUp, Trophy, Search, RefreshCw, 
  LogOut, ArrowUpDown, ChevronRight, X, User, Briefcase, Mail, Phone, Clock, FileText, Activity 
} from 'lucide-react'
import StatusPill from '../components/StatusPill'

const STATUS_FILTERS = [
  { value: '', label: 'All', icon: '👥' },
  { value: 'PROCESSING', label: 'Processing', icon: '⏳' },
  { value: 'AI_SCREENING_PASSED', label: 'Passed', icon: '✅' },
  { value: 'AI_SCREENING_FAILED', label: 'Screened Out', icon: '❌' },
  { value: 'ASSESSMENT_SENT', label: 'Assessment', icon: '📝' },
  { value: 'ASSESSMENT_SUBMITTED', label: 'Submitted', icon: '📤' },
  { value: 'SCORED', label: 'Scored', icon: '📊' },
  { value: 'INTERVIEW_SCHEDULED', label: 'Interview', icon: '📅' },
  { value: 'REJECTED', label: 'Rejected', icon: '🚫' },
]

const DIMENSION_LABELS = {
  technicalSkills: { label: 'Technical Skills', short: 'Tech', color: 'from-blue-500 to-cyan-400', icon: '💻' },
  experienceSeniority: { label: 'Experience', short: 'Exp', color: 'from-violet-500 to-purple-400', icon: '📈' },
  assessmentPerformance: { label: 'Assessment', short: 'Assess', color: 'from-emerald-500 to-teal-400', icon: '📝' },
  cvQuality: { label: 'CV Quality', short: 'CV', color: 'from-amber-500 to-yellow-400', icon: '📄' },
  culturalFit: { label: 'Cultural Fit', short: 'Fit', color: 'from-pink-500 to-rose-400', icon: '🤝' },
  engagement: { label: 'Engagement', short: 'Eng', color: 'from-indigo-500 to-blue-400', icon: '⚡' },
}

const RANK_BADGES = {
  1: { bg: 'bg-gradient-to-r from-yellow-500 to-amber-400 border border-yellow-450 shadow-sm', text: 'text-yellow-950 font-extrabold' },
  2: { bg: 'bg-gradient-to-r from-slate-300 to-slate-400 border border-zinc-800 shadow-sm', text: 'text-zinc-400 font-extrabold' },
  3: { bg: 'bg-gradient-to-r from-amber-600 to-orange-500 border border-orange-550 shadow-sm', text: 'text-orange-950 font-extrabold' },
}

export default function HrDashboard() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  /* State */
  const [candidates, setCandidates] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [statusFilter, setStatusFilter] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState('compositeScore')
  const [sortDir, setSortDir] = useState('desc')

  /* Position/Job management states */
  const [activeTab, setActiveTab] = useState('candidates') // candidates | positions
  const [jobsList, setJobsList] = useState([])
  const [jobsLoading, setJobsLoading] = useState(false)
  const [showAddJobModal, setShowAddJobModal] = useState(false)
  const [newJobTitle, setNewJobTitle] = useState('')
  const [newJobDept, setNewJobDept] = useState('Engineering')
  const [newJobExp, setNewJobExp] = useState(5)
  const [newJobSkills, setNewJobSkills] = useState('')
  const [newJobCritical, setNewJobCritical] = useState('')
  const [newJobError, setNewJobError] = useState('')
  const [newJobSubmitting, setNewJobSubmitting] = useState(false)

  /* Drill-down drawer state */
  const [selectedCandidate, setSelectedCandidate] = useState(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [drawerLoading, setDrawerLoading] = useState(false)
  const [drawerTab, setDrawerTab] = useState('overview')

  /* Fetch leaderboard data */
  const fetchLeaderboard = async () => {
    if (!user) return
    setLoading(true)
    setError(null)
    try {
      const params = {
        sort_by: sortBy,
        sort_dir: sortDir,
        limit: 200,
      }
      if (statusFilter) params.status = statusFilter
      if (searchQuery) params.search = searchQuery

      const res = await client.get('/hr/leaderboard', { params })
      setCandidates(res.data.leaderboard || [])
    } catch (err) {
      if (err.response?.status === 401) {
        setError('Session expired. Please log in again.')
      } else {
        setError(err.response?.data?.detail || 'Failed to load candidate data.')
      }
    } finally {
      setLoading(false)
    }
  }

  /* Fetch jobs data */
  const fetchJobs = async () => {
    if (!user) return
    setJobsLoading(true)
    try {
      const res = await client.get('/jobs', { params: { active_only: false } })
      setJobsList(res.data.jobs || [])
    } catch (err) {
      console.error("Failed to fetch jobs:", err)
    } finally {
      setJobsLoading(false)
    }
  }

  const handleCreateJob = async (e) => {
    e.preventDefault()
    if (!newJobTitle || !newJobSkills) {
      setNewJobError('Please fill in title and required skills.')
      return
    }
    setNewJobSubmitting(true)
    setNewJobError('')
    try {
      const skillsArray = newJobSkills.split(',').map(s => s.trim()).filter(Boolean)
      const criticalArray = newJobCritical.split(',').map(s => s.trim()).filter(Boolean)
      
      const jobData = {
        title: newJobTitle,
        department: newJobDept,
        requiredYears: parseInt(newJobExp) || 0,
        requiredSkills: skillsArray,
        criticalSkills: criticalArray,
        preferredDomains: ["SaaS"],
        isActive: true
      }
      
      await client.post('/jobs', jobData)
      
      setNewJobTitle('')
      setNewJobSkills('')
      setNewJobCritical('')
      setShowAddJobModal(false)
      fetchJobs()
    } catch (err) {
      setNewJobError(err.response?.data?.detail || 'Failed to create position.')
    } finally {
      setNewJobSubmitting(false)
    }
  }

  useEffect(() => {
    if (!user) return
    if (activeTab === 'candidates') {
      fetchLeaderboard()
    } else {
      fetchJobs()
    }
  }, [user, activeTab, statusFilter, sortBy, sortDir])

  /* Periodic poll */
  useEffect(() => {
    const interval = setInterval(() => {
      if (activeTab === 'candidates') {
        fetchLeaderboard()
      } else {
        fetchJobs()
      }
    }, 10000)
    return () => clearInterval(interval)
  }, [activeTab, statusFilter, sortBy, sortDir])

  /* Search with debounce */
  useEffect(() => {
    const timer = setTimeout(() => {
      if (activeTab === 'candidates') {
        fetchLeaderboard()
      }
    }, 400)
    return () => clearTimeout(timer)
  }, [searchQuery, activeTab])

  /* Open drill-down */
  const openDrillDown = async (candidate) => {
    setDrawerOpen(true)
    setDrawerLoading(true)
    setDrawerTab('overview')
    try {
      const res = await client.get(`/hr/candidate/${candidate.id}/drill-down`)
      setSelectedCandidate(res.data)
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load candidate details.')
      setSelectedCandidate(candidate)
    } finally {
      setDrawerLoading(false)
    }
  }

  const closeDrillDown = () => {
    setDrawerOpen(false)
    setTimeout(() => setSelectedCandidate(null), 300)
  }

  /* Handle sort toggle */
  const handleSort = (field) => {
    if (sortBy === field) {
      setSortDir((prev) => (prev === 'desc' ? 'asc' : 'desc'))
    } else {
      setSortBy(field)
      setSortDir('desc')
    }
  }

  /* Analytics stats */
  const stats = useMemo(() => {
    const source = candidates
    const total = source.length
    const passed = source.filter(c =>
      ['AI_SCREENING_PASSED', 'ASSESSMENT_SENT', 'ASSESSMENT_SUBMITTED', 'SCORED', 'INTERVIEW_SCHEDULED'].includes(c.status)
    ).length
    const scored = source.filter(c => c.status === 'SCORED').length
    const interviews = source.filter(c => c.status === 'INTERVIEW_SCHEDULED').length
    const avgScore = total > 0
      ? source.reduce((sum, c) => sum + (c.compositeScore || 0), 0) / total
      : 0
    const topPerformer = source.length > 0 ? source[0] : null

    return { total, passed, scored, interviews, avgScore, topPerformer }
  }, [candidates])

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  const SortIcon = ({ field }) => {
    if (sortBy !== field) return <ArrowUpDown className="w-3.5 h-3.5 text-zinc-400 ml-1.5 inline" />
    return <span className="text-indigo-400 ml-1 font-bold">{sortDir === 'asc' ? '↑' : '↓'}</span>
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-400 font-sans relative overflow-hidden pb-12">
      {/* Background glowing effects */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-[#6366F1]/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-[#8B5CF6]/5 rounded-full blur-[120px] pointer-events-none" />

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
        body { font-family: 'Inter', sans-serif; }
      `}</style>

      {/* Main Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10">
        {/* Header section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-zinc-800 pb-6 mb-8">
          <div>
            <h1 className="text-3xl font-extrabold text-zinc-50 tracking-tight">
              {activeTab === 'candidates' ? 'Candidate Leaderboard' : 'Job Positions'}
            </h1>
            <p className="text-zinc-400 text-xs mt-1"> COORDINATING 6-DIMENSION AI SCREENING METRICS IN REAL-TIME </p>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-slate-900 border border-zinc-800 text-zinc-400 hover:text-red-400 hover:border-red-500/30 transition-all cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex gap-4 border-b border-zinc-800 pb-2 mb-8 relative z-10">
          <button
            onClick={() => setActiveTab('candidates')}
            type="button"
            className={`pb-2 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
              activeTab === 'candidates'
                ? 'text-indigo-400 border-b-2 border-indigo-500 font-extrabold'
                : 'text-zinc-400 hover:text-zinc-400'
            }`}
          >
            Candidates Leaderboard
          </button>
          <button
            onClick={() => setActiveTab('positions')}
            type="button"
            className={`pb-2 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
              activeTab === 'positions'
                ? 'text-indigo-400 border-b-2 border-indigo-500 font-extrabold'
                : 'text-zinc-400 hover:text-zinc-400'
            }`}
          >
            Job Positions
          </button>
        </div>

        {/* 6 Stylized Tracking Cards */}
        {activeTab === 'candidates' && (
          <div className="grid grid-cols-2 lg:grid-cols-6 gap-4 mb-8">
            {[
              { label: 'Total', value: stats.total, icon: <Users className="w-4 h-4 text-indigo-400" />, gradient: 'from-indigo-500/10 to-indigo-500/0 border-indigo-500/20' },
              { label: 'Passed', value: stats.passed, icon: <CheckCircle className="w-4 h-4 text-emerald-400" />, gradient: 'from-emerald-500/10 to-emerald-500/0 border-emerald-500/20' },
              { label: 'Scored', value: stats.scored, icon: <BarChart3 className="w-4 h-4 text-purple-400" />, gradient: 'from-purple-500/10 to-purple-500/0 border-purple-500/20' },
              { label: 'Interviews', value: stats.interviews, icon: <Calendar className="w-4 h-4 text-cyan-400" />, gradient: 'from-cyan-500/10 to-cyan-500/0 border-cyan-500/20' },
              { label: 'Avg Score', value: stats.avgScore.toFixed(1), icon: <TrendingUp className="w-4 h-4 text-amber-400" />, gradient: 'from-amber-500/10 to-amber-500/0 border-amber-500/20' },
              { label: 'Top Performer', value: stats.topPerformer?.name?.split(' ')[0] || '—', icon: <Trophy className="w-4 h-4 text-yellow-400" />, gradient: 'from-yellow-500/10 to-yellow-500/0 border-yellow-500/20' },
            ].map((stat) => (
              <div key={stat.label} className={`glass-card border rounded-xl p-5 relative overflow-hidden transition-all duration-300 hover:scale-[1.02] shadow-sm ${stat.gradient}`}>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-zinc-400 text-[10px] font-bold uppercase tracking-wider">{stat.label}</span>
                  <div className="w-7 h-7 rounded-lg bg-slate-950/40 flex items-center justify-center border border-zinc-800">
                    {stat.icon}
                  </div>
                </div>
                <p className="text-2xl font-extrabold text-zinc-400 tracking-tight">{stat.value}</p>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'candidates' && (
          <>
            {/* Integrated Search Bar with Chip Filters */}
            <div className="glass-card border border-zinc-800 rounded-xl p-5 mb-6 shadow-sm ">
              <div className="flex flex-col lg:flex-row gap-4 items-center justify-between border-b border-zinc-800/60 pb-4 mb-4">
                
                {/* Search Input */}
                <div className="relative w-full lg:w-80">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-400">
                    <Search className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    placeholder="Search candidates by name or email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="block w-full pl-10 pr-4 py-2.5 bg-zinc-800/50 border border-zinc-800 focus:border-indigo-500 rounded-lg text-zinc-400 outline-none text-xs placeholder-slate-650 transition-all focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                {/* Refresh Button */}
                <button
                  onClick={fetchLeaderboard}
                  disabled={loading}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-zinc-800/50 border border-zinc-800 hover:border-zinc-800 text-zinc-400 transition-all cursor-pointer whitespace-nowrap"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                  <span>Refresh Ingestion</span>
                </button>
              </div>

              {/* Status Chip Filters */}
              <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none flex-wrap">
                {STATUS_FILTERS.map((f) => (
                  <button
                    key={f.value}
                    onClick={() => setStatusFilter(f.value)}
                    className={`px-3.5 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider border transition-all flex items-center gap-1.5 cursor-pointer ${
                      statusFilter === f.value
                        ? 'bg-indigo-500/25 text-indigo-400 border-indigo-500/40 shadow-sm font-extrabold'
                        : 'bg-zinc-800/50 text-zinc-400 border-zinc-800 hover:text-zinc-400 hover:bg-zinc-800'
                    }`}
                  >
                    <span>{f.icon}</span>
                    <span>{f.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Error notification block */}
            {error && (
              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl mb-6 flex items-center justify-between">
                <span className="text-red-300 text-xs font-semibold">{error}</span>
                <button onClick={fetchLeaderboard} className="text-xs text-indigo-400 hover:text-indigo-300 underline font-semibold">Retry Ingestion</button>
              </div>
            )}

            {/* Table / Leaderboard Container */}
            {loading && candidates.length === 0 ? (
              <div className="space-y-4">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="h-16 glass-card border border-zinc-800/40 rounded-xl animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="glass-card border border-zinc-800 rounded-xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-zinc-800 bg-zinc-800/50 sticky top-0  z-20">
                        <th className="px-4 py-4 text-center font-bold text-zinc-400 uppercase tracking-wider w-16">Rank</th>
                        <th
                          className="px-4 py-4 font-bold text-zinc-400 uppercase tracking-wider cursor-pointer hover:text-zinc-400 select-none"
                          onClick={() => handleSort('name')}
                        >
                          Candidate <SortIcon field="name" />
                        </th>
                        <th className="px-4 py-4 font-bold text-zinc-400 uppercase tracking-wider">Status</th>
                        <th
                          className="px-4 py-4 font-bold text-zinc-400 uppercase tracking-wider text-center cursor-pointer hover:text-zinc-400 select-none"
                          onClick={() => handleSort('compositeScore')}
                        >
                          Score <SortIcon field="compositeScore" />
                        </th>
                        {/* 6 Dimension Headers (Shortened names) */}
                        {Object.entries(DIMENSION_LABELS).map(([key, { short }]) => (
                          <th key={key} className="px-3 py-4 font-bold text-zinc-400 uppercase tracking-wider text-center hidden xl:table-cell">
                            {short}
                          </th>
                        ))}
                        <th className="px-4 py-4 font-bold text-zinc-400 uppercase tracking-wider hidden lg:table-cell">Primary Skills</th>
                        <th
                          className="px-4 py-4 font-bold text-zinc-400 uppercase tracking-wider text-center cursor-pointer hover:text-zinc-400 select-none"
                          onClick={() => handleSort('createdAt')}
                        >
                          Applied <SortIcon field="createdAt" />
                        </th>
                        <th className="px-4 py-4 text-right font-bold text-zinc-400 uppercase tracking-wider">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {candidates.length === 0 ? (
                        <tr>
                          <td colSpan={12} className="px-6 py-16 text-center">
                            <Users className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
                            <p className="text-zinc-300 font-semibold text-sm">No candidates yet</p>
                            <p className="text-zinc-500 text-xs mt-1 max-w-sm mx-auto">
                              Student applications will appear here once candidates submit via the application form.
                            </p>
                            <Link to="/" className="inline-block mt-4 text-xs text-indigo-400 hover:text-indigo-300 font-semibold">
                              View Application Form →
                            </Link>
                          </td>
                        </tr>
                      ) : candidates.map((candidate, idx) => {
                        const rankNum = idx + 1
                        const rankBadge = RANK_BADGES[rankNum]
                        const dims = candidate.dimensions || candidate.scoreDimensions || {}
                        const createdAt = candidate.createdAt ? new Date(candidate.createdAt) : null

                        return (
                          <tr
                            key={candidate.id}
                            onClick={() => openDrillDown(candidate)}
                            className="border-b border-zinc-800 hover:bg-zinc-800/30 transition-colors cursor-pointer group"
                          >
                            {/* Rank Badge Indicator */}
                            <td className="px-4 py-4 text-center">
                              {rankBadge ? (
                                <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs shadow-md ${rankBadge.bg} ${rankBadge.text}`}>
                                  {rankNum}
                                </span>
                              ) : (
                                <span className="text-zinc-400 font-bold text-xs">{rankNum}</span>
                              )}
                            </td>

                            {/* Candidate Personal Detail */}
                            <td className="px-4 py-4">
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 font-extrabold text-xs group-hover:border-indigo-500/50 transition-colors">
                                  {candidate.name?.[0]?.toUpperCase() || '?'}
                                </div>
                                <div className="min-w-0">
                                  <p className="font-semibold text-zinc-400 text-sm group-hover:text-indigo-400 transition-colors truncate">
                                    {candidate.name}
                                  </p>
                                  <p className="text-zinc-400 text-[10px] tracking-wide truncate mt-0.5">{candidate.email}</p>
                                </div>
                              </div>
                            </td>

                            {/* Status */}
                            <td className="px-4 py-4">
                              <StatusPill status={candidate.status} size="sm" />
                            </td>

                            {/* Composite Score Meter */}
                            <td className="px-4 py-4 text-center">
                              <div className="flex flex-col items-center">
                                <span className={`text-base font-extrabold tabular-nums ${
                                  candidate.compositeScore >= 85 ? 'text-emerald-400' :
                                  candidate.compositeScore >= 65 ? 'text-indigo-400' :
                                  candidate.compositeScore >= 45 ? 'text-amber-400' :
                                  'text-red-400'
                                }`}>
                                  {Math.round(candidate.compositeScore || 0)}
                                </span>
                                <div className="w-10 h-1 bg-slate-850 rounded-full mt-1 overflow-hidden">
                                  <div
                                    className={`h-full rounded-full ${
                                      candidate.compositeScore >= 85 ? 'bg-emerald-400' :
                                      candidate.compositeScore >= 65 ? 'bg-indigo-400' :
                                      candidate.compositeScore >= 45 ? 'bg-amber-400' :
                                      'bg-red-400'
                                    }`}
                                    style={{ width: `${Math.min(100, candidate.compositeScore || 0)}%` }}
                                  />
                                </div>
                              </div>
                            </td>

                            {/* 6 Dimension Mini Score Indicators */}
                            {Object.entries(DIMENSION_LABELS).map(([key, { color }]) => {
                              const dimScore = dims[key]?.rawScore || 0
                              return (
                                <td key={key} className="px-3 py-4 text-center hidden xl:table-cell">
                                  <div className="flex flex-col items-center gap-1">
                                    <span className="text-[10px] font-bold text-zinc-400">{Math.round(dimScore)}</span>
                                    <div className="w-6 h-1 bg-slate-850 rounded-full overflow-hidden">
                                      <div
                                        className={`h-full rounded-full bg-gradient-to-r ${color}`}
                                        style={{ width: `${Math.min(100, dimScore)}%` }}
                                      />
                                    </div>
                                  </div>
                                </td>
                              )
                            })}

                            {/* Primary Skills */}
                            <td className="px-4 py-4 hidden lg:table-cell">
                              <div className="flex flex-wrap gap-1 max-w-[160px]">
                                {(candidate.skills || []).slice(0, 2).map((skill, idx) => (
                                  <span key={idx} className="px-1.5 py-0.5 bg-indigo-500/10 text-indigo-400 rounded text-[9px] font-bold border border-indigo-500/15">
                                    {skill}
                                  </span>
                                ))}
                                {(candidate.skills || []).length > 2 && (
                                  <span className="text-zinc-400 text-[9px] font-bold self-center px-1">
                                    +{(candidate.skills || []).length - 2}
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Applied date */}
                            <td className="px-4 py-4 text-center text-zinc-400 text-[10px] font-medium">
                              {createdAt ? createdAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}
                            </td>

                            {/* Action details trigger */}
                            <td className="px-4 py-4 text-right">
                              <span className="inline-flex items-center gap-0.5 text-indigo-400 hover:text-indigo-300 font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
                                <span>Coordinate</span>
                                <ChevronRight className="w-3.5 h-3.5" />
                              </span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}

        {/* Job Positions View */}
        {activeTab === 'positions' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center glass-card border border-zinc-800 rounded-xl p-5 shadow-sm ">
              <div>
                <h2 className="text-xl font-bold text-zinc-400">Open Job Positions</h2>
                <p className="text-zinc-400 text-xs mt-1">Configure and manage target roles for candidate evaluations</p>
              </div>
              <button
                onClick={() => setShowAddJobModal(true)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-550 border border-indigo-500 text-white rounded-lg text-xs font-bold tracking-wider hover:shadow-sm transition-all cursor-pointer flex items-center gap-1.5"
              >
                <span>+ Add Position</span>
              </button>
            </div>

            {jobsLoading && jobsList.length === 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-48 glass-card border border-zinc-800/40 rounded-xl animate-pulse" />
                ))}
              </div>
            ) : jobsList.length === 0 ? (
              <div className="glass-card border border-zinc-800 rounded-xl p-16 text-center">
                <Briefcase className="w-12 h-12 text-zinc-400 mx-auto mb-4" />
                <h3 className="text-lg font-bold text-zinc-400">No Job Positions Found</h3>
                <p className="text-zinc-400 text-xs mt-1">Create your first job position to start receiving applications</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {jobsList.map((job) => (
                  <div
                    key={job.id || job.jobId}
                    className="glass-card border border-zinc-800 hover:border-zinc-800 rounded-xl p-5 shadow-sm  transition-all duration-300 relative overflow-hidden flex flex-col justify-between"
                  >
                    <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-tr from-transparent to-indigo-500/5 rounded-bl-full pointer-events-none" />
                    
                    <div>
                      <div className="flex justify-between items-start mb-4">
                        <span className="px-2.5 py-1 bg-indigo-500/10 text-indigo-400 rounded-lg text-[10px] font-bold border border-indigo-500/15 uppercase tracking-wide">
                          {job.department}
                        </span>
                        <span className={`flex items-center gap-1 text-[10px] font-bold ${job.isActive ? 'text-emerald-400' : 'text-zinc-400'}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${job.isActive ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
                          {job.isActive ? 'ACTIVE' : 'INACTIVE'}
                        </span>
                      </div>

                      <h3 className="text-base font-bold text-zinc-400 mb-2 truncate" title={job.title}>
                        {job.title}
                      </h3>
                      
                      <div className="flex items-center gap-1.5 text-zinc-400 text-[11px] mb-4">
                        <Clock className="w-3.5 h-3.5" />
                        <span>Min Experience: {job.requiredYears} {job.requiredYears === 1 ? 'year' : 'years'}</span>
                      </div>

                      {/* Required Skills */}
                      <div className="space-y-1.5 mb-3">
                        <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Required Skills</p>
                        <div className="flex flex-wrap gap-1">
                          {(job.requiredSkills || []).map((skill, sIdx) => (
                            <span key={sIdx} className="px-1.5 py-0.5 bg-slate-900/60 border border-zinc-800 text-zinc-400 rounded text-[9px] font-medium">
                              {skill}
                            </span>
                          ))}
                          {(!job.requiredSkills || job.requiredSkills.length === 0) && (
                            <span className="text-zinc-400 text-[9px]">None specified</span>
                          )}
                        </div>
                      </div>

                      {/* Critical Skills */}
                      {job.criticalSkills && job.criticalSkills.length > 0 && (
                        <div className="space-y-1.5">
                          <p className="text-[10px] text-red-400/80 font-bold uppercase tracking-wider">Critical Skills (Double Weight)</p>
                          <div className="flex flex-wrap gap-1">
                            {job.criticalSkills.map((skill, cIdx) => (
                              <span key={cIdx} className="px-1.5 py-0.5 bg-red-950/25 border border-red-900/30 text-red-300/80 rounded text-[9px] font-medium">
                                {skill}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Add Job Modal Dialog */}
        {showAddJobModal && (
          <div className="fixed inset-0 bg-slate-950/70  z-50 flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl max-w-md w-full overflow-hidden shadow-2xl flex flex-col">
              
              {/* Modal Header */}
              <div className="p-5 border-b border-zinc-800 flex justify-between items-center bg-zinc-800/20">
                <div className="flex items-center gap-2 text-indigo-400">
                  <Briefcase className="w-5 h-5" />
                  <h3 className="font-extrabold text-zinc-400 text-sm uppercase tracking-wider">Add Job Position</h3>
                </div>
                <button
                  onClick={() => setShowAddJobModal(false)}
                  className="w-8 h-8 rounded-lg bg-slate-950/40 border border-zinc-800 hover:border-zinc-800 flex items-center justify-center text-zinc-400 hover:text-zinc-400 transition-all cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Modal Body */}
              <form onSubmit={handleCreateJob} className="p-5 space-y-4">
                {newJobError && (
                  <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-300 text-xs font-semibold">
                    {newJobError}
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Job Title *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., Senior Fullstack Engineer"
                    value={newJobTitle}
                    onChange={(e) => setNewJobTitle(e.target.value)}
                    className="block w-full px-3 py-2 bg-zinc-800/50 border border-zinc-800 focus:border-indigo-500 rounded-lg text-zinc-400 outline-none text-xs placeholder-slate-600 transition-all"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Department</label>
                    <select
                      value={newJobDept}
                      onChange={(e) => setNewJobDept(e.target.value)}
                      className="block w-full px-3 py-2 bg-zinc-800/50 border border-zinc-800 focus:border-indigo-500 rounded-lg text-zinc-400 outline-none text-xs transition-all"
                    >
                      <option value="Engineering">Engineering</option>
                      <option value="Product">Product</option>
                      <option value="Design">Design</option>
                      <option value="Marketing">Marketing</option>
                      <option value="Sales">Sales</option>
                      <option value="Operations">Operations</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Min Experience (Years)</label>
                    <input
                      type="number"
                      min="0"
                      max="30"
                      value={newJobExp}
                      onChange={(e) => setNewJobExp(e.target.value)}
                      className="block w-full px-3 py-2 bg-zinc-800/50 border border-zinc-800 focus:border-indigo-500 rounded-lg text-zinc-400 outline-none text-xs transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Required Skills * (comma-separated)</label>
                  <input
                    type="text"
                    required
                    placeholder="React, Node.js, TypeScript, PostgreSQL"
                    value={newJobSkills}
                    onChange={(e) => setNewJobSkills(e.target.value)}
                    className="block w-full px-3 py-2 bg-zinc-800/50 border border-zinc-800 focus:border-indigo-500 rounded-lg text-zinc-400 outline-none text-xs placeholder-slate-600 transition-all"
                  />
                  <p className="text-[9px] text-zinc-400 leading-normal">Required skills will trigger matching indicators during candidate screening.</p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Critical Skills (comma-separated, optional)</label>
                  <input
                    type="text"
                    placeholder="Kubernetes, Python, Rust"
                    value={newJobCritical}
                    onChange={(e) => setNewJobCritical(e.target.value)}
                    className="block w-full px-3 py-2 bg-zinc-800/50 border border-zinc-800 focus:border-indigo-500 rounded-lg text-zinc-400 outline-none text-xs placeholder-slate-600 transition-all"
                  />
                  <p className="text-[9px] text-zinc-400 leading-normal">Skills critical to the role that hold double weight in evaluations.</p>
                </div>

                {/* Form CTA Buttons */}
                <div className="flex justify-end gap-3 pt-3 border-t border-zinc-800/60 mt-4">
                  <button
                    type="button"
                    onClick={() => setShowAddJobModal(false)}
                    className="px-4 py-2 border border-zinc-800 hover:border-zinc-800 text-zinc-400 hover:text-zinc-400 rounded-lg text-xs font-semibold transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={newJobSubmitting}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-550 text-white rounded-lg text-xs font-bold transition-all disabled:opacity-50 cursor-pointer"
                  >
                    {newJobSubmitting ? 'Creating...' : 'Create Job'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>

      {/* RIGHT DRAWER: 480PX SLIDE-OUT PANEL */}
      {drawerOpen && (
        <>
          {/* Backdrop Overlay */}
          <div className="fixed inset-0 bg-slate-950/70  z-40 transition-all" onClick={closeDrillDown} />
          
          {/* Drawer Pane */}
          <div className="fixed right-0 top-0 h-full bg-zinc-900 border-l border-zinc-800 shadow-2xl z-50 transform transition-transform duration-300 translate-x-0 w-full max-w-lg md:w-[480px] flex flex-col">
            
            {/* Drawer Header */}
            <div className="p-6 border-b border-zinc-800 flex justify-between items-center bg-zinc-800/20">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 font-bold text-sm">
                  {selectedCandidate?.name?.[0]?.toUpperCase() || '?'}
                </div>
                <div>
                  <h3 className="font-extrabold text-zinc-400 text-base">{selectedCandidate?.name || 'Loading candidate...'}</h3>
                  <p className="text-zinc-400 text-[10px] tracking-wide mt-0.5">{selectedCandidate?.email}</p>
                </div>
              </div>
              <button
                onClick={closeDrillDown}
                className="w-8 h-8 rounded-lg bg-slate-950/40 border border-zinc-800 hover:border-zinc-800 flex items-center justify-center text-zinc-400 hover:text-zinc-400 transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Tab selector menu */}
            <div className="border-b border-zinc-800 px-6 bg-zinc-800/10 flex gap-4 text-xs font-semibold">
              {[
                { id: 'overview', label: 'Overview' },
                { id: 'dimensions', label: 'Dimensions' },
                selectedCandidate?.assessment && { id: 'assessment', label: 'Assessment' },
                { id: 'profile', label: 'Profile' },
                { id: 'timeline', label: 'Timeline' },
              ].filter(Boolean).map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setDrawerTab(tab.id)}
                  className={`py-3.5 border-b-2 transition-all relative ${
                    drawerTab === tab.id
                      ? 'border-indigo-500 text-indigo-400 font-bold'
                      : 'border-transparent text-zinc-400 hover:text-zinc-400'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab Contents */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              
              {drawerLoading ? (
                <div className="h-full flex flex-col items-center justify-center text-zinc-400 gap-2">
                  <Activity className="w-8 h-8 animate-pulse text-indigo-500" />
                  <span className="text-xs">Analyzing evaluation parameters...</span>
                </div>
              ) : selectedCandidate ? (
                <>
                  {/* OVERVIEW TAB */}
                  {drawerTab === 'overview' && (
                    <div className="space-y-6 animate-fade-in">
                      
                      {/* Overall Composite Score Block */}
                      <div className="p-6 bg-zinc-800/50 border border-zinc-800 rounded-xl flex items-center justify-between shadow-sm">
                        <div>
                          <p className="text-[10px] text-zinc-400 uppercase font-bold tracking-wider">Overall Match Index</p>
                          <p className="text-4xl font-extrabold text-indigo-400 mt-1">
                            {Math.round(selectedCandidate.compositeScore || 0)}
                            <span className="text-zinc-400 text-sm font-normal"> / 100</span>
                          </p>
                        </div>
                        <div className="w-14 h-14 rounded-full bg-slate-950 flex items-center justify-center border-2 border-indigo-500/20 text-indigo-400 font-extrabold text-base">
                          {Math.round(selectedCandidate.compositeScore || 0)}
                        </div>
                      </div>

                      {/* AI Matching Summary */}
                      <div className="space-y-2">
                        <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">AI Summary evaluation</h4>
                        <div className="p-5 bg-slate-900/40 border border-zinc-800 rounded-xl text-zinc-400 text-xs leading-relaxed">
                          {selectedCandidate.reviewSummary || selectedCandidate.aiSummary || 'The evaluation engine has completed parsing this applicant. Overall capability mapping conforms with initial job profile standards.'}
                        </div>
                      </div>

                      {/* Skill chips */}
                      <div className="space-y-2">
                        <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Detected Capabilities</h4>
                        <div className="flex flex-wrap gap-1.5">
                          {(selectedCandidate.skills || []).map((skill, idx) => (
                            <span key={idx} className="px-2.5 py-1 bg-zinc-800 text-indigo-400 rounded-lg text-xs font-semibold border border-indigo-500/10">
                              {skill}
                            </span>
                          ))}
                          {(!selectedCandidate.skills || selectedCandidate.skills.length === 0) && (
                            <span className="text-zinc-400 text-xs">No explicit skills mapped.</span>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* DIMENSIONS TAB */}
                  {drawerTab === 'dimensions' && (
                    <div className="space-y-6 animate-fade-in">
                      <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Evaluated Criteria Breakdown</h4>
                      <div className="space-y-4">
                        {Object.entries(DIMENSION_LABELS).map(([key, { label, color, icon }]) => {
                          const dims = selectedCandidate.dimensions || selectedCandidate.scoreDimensions || {}
                          const dimScore = dims[key]?.rawScore || 0
                          return (
                            <div key={key} className="space-y-1.5">
                              <div className="flex justify-between items-center text-xs font-semibold">
                                <span className="text-zinc-400 flex items-center gap-1.5">
                                  <span className="text-sm">{icon}</span>
                                  <span>{label}</span>
                                </span>
                                <span className="text-indigo-400">{Math.round(dimScore)}%</span>
                              </div>
                              <div className="w-full bg-slate-950 h-2.5 rounded-full overflow-hidden border border-zinc-800">
                                <div
                                  className={`h-full rounded-full bg-gradient-to-r ${color} transition-all duration-700`}
                                  style={{ width: `${Math.min(100, dimScore)}%` }}
                                />
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* PROFILE TAB */}
                  {drawerTab === 'profile' && (
                    <div className="space-y-6 animate-fade-in">
                      <div className="bg-zinc-800/20 border border-zinc-800 rounded-xl p-5 space-y-4">
                        <div className="flex items-center gap-3">
                          <Mail className="w-4 h-4 text-zinc-400" />
                          <div>
                            <p className="text-[10px] text-zinc-400 uppercase tracking-wider font-bold">Email Address</p>
                            <p className="text-xs text-zinc-400 font-semibold mt-0.5">{selectedCandidate.email}</p>
                          </div>
                        </div>

                        {selectedCandidate.phone && (
                          <div className="flex items-center gap-3">
                            <Phone className="w-4 h-4 text-zinc-400" />
                            <div>
                              <p className="text-[10px] text-zinc-400 uppercase tracking-wider font-bold">Phone Number</p>
                              <p className="text-xs text-zinc-400 font-semibold mt-0.5">{selectedCandidate.phone}</p>
                            </div>
                          </div>
                        )}

                        <div className="flex items-center gap-3">
                          <Briefcase className="w-4 h-4 text-zinc-400" />
                          <div>
                            <p className="text-[10px] text-zinc-400 uppercase tracking-wider font-bold">Position Target</p>
                            <p className="text-xs text-zinc-400 font-semibold mt-0.5">{selectedCandidate.jobId}</p>
                          </div>
                        </div>
                      </div>

                      {/* Download CV File */}
                      {selectedCandidate.cvDownloadUrl && (
                        <a
                          href={selectedCandidate.cvDownloadUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center justify-center gap-2 w-full bg-zinc-800 hover:bg-slate-900 border border-zinc-800 text-zinc-400 hover:text-zinc-400 font-semibold py-3 rounded-lg text-xs transition-all cursor-pointer"
                        >
                          <FileText className="w-4 h-4" />
                          <span>View Submitted Resume</span>
                        </a>
                      )}
                    </div>
                  )}

                  {/* ASSESSMENT TAB */}
                  {drawerTab === 'assessment' && selectedCandidate?.assessment && (
                    <div className="space-y-6 animate-fade-in text-zinc-400">
                      {/* Overall Assessment Score Summary */}
                      <div className="p-5 bg-zinc-800/50 border border-zinc-800 rounded-xl flex items-center justify-between shadow-sm">
                        <div>
                          <p className="text-[10px] text-zinc-400 uppercase font-bold tracking-wider">Assessment Status</p>
                          <p className={`text-xs font-bold mt-1 ${selectedCandidate.assessment.passed ? 'text-emerald-400' : 'text-amber-400'}`}>
                            {selectedCandidate.assessment.passed ? '✓ PASSED' : '⏱ EVALUATED / NOT PASSED'}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] text-zinc-400 uppercase font-bold tracking-wider">Assessment Score</p>
                          <p className="text-2xl font-extrabold text-indigo-400 mt-0.5">
                            {Math.round(selectedCandidate.assessment.score || 0)}
                            <span className="text-zinc-400 text-xs font-normal"> / 100</span>
                          </p>
                        </div>
                      </div>

                      {/* Question Breakdown List */}
                      <div className="space-y-4">
                        <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Question Breakdown</h4>
                        {selectedCandidate.assessment.questions?.map((q, idx) => {
                          const ansEntry = selectedCandidate.assessment.answers?.find(a => (a.questionId === q.id || a.question_id === q.id));
                          const scoreEntry = selectedCandidate.assessment.scoreBreakdown?.find(sb => (sb.questionId === q.id || sb.question_id === q.id));

                          return (
                            <div key={q.id} className="p-4 bg-zinc-800/20 border border-zinc-800 rounded-xl space-y-3">
                              {/* Header: Question Number and Type */}
                              <div className="flex justify-between items-center text-xs">
                                <span className="text-zinc-400 font-bold">
                                  Q{idx + 1}: {q.type === 'mcq' ? '📝 Multiple Choice' : q.type === 'coding' ? '💻 Coding' : '📖 Open-Ended'}
                                </span>
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  (scoreEntry?.score || 0) >= 70 ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/15' :
                                  (scoreEntry?.score || 0) >= 40 ? 'bg-amber-500/10 text-amber-400 border border-amber-500/15' :
                                  'bg-red-500/10 text-red-400 border border-red-500/15'
                                }`}>
                                  Score: {Math.round(scoreEntry?.score || 0)}/100
                                </span>
                              </div>

                              {/* Question Prompt */}
                              <p className="text-xs text-zinc-400 leading-relaxed font-medium">
                                {q.prompt}
                              </p>

                              {/* Candidate Answer */}
                              <div className="bg-slate-950/40 border border-zinc-800 rounded-lg p-3 space-y-1">
                                <p className="text-[9px] text-zinc-400 uppercase font-bold tracking-wider">Submitted Answer</p>
                                {q.type === 'coding' ? (
                                  <pre className="text-[11px] font-mono text-cyan-400 whitespace-pre-wrap overflow-x-auto leading-normal bg-slate-950/60 p-2.5 rounded border border-zinc-800">
                                    {ansEntry?.answer || '# No code submitted'}
                                  </pre>
                                ) : (
                                  <p className="text-xs text-zinc-400 leading-normal font-semibold">
                                    {ansEntry?.answer || 'No answer submitted'}
                                  </p>
                                )}
                              </div>

                              {/* Correct Answer for MCQ */}
                              {q.type === 'mcq' && q.correctAnswer && (
                                <p className="text-[10px] text-zinc-400 font-medium">
                                  Correct Option: <span className="text-emerald-400 font-bold">{q.correctAnswer}</span>
                                </p>
                              )}

                              {/* Evaluation Feedback */}
                              {scoreEntry?.feedback && (
                                <div className="border-t border-zinc-800/60 pt-2.5">
                                  <p className="text-[9px] text-indigo-400 uppercase font-bold tracking-wider mb-1">AI Evaluation Remarks</p>
                                  <p className="text-xs text-zinc-400 leading-relaxed">
                                    {scoreEntry.feedback}
                                  </p>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* TIMELINE TAB */}
                  {drawerTab === 'timeline' && (
                    <div className="space-y-6 animate-fade-in">
                      <div className="flex items-center gap-2 mb-2">
                        <Clock className="w-4 h-4 text-indigo-400" />
                        <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Application Milestones</h4>
                      </div>

                      <div className="space-y-6 relative before:absolute before:left-5 before:top-2 before:bottom-2 before:w-[2px] before:bg-slate-855 ml-2">
                        {STATUS_FILTERS.filter(f => f.value !== '').map((stepItem) => {
                          const isComplete = selectedCandidate.status === stepItem.value || 
                            (selectedCandidate.stateHistory || []).some(h => (h.state || h.status) === stepItem.value)

                          return (
                            <div key={stepItem.value} className="flex items-start gap-4 relative animate-fade-in">
                              <div
                                className={`w-10 h-10 rounded-full flex items-center justify-center text-sm border-2 z-10 ${
                                  isComplete
                                    ? 'bg-indigo-500/20 border-indigo-500 text-indigo-400 font-bold'
                                    : 'bg-slate-950 border-zinc-800 text-zinc-400'
                                }`}
                              >
                                {stepItem.icon}
                              </div>
                              <div className="pt-2">
                                <h5 className={`text-xs font-bold ${isComplete ? 'text-zinc-400' : 'text-zinc-400'}`}>
                                  {stepItem.label}
                                </h5>
                                {isComplete && (
                                  <p className="text-[10px] text-zinc-400 mt-0.5">Evaluated</p>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </>
              ) : null}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
