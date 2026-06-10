import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import axios from 'axios'
import StatusPill from '../components/StatusPill'
import TimelineStepper from '../components/TimelineStepper'
import { Sparkles, Mail, FileText, ChevronRight, Zap, Info, Clock, AlertTriangle } from 'lucide-react'

const API_BASE = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://127.0.0.1:8001/api' : '/api')

const DIMENSION_DISPLAY = {
  technicalSkills: { label: 'Technical Skills', icon: '💻', colorClass: 'stroke-indigo-500', textClass: 'text-indigo-400', description: 'Technical expertise and coding capability fit' },
  experienceSeniority: { label: 'Experience & Seniority', icon: '📈', colorClass: 'stroke-violet-500', textClass: 'text-violet-400', description: 'Seniority alignment and target role matching' },
  assessmentPerformance: { label: 'Assessment Score', icon: '📝', colorClass: 'stroke-emerald-500', textClass: 'text-emerald-400', description: 'Performance on sandbox evaluation criteria' },
  cvQuality: { label: 'CV Structure', icon: '📄', colorClass: 'stroke-amber-500', textClass: 'text-amber-400', description: 'Clarity, format, and professional resume quality' },
  culturalFit: { label: 'Cultural Fit', icon: '🤝', colorClass: 'stroke-pink-500', textClass: 'text-pink-400', description: 'Collaboration and team alignment parameter' },
  engagement: { label: 'Engagement Rate', icon: '⚡', colorClass: 'stroke-cyan-500', textClass: 'text-cyan-400', description: 'Activity responsiveness and deadline efficiency' },
}

const DIMENSION_ORDER = [
  'technicalSkills', 'experienceSeniority', 'assessmentPerformance',
  'cvQuality', 'culturalFit', 'engagement',
]

function CircularScore({ score, label, icon, colorClass, textClass, description }) {
  const radius = 34
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (score / 100) * circumference

  return (
    <div className="bg-[#1A1A2E]/40 border border-slate-800 rounded-xl p-5 flex flex-col items-center text-center shadow-[0_0_15px_rgba(99,102,241,0.03)] hover:border-slate-700 transition-all duration-300 relative group">
      {/* SVG Circular Metric */}
      <div className="relative w-20 h-20 flex items-center justify-center">
        <svg className="w-full h-full transform -rotate-90">
          <circle cx="40" cy="40" r={radius} className="stroke-slate-850 fill-none" strokeWidth="5.5" />
          <circle 
            cx="40" 
            cy="40" 
            r={radius} 
            className={`fill-none ${colorClass} transition-all duration-1000 ease-out`} 
            strokeWidth="5.5" 
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
          />
        </svg>
        <span className="absolute text-xl">{icon}</span>
      </div>
      <span className={`text-base font-extrabold mt-3 tabular-nums ${textClass}`}>{Math.round(score)}%</span>
      <span className="text-[10px] text-slate-450 font-bold uppercase tracking-wider mt-1">{label}</span>
      
      {/* Tooltip Description */}
      <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 translate-y-full opacity-0 group-hover:opacity-100 bg-[#0F0F1A] border border-slate-800 text-[10px] text-slate-400 px-3 py-1.5 rounded-lg w-40 text-center transition-all duration-200 pointer-events-none z-30 shadow-xl mt-1">
        {description}
      </div>
    </div>
  )
}

export default function CandidatePortal() {
  const { candidateId } = useParams()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!candidateId) return

    const fetchData = async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await axios.get(`${API_BASE}/candidate-portal/${candidateId}`)
        setData(res.data)
      } catch (err) {
        if (err.response?.status === 404) {
          setError('Application link invalid or expired.')
        } else {
          setError('Unable to load application parameters. Try again later.')
        }
      } finally {
        setLoading(false)
      }
    }

    fetchData()
    /* Poll for updates every 8 seconds */
    const interval = setInterval(fetchData, 8000)
    return () => clearInterval(interval)
  }, [candidateId])

  /* Loading State */
  if (loading && !data) {
    return (
      <div className="min-h-screen bg-[#0F0F1A] text-slate-100 flex items-center justify-center">
        <div className="text-center space-y-4">
          <ActivityLoader />
          <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider animate-pulse">
            Connecting Evaluation Portal...
          </p>
        </div>
      </div>
    )
  }

  /* Error State */
  if (error) {
    return (
      <div className="min-h-screen bg-[#0F0F1A] text-slate-100 flex items-center justify-center px-4">
        <div className="bg-[#1A1A2E]/40 border border-slate-800 rounded-xl p-8 text-center max-w-md shadow-2xl backdrop-blur-xl">
          <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
          <h2 className="text-lg font-bold text-slate-200">Portal Link Invalid</h2>
          <p className="text-slate-450 text-xs mt-2 mb-6 leading-relaxed">{error}</p>
          <Link to="/" className="inline-block bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-semibold py-2.5 px-6 rounded-lg text-xs transition-all cursor-pointer">
            Create Application Profile
          </Link>
        </div>
      </div>
    )
  }

  if (!data) return null

  const dims = data.scoreDimensions || {}
  const hasDimensions = Object.keys(dims).length > 0 && Object.values(dims).some(d => d.rawScore > 0)
  const completionPct = data.completionPercentage || 0

  return (
    <div className="min-h-screen bg-[#0F0F1A] text-slate-100 font-sans relative overflow-hidden pb-12">
      {/* Background glowing effects */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-[#6366F1]/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-[#8B5CF6]/5 rounded-full blur-[120px] pointer-events-none" />

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
        body { font-family: 'Inter', sans-serif; }
      `}</style>

      {/* Header Banner */}
      <header className="relative border-b border-slate-900 bg-[#0F0F1A]/80 backdrop-blur-xl sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8.5 h-8.5 rounded-lg bg-gradient-to-tr from-indigo-500 to-violet-500 flex items-center justify-center text-white font-bold text-sm shadow-md shadow-indigo-500/20">
              RF
            </div>
            <div>
              <span className="font-bold text-slate-200 text-base">RecruitFlow</span>
              <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider ml-2 px-2 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/20">
                Candidate Portal
              </span>
            </div>
          </div>
          <StatusPill status={data.status} size="md" />
        </div>
      </header>

      {/* Main Content Area */}
      <main className="relative max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8 z-10">
        
        {/* Welcome Prominent Header */}
        <div className="bg-[#1A1A2E]/40 border border-slate-800 rounded-xl p-8 text-center shadow-[0_0_30px_rgba(99,102,241,0.03)] backdrop-blur-xl animate-slide-up">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-50 tracking-tight mb-2">
            Welcome, {data.name?.split(' ')[0] || 'Candidate'} 👋
          </h1>
          <p className="text-slate-400 text-sm max-w-md mx-auto leading-relaxed">
            Your application processing record and evaluations are updated dynamically by our machine intelligence.
          </p>

          {/* Completion Progress Bar */}
          <div className="mt-6 max-w-sm mx-auto">
            <div className="flex items-center justify-between mb-2 text-xs font-semibold">
              <span className="text-slate-450 uppercase tracking-wide">Analysis Progress</span>
              <span className="text-indigo-400">{completionPct}%</span>
            </div>
            <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-850">
              <div
                className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-violet-500 to-cyan-400 transition-all duration-1000"
                style={{ width: `${completionPct}%` }}
              />
            </div>
          </div>
        </div>

        {/* Aggregate Score Panel + CTAs */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          
          {/* Overall Performance Index */}
          <div className="lg:col-span-5 bg-[#1A1A2E]/40 border border-slate-800 rounded-xl p-6 flex flex-col items-center justify-center text-center shadow-[0_0_20px_rgba(99,102,241,0.03)] backdrop-blur-xl animate-slide-up" style={{ animationDelay: '100ms' }}>
            <h2 className="text-[10px] font-bold text-slate-450 uppercase tracking-wider mb-6">
              Overall Performance Index
            </h2>
            <div className="relative w-40 h-40 flex items-center justify-center">
              {/* SVG circular track */}
              <svg className="w-full h-full transform -rotate-90">
                <circle cx="80" cy="80" r="70" className="stroke-slate-850 fill-none" strokeWidth="8" />
                <circle 
                  cx="80" 
                  cy="80" 
                  r="70" 
                  className="stroke-indigo-500 fill-none transition-all duration-1000 ease-out" 
                  strokeWidth="8" 
                  strokeDasharray={2 * Math.PI * 70}
                  strokeDashoffset={2 * Math.PI * 70 - ((data.compositeScore || 0) / 100) * (2 * Math.PI * 70)}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute flex flex-col items-center">
                <span className="text-3xl font-extrabold text-slate-100 tabular-nums">{Math.round(data.compositeScore || 0)}</span>
                <span className="text-[9px] text-slate-500 uppercase tracking-wider font-bold mt-0.5">Rating Score</span>
              </div>
            </div>
          </div>

          {/* Quick Parameters & Assessment Launch Buttons */}
          <div className="lg:col-span-7 flex flex-col gap-4 justify-between animate-slide-up" style={{ animationDelay: '200ms' }}>
            
            {/* Quick Stat Blocks */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-[#1A1A2E]/40 border border-slate-800 rounded-xl p-5 text-center shadow-[0_0_15px_rgba(99,102,241,0.02)]">
                <p className="text-[9px] text-slate-500 uppercase tracking-wider font-bold">Screening Score</p>
                <p className={`text-2xl font-extrabold mt-1.5 tabular-nums ${
                  (data.screeningScore || 0) >= 60 ? 'text-emerald-400' : 'text-amber-400'
                }`}>
                  {Math.round(data.screeningScore || 0)}
                </p>
              </div>
              <div className="bg-[#1A1A2E]/40 border border-slate-800 rounded-xl p-5 text-center shadow-[0_0_15px_rgba(99,102,241,0.02)]">
                <p className="text-[9px] text-slate-500 uppercase tracking-wider font-bold">Assessment Score</p>
                <p className={`text-2xl font-extrabold mt-1.5 tabular-nums ${
                  (data.assessmentScore || 0) >= 60 ? 'text-emerald-400' : data.assessmentScore > 0 ? 'text-amber-400' : 'text-slate-600'
                }`}>
                  {data.assessmentScore > 0 ? Math.round(data.assessmentScore) : '—'}
                </p>
              </div>
            </div>

            {/* Assessment Sandbox trigger */}
            {data.status === 'ASSESSMENT_SENT' && data.assessmentToken && (
              <Link
                to={`/assessment/${data.assessmentToken}`}
                className="block text-center bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-semibold py-4 rounded-xl text-sm transition-all shadow-lg hover:shadow-indigo-500/20 animate-pulse border border-transparent"
                id="start-assessment-cta"
              >
                📝 Launch technical Assessment Sandbox
              </Link>
            )}

            {/* Interview scheduled notice */}
            {data.status === 'INTERVIEW_SCHEDULED' && data.interviewScheduledAt && (
              <div className="bg-[#10B981]/10 border border-[#10B981]/20 rounded-xl p-5 flex items-center gap-3">
                <span className="text-2xl">📅</span>
                <div>
                  <p className="text-emerald-450 font-bold text-sm">Interview Scheduled!</p>
                  <p className="text-slate-350 text-xs mt-0.5">
                    {new Date(data.interviewScheduledAt).toLocaleDateString('en-US', {
                      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
                    })} at {new Date(data.interviewScheduledAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            )}

            {/* Completed modules metadata block */}
            <div className="bg-[#1A1A2E]/40 border border-slate-800 rounded-xl p-5">
              <p className="text-[9px] text-slate-500 uppercase tracking-wider font-bold mb-3">Completed Modules</p>
              <div className="flex flex-wrap gap-1.5">
                {(data.completedModules || []).map((mod, idx) => (
                  <span key={idx} className="px-2.5 py-0.5 bg-emerald-500/10 text-emerald-450 border border-emerald-500/15 rounded text-[10px] font-bold">
                    ✓ {mod}
                  </span>
                ))}
                {(!data.completedModules || data.completedModules.length === 0) && (
                  <span className="text-slate-550 text-xs">Awaiting timeline milestones.</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 6 Responsive Circular Progress Metrics displaying evaluated criteria */}
        {hasDimensions && (
          <div className="animate-slide-up" style={{ animationDelay: '300ms' }}>
            <h2 className="text-sm font-bold text-slate-300 mb-5 flex items-center gap-2">
              <span className="text-lg">📊</span>
              <span>Evaluated Metric Parameters</span>
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {DIMENSION_ORDER.map((key) => {
                const dim = dims[key]
                const display = DIMENSION_DISPLAY[key]
                if (!dim) return null

                return (
                  <CircularScore
                    key={key}
                    score={dim.rawScore || 0}
                    label={display?.label || dim.label || key}
                    icon={display?.icon || '📋'}
                    colorClass={display?.colorClass || 'stroke-indigo-500'}
                    textClass={display?.textClass || 'text-indigo-400'}
                    description={display?.description || ''}
                  />
                )
              })}
            </div>
          </div>
        )}

        {/* Pipeline Timeline */}
        <div className="bg-[#1A1A2E]/40 border border-slate-800 rounded-xl p-8 animate-slide-up shadow-[0_0_20px_rgba(0,0,0,0.15)]" style={{ animationDelay: '400ms' }}>
          <h2 className="text-sm font-bold text-slate-300 mb-6 flex items-center gap-2">
            <span className="text-lg">🛤️</span>
            <span>Evaluation Milestones</span>
          </h2>
          <div className="max-w-md mx-auto">
            <TimelineStepper
              currentStatus={data.status}
              stateHistory={data.stateHistory || []}
            />
          </div>
        </div>

        {/* Support inquiries */}
        <div className="text-center py-6 animate-slide-up" style={{ animationDelay: '500ms' }}>
          <p className="text-slate-550 text-xs">
            Assistance required?{' '}
            <a href="mailto:support@recruitflow.com" className="text-indigo-400 hover:text-indigo-300 transition-colors font-medium">
              Contact Coordination Team
            </a>
          </p>
        </div>
      </main>
    </div>
  )
}

function ActivityLoader() {
  return (
    <div className="flex justify-center items-center gap-1.5 h-10">
      <div className="w-1.5 h-6 bg-indigo-500 rounded animate-[bounce_1s_infinite_100ms]" />
      <div className="w-1.5 h-8 bg-violet-500 rounded animate-[bounce_1s_infinite_200ms]" />
      <div className="w-1.5 h-6 bg-cyan-500 rounded animate-[bounce_1s_infinite_300ms]" />
    </div>
  )
}
