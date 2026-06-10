import { useMemo } from 'react'
import { useCandidates } from '../hooks/useCandidates'
import { useAuth } from '../hooks/useAuth'
import { Link } from 'react-router-dom'
import CalendarGrid from '../components/CalendarGrid'

export default function Schedule() {
  const { user, logout } = useAuth()
  const filters = useMemo(() => ({ status: 'INTERVIEW_SCHEDULED', limit: 100 }), [])
  const { candidates, loading } = useCandidates(filters)

  const interviews = useMemo(() => {
    return candidates
      .filter((c) => c.interviewScheduledAt)
      .map((c) => ({
        id: c.id,
        title: c.name,
        email: c.email,
        start: c.interviewScheduledAt?.toDate ? c.interviewScheduledAt.toDate() : new Date(c.interviewScheduledAt),
        compositeScore: c.compositeScore || 0,
        jobId: c.jobId,
      }))
      .sort((a, b) => a.start - b.start)
  }, [candidates])

  return (
    <div className="page-container min-h-screen" id="schedule-page">
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
            <p className="text-surface-500 text-xs">Interview Schedule</p>
          </div>
        </div>

        <nav className="space-y-2 flex-1">
          <Link to="/hr" className="nav-link">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
            Dashboard
          </Link>
          <Link to="/schedule" className="nav-link nav-link-active">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            Schedule
          </Link>
        </nav>

        <div className="border-t border-surface-700/30 pt-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-full bg-primary-500/20 flex items-center justify-center text-primary-400 text-sm font-bold">
              {user?.email?.[0]?.toUpperCase() || 'H'}
            </div>
            <p className="text-surface-200 text-sm font-medium truncate">{user?.email || 'HR User'}</p>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="ml-64 p-8">
        <div className="mb-8">
          <h1 className="section-title text-3xl">Interview Schedule</h1>
          <p className="section-subtitle mt-1">{interviews.length} interviews scheduled</p>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (<div key={i} className="h-20 loading-shimmer rounded-xl" />))}
          </div>
        ) : (
          <CalendarGrid interviews={interviews} />
        )}

        {/* Upcoming List */}
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-surface-100 mb-4">Upcoming Interviews</h2>
          {interviews.length === 0 ? (
            <div className="glass-card p-10 text-center">
              <div className="text-4xl mb-3">📅</div>
              <p className="text-surface-400">No interviews scheduled yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {interviews.map((interview) => (
                <div key={interview.id} className="glass-card-hover p-5 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-primary-500/15 flex items-center justify-center text-primary-400 font-bold text-lg">
                      {interview.title?.[0]?.toUpperCase() || '?'}
                    </div>
                    <div>
                      <p className="font-semibold text-surface-100">{interview.title}</p>
                      <p className="text-surface-400 text-sm">{interview.email}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-surface-200 font-medium">
                      {interview.start.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                    </p>
                    <p className="text-primary-400 text-sm font-mono">
                      {interview.start.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <div className="text-right ml-6">
                    <p className="text-surface-400 text-xs">Score</p>
                    <p className="text-xl font-bold text-primary-400">{Math.round(interview.compositeScore)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
