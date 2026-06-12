import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import client from '../api/client'
import StatusPill from '../components/StatusPill'
import TimelineStepper from '../components/TimelineStepper'
import { 
  Sparkles, Mail, FileText, ChevronRight, Zap, Info, Clock, AlertTriangle, 
  Map, BookOpen, Calendar, CheckCircle2, RefreshCw, Upload, FileCode, HelpCircle 
} from 'lucide-react'

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

const STUDY_ROADMAP = [
  {
    phase: "Phase 1",
    title: "Foundations & Architecture",
    description: "Core programming structures, version control, and modular code design.",
    topics: ["Data Structures & Core Algorithms", "Git & Collaborative Workflows", "Object-Oriented Design Patterns"]
  },
  {
    phase: "Phase 2",
    title: "Backend API Engineering",
    description: "Creating highly concurrent services and schema hierarchies.",
    topics: ["FastAPI Async Routing", "NoSQL/Firestore Database Modeling", "JWT & CORS Secure Authentication"]
  },
  {
    phase: "Phase 3",
    title: "Frontend Interface sandbox",
    description: "Responsive glassmorphic designs and modular UI state tracking.",
    topics: ["React 18 Hook Patterns", "Tailwind CSS Minimalist Layouts", "Client State & Axios Request Handlers"]
  },
  {
    phase: "Phase 4",
    title: "Deployment & Automation",
    description: "Virtualizing runtimes and orchestrating automated pipelines.",
    topics: ["Docker Containerization", "Automated GitHub Actions CI/CD", "Log Aggregation & API Audits"]
  }
]

const MIND_MAP_NODES = [
  { id: 'core', label: 'Talent Developer', x: 250, y: 130, type: 'core', color: '#6366F1', description: 'The root of your engineering study plan. Click on surrounding branches to explore.' },
  { id: 'fe', label: 'Frontend UI', x: 120, y: 80, type: 'branch', color: '#3B82F6', description: 'Master UI layout, responsive styling, and modern React architectures.' },
  { id: 'react', label: 'React 18', x: 50, y: 40, type: 'leaf', color: '#06B6D4', description: 'Virtual DOM, component lifecycles, hooks (useState, useEffect, useMemo), and code-splitting.' },
  { id: 'tailwind', label: 'Tailwind CSS', x: 60, y: 150, type: 'leaf', color: '#14B8A6', description: 'Utility-first CSS, custom themes, dark-mode tokens, flexbox/grid alignments.' },
  { id: 'be', label: 'Backend API', x: 380, y: 180, type: 'branch', color: '#8B5CF6', description: 'Build high-performance RESTful API endpoints, rate limiters, and background queues.' },
  { id: 'fastapi', label: 'FastAPI', x: 440, y: 120, type: 'leaf', color: '#A855F7', description: 'Async routing, Pydantic type validation, automatic Swagger documentation.' },
  { id: 'databases', label: 'Databases', x: 450, y: 240, type: 'leaf', color: '#EC4899', description: 'Firestore document hierarchies, querying indexes, transaction safety.' }
]

const MIND_MAP_CONNECTIONS = [
  { from: 'core', to: 'fe' },
  { from: 'fe', to: 'react' },
  { from: 'fe', to: 'tailwind' },
  { from: 'core', to: 'be' },
  { from: 'be', to: 'fastapi' },
  { from: 'be', to: 'databases' }
]

function CircularScore({ score, label, icon, colorClass, textClass, description }) {
  const radius = 34
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (score / 100) * circumference

  return (
    <div className="glass-card border border-zinc-800 rounded-xl p-4 flex flex-col items-center text-center shadow-sm relative group transition-all duration-350 hover:border-zinc-700 bg-zinc-900/40">
      <div className="relative w-16 h-16 flex items-center justify-center">
        <svg className="w-full h-full transform -rotate-90">
          <circle cx="32" cy="32" r={radius} className="stroke-zinc-800 fill-none" strokeWidth="4.5" />
          <circle 
            cx="32" 
            cy="32" 
            r={radius} 
            className={`fill-none ${colorClass} transition-all duration-1000 ease-out`} 
            strokeWidth="4.5" 
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
          />
        </svg>
        <span className="absolute text-lg">{icon}</span>
      </div>
      <span className={`text-sm font-bold mt-2.5 tabular-nums ${textClass}`}>{Math.round(score)}%</span>
      <span className="text-[9px] text-zinc-500 font-extrabold uppercase tracking-wider mt-1">{label}</span>
      
      <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 translate-y-full opacity-0 group-hover:opacity-100 bg-zinc-950 border border-zinc-800 text-[10px] text-zinc-400 px-3 py-1.5 rounded-lg w-40 text-center transition-all duration-200 pointer-events-none z-30 shadow-xl mt-1">
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
  
  // Custom states for roadmap/mindmap details
  const [selectedNode, setSelectedNode] = useState(MIND_MAP_NODES[0])
  const [selectedRoadmapIndex, setSelectedRoadmapIndex] = useState(0)

  // Uploader state variables
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadSuccess, setUploadSuccess] = useState(false)
  const [uploadError, setUploadError] = useState('')

  const fetchData = async () => {
    if (!candidateId) return
    try {
      const res = await client.get(`/candidate-portal/${candidateId}`)
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

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 8000)
    return () => clearInterval(interval)
  }, [candidateId])

  const handleFileChange = (e) => {
    const selected = e.target.files[0]
    if (selected) {
      const ext = selected.name.split('.').pop().toLowerCase()
      if (!['pdf', 'docx'].includes(ext)) {
        setUploadError('Only PDF and DOCX files are accepted.')
        return
      }
      if (selected.size > 10 * 1024 * 1024) {
        setUploadError('File must be under 10MB.')
        return
      }
      setFile(selected)
      setUploadError('')
      setUploadSuccess(false)
    }
  }

  const handleResumeSubmit = async (e) => {
    e.preventDefault()
    if (!file || !data) return
    setUploading(true)
    setUploadError('')
    setUploadSuccess(false)
    setUploadProgress(15)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('name', data.name)
      formData.append('email', data.email)
      formData.append('phone', data.phone || '')
      formData.append('jobId', data.jobId || '')

      setUploadProgress(45)
      await client.post('/candidates/upload', formData, {
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            setUploadProgress(Math.round((progressEvent.loaded / progressEvent.total) * 100))
          }
        }
      })

      setUploadSuccess(true)
      setFile(null)
      fetchData() // Refresh details
    } catch (err) {
      setUploadError(err.response?.data?.detail || 'Re-upload failed. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  if (loading && !data) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-400 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="flex justify-center items-center gap-1.5 h-10">
            <div className="w-1.5 h-6 bg-indigo-500 rounded animate-[bounce_1s_infinite_100ms]" />
            <div className="w-1.5 h-8 bg-violet-500 rounded animate-[bounce_1s_infinite_200ms]" />
            <div className="w-1.5 h-6 bg-cyan-500 rounded animate-[bounce_1s_infinite_300ms]" />
          </div>
          <p className="text-zinc-500 text-xs font-semibold uppercase tracking-wider animate-pulse">
            Connecting Evaluation Portal...
          </p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-400 flex items-center justify-center px-4">
        <div className="glass-card border border-zinc-800 rounded-xl p-8 text-center max-w-md shadow-2xl bg-zinc-900/30">
          <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
          <h2 className="text-lg font-bold text-zinc-300">Portal Link Invalid</h2>
          <p className="text-zinc-500 text-xs mt-2 mb-6 leading-relaxed">{error}</p>
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
    <div className="min-h-screen bg-zinc-950 text-zinc-300 font-sans relative overflow-hidden pb-16">
      {/* Glow overlays */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-[#6366F1]/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-[#8B5CF6]/5 rounded-full blur-[120px] pointer-events-none" />

      {/* Local styles for smooth rendering */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&display=swap');
        body { font-family: 'Outfit', sans-serif; }
      `}</style>

      {/* Header navbar */}
      <header className="relative border-b border-zinc-900 bg-zinc-950/80 backdrop-blur sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8.5 h-8.5 rounded-lg bg-gradient-to-tr from-indigo-500 to-violet-500 flex items-center justify-center text-white font-bold text-sm shadow-md">
              RF
            </div>
            <div>
              <span className="font-bold text-zinc-100 text-base">RecruitFlow</span>
              <span className="text-[9px] text-indigo-400 font-bold uppercase tracking-wider ml-2.5 px-2 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/20">
                Student Portal
              </span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <StatusPill status={data.status} size="md" />
            <Link to="/login" className="text-zinc-500 hover:text-zinc-300 text-xs font-medium border border-zinc-800 rounded-lg px-3 py-1.5 transition-colors">
              Sign Out
            </Link>
          </div>
        </div>
      </header>

      {/* Dash Main Panel */}
      <main className="relative max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8 z-10">
        
        {/* Welcome Section */}
        <div className="glass-card border border-zinc-800 bg-zinc-900/20 rounded-xl p-8 flex flex-col md:flex-row items-center justify-between gap-6 shadow-sm">
          <div className="space-y-2 max-w-xl text-center md:text-left">
            <h1 className="text-3xl sm:text-4xl font-extrabold text-zinc-100 tracking-tight">
              Welcome back, {data.name?.split(' ')[0] || 'Student'}! 👋
            </h1>
            <p className="text-zinc-400 text-sm leading-relaxed">
              Monitor your screening progress, view your personalized roadmap, explore the interactive mind map, and manage tasks.
            </p>
          </div>
          
          {/* Progress Circle Card */}
          <div className="flex items-center gap-4 bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-4 px-6">
            <div className="relative w-14 h-14 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90">
                <circle cx="28" cy="28" r="24" className="stroke-zinc-800 fill-none" strokeWidth="4.5" />
                <circle 
                  cx="28" 
                  cy="28" 
                  r="24" 
                  className="stroke-indigo-500 fill-none transition-all duration-1000 ease-out" 
                  strokeWidth="4.5" 
                  strokeDasharray={2 * Math.PI * 24}
                  strokeDashoffset={2 * Math.PI * 24 - (completionPct / 100) * (2 * Math.PI * 24)}
                  strokeLinecap="round"
                />
              </svg>
              <span className="absolute text-xs font-bold text-zinc-200">{completionPct}%</span>
            </div>
            <div>
              <p className="text-xs text-zinc-500 uppercase tracking-wider font-extrabold">Evaluation Status</p>
              <p className="text-sm font-semibold text-zinc-300 mt-0.5">Analysis Running</p>
            </div>
          </div>
        </div>

        {/* Dashboard Grid splits */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* LEFT: ROADMAP & MIND MAP (8 COLS) */}
          <div className="lg:col-span-8 space-y-8">
            
            {/* Interactive Mind Map Area */}
            <div className="glass-card border border-zinc-800 bg-zinc-900/10 rounded-xl p-6 shadow-sm">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-4 mb-4">
                <h2 className="text-base font-bold text-zinc-200 flex items-center gap-2">
                  <Map className="w-5 h-5 text-indigo-400" />
                  Interactive Mind Map Area
                </h2>
                <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Expand & Explore</span>
              </div>
              <p className="text-zinc-400 text-xs mb-4">
                Click on the circular nodes in the mind map diagram below to display dynamic learning resources, tips, and key concepts.
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-stretch">
                
                {/* SVG Visual map */}
                <div className="md:col-span-7 bg-zinc-950/80 border border-zinc-800 rounded-xl p-3 flex items-center justify-center min-h-[300px] relative overflow-hidden">
                  <svg viewBox="0 0 500 300" className="w-full h-full max-h-[280px]">
                    {/* Draw Connection Lines */}
                    {MIND_MAP_CONNECTIONS.map((conn, idx) => {
                      const fromNode = MIND_MAP_NODES.find(n => n.id === conn.from)
                      const toNode = MIND_MAP_NODES.find(n => n.id === conn.to)
                      if (!fromNode || !toNode) return null
                      const isSelected = selectedNode?.id === fromNode.id || selectedNode?.id === toNode.id
                      return (
                        <line
                          key={idx}
                          x1={fromNode.x}
                          y1={fromNode.y}
                          x2={toNode.x}
                          y2={toNode.y}
                          stroke={isSelected ? '#6366F1' : '#27272A'}
                          strokeWidth={isSelected ? '2' : '1.2'}
                          className="transition-all duration-300"
                        />
                      )
                    })}

                    {/* Render Node Rings & Dots */}
                    {MIND_MAP_NODES.map((node) => {
                      const isSelected = selectedNode?.id === node.id
                      const isCore = node.type === 'core'
                      const isBranch = node.type === 'branch'
                      const size = isCore ? 14 : isBranch ? 10 : 8

                      return (
                        <g 
                          key={node.id} 
                          onClick={() => setSelectedNode(node)} 
                          className="cursor-pointer group"
                        >
                          <circle
                            cx={node.x}
                            cy={node.y}
                            r={size + 5}
                            fill="transparent"
                            className="group-hover:stroke-indigo-500/20 stroke-transparent"
                            strokeWidth="4"
                          />
                          <circle
                            cx={node.x}
                            cy={node.y}
                            r={size}
                            fill={isSelected ? '#FFFFFF' : node.color}
                            stroke={isSelected ? node.color : 'transparent'}
                            strokeWidth="3.5"
                            className="transition-all duration-300"
                          />
                          <text
                            x={node.x}
                            y={node.y - size - 6}
                            textAnchor="middle"
                            fill={isSelected ? '#F4F4F5' : '#71717A'}
                            fontSize="9"
                            fontWeight={isSelected ? '700' : '400'}
                            className="transition-all duration-300 select-none"
                          >
                            {node.label}
                          </text>
                        </g>
                      )
                    })}
                  </svg>
                </div>
                
                {/* Node Detail Viewer */}
                <div className="md:col-span-5 flex flex-col justify-between bg-zinc-900/30 border border-zinc-800 rounded-xl p-5">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: selectedNode?.color }} />
                      <span className="text-sm font-bold text-zinc-205">{selectedNode?.label}</span>
                    </div>
                    <p className="text-zinc-400 text-xs leading-relaxed">
                      {selectedNode?.description}
                    </p>
                  </div>
                  <div className="pt-4 border-t border-zinc-800/80 mt-4 text-[10px] text-zinc-500 flex items-center gap-1.5">
                    <HelpCircle className="w-3.5 h-3.5" />
                    <span>Select other nodes to expand details.</span>
                  </div>
                </div>

              </div>
            </div>

            {/* Personalized Study Roadmap */}
            <div className="glass-card border border-zinc-800 bg-zinc-900/10 rounded-xl p-6 shadow-sm">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-4 mb-4">
                <h2 className="text-base font-bold text-zinc-200 flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-indigo-400" />
                  Personalized Study Roadmap
                </h2>
                <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider">Milestone track</span>
              </div>
              <p className="text-zinc-400 text-xs mb-5">
                Here is your customized educational program mapped directly to standard platform requirements.
              </p>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
                {STUDY_ROADMAP.map((step, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedRoadmapIndex(idx)}
                    type="button"
                    className={`p-3 text-left border rounded-lg transition-all cursor-pointer ${
                      selectedRoadmapIndex === idx
                        ? 'border-indigo-500 bg-indigo-500/5 text-indigo-400'
                        : 'border-zinc-800 bg-zinc-900/40 hover:border-zinc-700 text-zinc-400'
                    }`}
                  >
                    <span className="text-[9px] uppercase font-bold tracking-wider">{step.phase}</span>
                    <h4 className="text-xs font-bold truncate mt-0.5">{step.title}</h4>
                  </button>
                ))}
              </div>

              {/* Active Roadmap step details */}
              <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5 space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-zinc-250">
                    {STUDY_ROADMAP[selectedRoadmapIndex].phase}: {STUDY_ROADMAP[selectedRoadmapIndex].title}
                  </h3>
                  <p className="text-zinc-400 text-xs mt-1 leading-relaxed">
                    {STUDY_ROADMAP[selectedRoadmapIndex].description}
                  </p>
                </div>
                
                <div className="space-y-2">
                  <p className="text-[10px] text-zinc-505 font-extrabold uppercase tracking-wider">Roadmap Objectives</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {STUDY_ROADMAP[selectedRoadmapIndex].topics.map((topic, i) => (
                      <div key={i} className="flex items-center gap-2.5 bg-zinc-950/60 border border-zinc-800/60 p-2.5 px-3 rounded-lg">
                        <CheckCircle2 className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                        <span className="text-xs text-zinc-300">{topic}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

            </div>

          </div>
          
          {/* RIGHT: PORTAL STATUS, UPLOADER, SCHEDULES (4 COLS) */}
          <div className="lg:col-span-4 space-y-8">
            
            {/* Rating Scores Circle Display */}
            {hasDimensions && (
              <div className="glass-card border border-zinc-800 bg-zinc-900/10 rounded-xl p-6 shadow-sm">
                <h3 className="text-sm font-bold text-zinc-200 border-b border-zinc-800 pb-3 mb-4">
                  Evaluated Parameters
                </h3>
                <div className="grid grid-cols-2 gap-3">
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

            {/* Resume upload module */}
            <div className="glass-card border border-zinc-800 bg-zinc-900/10 rounded-xl p-6 shadow-sm">
              <h3 className="text-sm font-bold text-zinc-200 border-b border-zinc-800 pb-3 mb-4 flex items-center gap-2">
                <Upload className="w-4 h-4 text-indigo-400" />
                Resume Upload Module
              </h3>
              
              <form onSubmit={handleResumeSubmit} className="space-y-4">
                {uploadError && (
                  <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-lg p-2.5">
                    <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                    <span className="text-red-355 text-[10px] font-semibold">{uploadError}</span>
                  </div>
                )}
                
                {uploadSuccess && (
                  <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    <span className="text-emerald-300 text-[10px] font-semibold">Resume uploaded and parsing enqueued!</span>
                  </div>
                )}

                <div className="relative border-2 border-dashed border-zinc-805 rounded-lg p-5 text-center bg-zinc-950/20 hover:border-zinc-700 transition-colors">
                  <input
                    type="file"
                    accept=".pdf,.docx"
                    onChange={handleFileChange}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                    id="resume-reupload"
                  />
                  {file ? (
                    <div className="space-y-1">
                      <FileText className="w-6 h-6 text-indigo-400 mx-auto" />
                      <p className="text-[11px] font-bold text-zinc-300 truncate max-w-[150px] mx-auto">{file.name}</p>
                      <p className="text-[9px] text-zinc-550">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <Upload className="w-5 h-5 text-zinc-500 mx-auto" />
                      <p className="text-[11px] font-semibold text-zinc-400">Drag or click to re-upload</p>
                      <p className="text-[9px] text-zinc-500">PDF or DOCX (Max 10MB)</p>
                    </div>
                  )}
                </div>

                {uploading && (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[10px] font-bold text-zinc-500">
                      <span>Uploading...</span>
                      <span>{uploadProgress}%</span>
                    </div>
                    <div className="w-full h-1 bg-zinc-900 rounded-full overflow-hidden">
                      <div className="h-full bg-indigo-500 transition-all duration-305" style={{ width: `${uploadProgress}%` }} />
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={!file || uploading}
                  className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
                >
                  {uploading ? 'Processing file...' : 'Submit Updated CV'}
                </button>
              </form>
            </div>

            {/* Active Assessment schedule component */}
            <div className="glass-card border border-zinc-800 bg-zinc-900/10 rounded-xl p-6 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-zinc-200 border-b border-zinc-800 pb-3">
                Active Assessment Schedules
              </h3>

              {data.status === 'ASSESSMENT_SENT' && data.assessmentToken ? (
                <div className="space-y-3 bg-indigo-500/5 border border-indigo-500/20 rounded-xl p-4">
                  <div className="flex items-center gap-2.5">
                    <FileCode className="w-5 h-5 text-indigo-400" />
                    <div>
                      <h4 className="text-xs font-bold text-zinc-200">Sandbox Coding Test</h4>
                      <p className="text-[9px] text-zinc-400 mt-0.5">Duration: 120 mins</p>
                    </div>
                  </div>
                  <Link
                    to={`/assessment/${data.assessmentToken}`}
                    className="block w-full text-center bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold py-2.5 rounded-lg transition-colors cursor-pointer"
                  >
                    Start Code Assessment
                  </Link>
                </div>
              ) : data.assessmentScore > 0 ? (
                <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4 flex items-center gap-2.5">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                  <div>
                    <h4 className="text-xs font-bold text-zinc-200">Assessment Completed</h4>
                    <p className="text-[9px] text-zinc-400 mt-0.5">Rating: {Math.round(data.assessmentScore)}%</p>
                  </div>
                </div>
              ) : (
                <div className="bg-zinc-950/40 border border-zinc-850 rounded-xl p-4 text-center text-xs text-zinc-500 py-6">
                  No coding test active currently.
                </div>
              )}

              {/* Interview scheduled display */}
              {data.status === 'INTERVIEW_SCHEDULED' && data.interviewScheduledAt ? (
                <div className="bg-[#10B981]/5 border border-[#10B981]/20 rounded-xl p-4 space-y-2">
                  <div className="flex items-center gap-2.5">
                    <Calendar className="w-5 h-5 text-emerald-400" />
                    <div>
                      <h4 className="text-xs font-bold text-zinc-200">Technical Interview</h4>
                      <p className="text-[9px] text-zinc-400 mt-0.5">Live developer sandbox</p>
                    </div>
                  </div>
                  <p className="text-[10px] text-zinc-300 font-medium">
                    Scheduled on: {new Date(data.interviewScheduledAt).toLocaleDateString('en-US', {
                      weekday: 'short', month: 'short', day: 'numeric'
                    })} at {new Date(data.interviewScheduledAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              ) : null}
            </div>

            {/* Milestones timeline */}
            <div className="glass-card border border-zinc-800 bg-zinc-900/10 rounded-xl p-6 shadow-sm">
              <h3 className="text-sm font-bold text-zinc-200 border-b border-zinc-800 pb-3 mb-4">
                Milestones
              </h3>
              <TimelineStepper
                currentStatus={data.status}
                stateHistory={data.stateHistory || []}
              />
            </div>

          </div>

        </div>

      </main>
    </div>
  )
}
