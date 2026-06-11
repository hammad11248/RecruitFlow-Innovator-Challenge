import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import client from '../api/client'
import StatusPill from '../components/StatusPill'
import { Upload, FileText, CheckCircle2, AlertCircle, Loader2, User, Mail, Phone, Sparkles, Zap } from 'lucide-react'

const PIPELINE_STEPS = [
  { key: 'UPLOADED', label: 'Uploaded', icon: '📄' },
  { key: 'PROCESSING', label: 'AI Processing', icon: '🤖' },
  { key: 'AI_SCREENING_PASSED', label: 'Screening Passed', icon: '✅' },
  { key: 'ASSESSMENT_SENT', label: 'Assessment Sent', icon: '📝' },
  { key: 'ASSESSMENT_SUBMITTED', label: 'Submitted', icon: '📤' },
  { key: 'SCORED', label: 'Scored', icon: '📊' },
  { key: 'INTERVIEW_SCHEDULED', label: 'Interview Scheduled', icon: '📅' },
]

export default function Apply() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [jobId, setJobId] = useState('')
  const [jobs, setJobs] = useState([])
  const [file, setFile] = useState(null)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploading, setUploading] = useState(false)
  const [candidateId, setCandidateId] = useState(null)
  const [candidateStatus, setCandidateStatus] = useState(null)
  const [error, setError] = useState('')
  const [step, setStep] = useState('form') // form | uploading | tracking
  const [dragActive, setDragActive] = useState(false)

  // Tracking Lookup states
  const [lookupEmail, setLookupEmail] = useState('')
  const [lookupLoading, setLookupLoading] = useState(false)
  const [lookupError, setLookupError] = useState('')

  // Fetch available jobs
  useEffect(() => {
    client.get('/jobs')
      .then((res) => {
        setJobs(res.data.jobs || [])
        if (res.data.jobs?.length > 0) {
          setJobId(res.data.jobs[0].id)
        }
      })
      .catch((err) => {
        console.error("Failed to load jobs:", err)
      })
  }, [])

  // Real-time candidate status tracking via short-polling HTTP client
  useEffect(() => {
    if (!candidateId) return

    let active = true
    const fetchStatus = async () => {
      try {
        const res = await client.get(`/candidate-portal/${candidateId}`)
        if (active) {
          setCandidateStatus(res.data)
        }
      } catch (err) {
        console.error("Failed to fetch candidate status:", err)
      }
    }

    fetchStatus()
    const interval = setInterval(fetchStatus, 5000)

    return () => {
      active = false
      clearInterval(interval)
    }
  }, [candidateId])

  const handleDrag = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true)
    } else if (e.type === "dragleave") {
      setDragActive(false)
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0]
      const ext = droppedFile.name.split('.').pop().toLowerCase()
      if (['pdf', 'docx'].includes(ext)) {
        setFile(droppedFile)
        setError('')
      } else {
        setError('Please upload a PDF or DOCX file.')
      }
    }
  }

  const handleFileChange = (e) => {
    const selected = e.target.files[0]
    if (selected) {
      const ext = selected.name.split('.').pop().toLowerCase()
      if (!['pdf', 'docx'].includes(ext)) {
        setError('Please upload a PDF or DOCX file.')
        return
      }
      if (selected.size > 10 * 1024 * 1024) {
        setError('File size must be under 10MB.')
        return
      }
      setFile(selected)
      setError('')
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!file) {
      setError('Please select a CV file to upload.')
      return
    }
    if (!name || !email) {
      setError('Please fill in your name and email.')
      return
    }

    setUploading(true)
    setStep('uploading')
    setError('')

    try {
      // Directly call FastAPI to create candidate and start pipeline
      // We skip the redundant client-side Firebase storage write
      const formData = new FormData()
      formData.append('file', file)
      formData.append('name', name)
      formData.append('email', email)
      formData.append('phone', phone)
      formData.append('jobId', jobId)

      const response = await client.post('/candidates/upload', formData, {
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const progress = Math.round(
              (progressEvent.loaded / progressEvent.total) * 100
            )
            setUploadProgress(progress)
          } else {
            setUploadProgress(50)
          }
        }
      })

      setCandidateId(response.data.candidateId)
      setStep('tracking')
    } catch (err) {
      setError(err.response?.data?.detail || 'Upload failed. Please try again.')
      setStep('form')
    } finally {
      setUploading(false)
    }
  }

  const handleLookup = async (e) => {
    e.preventDefault()
    if (!lookupEmail) {
      setLookupError('Please enter your email.')
      return
    }
    setLookupLoading(true)
    setLookupError('')
    try {
      const response = await client.get(`/candidate/lookup?email=${encodeURIComponent(lookupEmail)}`)
      if (response.data?.candidateId) {
        setCandidateId(response.data.candidateId)
        setStep('tracking')
      } else {
        setLookupError('No application found with this email.')
      }
    } catch (err) {
      setLookupError(err.response?.data?.detail || 'No application found with this email.')
    } finally {
      setLookupLoading(false)
    }
  }

  const getCurrentStepIndex = () => {
    const status = candidateStatus?.status
    const idx = PIPELINE_STEPS.findIndex((s) => s.key === status)
    return idx >= 0 ? idx : -1
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-400 font-sans relative overflow-hidden px-4 py-8 md:py-16">
      {/* Background glowing effects */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-indigo-500/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-violet-500/5 rounded-full blur-[120px] pointer-events-none" />

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
        body { font-family: 'Inter', sans-serif; }
      `}</style>

      <div className="max-w-6xl mx-auto z-10 relative">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-full text-xs font-semibold mb-4 tracking-wide uppercase">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Autonomous Ingestion Pipeline</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold text-zinc-400 tracking-tight">
            Apply to <span className="bg-gradient-to-r from-indigo-400 via-violet-400 to-cyan-400 bg-clip-text text-transparent">RecruitFlow</span>
          </h1>
          <p className="text-zinc-400 mt-3 text-base md:text-lg max-w-lg mx-auto">
            Submit your credentials and monitor the real-time evaluation process.
          </p>
        </div>

        {/* High-tech Split Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* LEFT COLUMN: UPLOAD WORKFLOW */}
          <div className="lg:col-span-5 glass-card  border border-zinc-800 rounded-xl p-6 md:p-8 shadow-sm">
            {step === 'form' && (
              <div className="space-y-6">
                <form onSubmit={handleSubmit} className="space-y-6" id="apply-form">
                  <div className="border-b border-zinc-800 pb-4 mb-4">
                    <h2 className="text-lg font-bold text-zinc-400 flex items-center gap-2">
                      <User className="w-5 h-5 text-indigo-400" />
                      Applicant Credentials
                    </h2>
                  </div>

                  {error && (
                    <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/20 rounded-xl p-3.5 animate-fade-in">
                      <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                      <span className="text-red-300 text-xs font-medium">{error}</span>
                    </div>
                  )}

                  {/* Floating Label: Full Name */}
                  <div className="relative z-0 w-full group">
                    <input
                      type="text"
                      id="apply-name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      placeholder=" "
                      className="block py-2.5 px-0 w-full text-sm text-zinc-400 bg-transparent border-0 border-b-2 border-zinc-800 appearance-none focus:outline-none focus:ring-0 focus:border-indigo-500 transition-all peer"
                    />
                    <label
                      htmlFor="apply-name"
                      className="peer-focus:font-medium absolute text-sm text-zinc-400 duration-300 transform -translate-y-6 scale-75 top-3 -z-10 origin-[0] peer-focus:start-0 peer-focus:text-indigo-400 peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-focus:scale-75 peer-focus:-translate-y-6"
                    >
                      Full Name
                    </label>
                  </div>

                  {/* Email Address */}
                  <div className="space-y-2">
                    <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                      Email Address
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-400">
                        <Mail className="w-4 h-4" />
                      </div>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        required
                        className="block w-full pl-10 pr-4 py-3 bg-zinc-800/50 border border-zinc-800 focus:border-indigo-500 rounded-lg text-zinc-400 outline-none text-sm placeholder-slate-650 transition-all focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                  </div>

                  {/* Floating Label: Phone */}
                  <div className="relative z-0 w-full group">
                    <input
                      type="tel"
                      id="apply-phone"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder=" "
                      className="block py-2.5 px-0 w-full text-sm text-zinc-400 bg-transparent border-0 border-b-2 border-zinc-800 appearance-none focus:outline-none focus:ring-0 focus:border-indigo-500 transition-all peer"
                    />
                    <label
                      htmlFor="apply-phone"
                      className="peer-focus:font-medium absolute text-sm text-zinc-400 duration-300 transform -translate-y-6 scale-75 top-3 -z-10 origin-[0] peer-focus:start-0 peer-focus:text-indigo-400 peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-focus:scale-75 peer-focus:-translate-y-6"
                    >
                      Phone Number (Optional)
                    </label>
                  </div>

                  {/* Selector Dropdown: Positions */}
                  <div className="space-y-2">
                    <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider" htmlFor="apply-job">Apply for Position</label>
                    <div className="relative">
                      <select
                        id="apply-job"
                        value={jobId}
                        onChange={(e) => setJobId(e.target.value)}
                        className="block w-full px-4 py-3 bg-zinc-800/50 border border-zinc-800 rounded-lg text-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-transparent appearance-none cursor-pointer text-sm transition-all"
                      >
                        {jobs.length === 0 && <option value="">No positions available</option>}
                        {jobs.map((job) => (
                          <option key={job.id} value={job.id} className="bg-zinc-900">
                            {job.title}
                          </option>
                        ))}
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-zinc-400">
                        <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                          <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
                        </svg>
                      </div>
                    </div>
                  </div>

                  {/* CV Upload Drag-Drop Area */}
                  <div className="space-y-2">
                    <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider">Upload CV Document</label>
                    <div
                      onDragEnter={handleDrag}
                      onDragOver={handleDrag}
                      onDragLeave={handleDrag}
                      onDrop={handleDrop}
                      className={`relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-300 overflow-hidden ${
                        file 
                          ? 'border-indigo-500 bg-indigo-500/5 shadow-sm' 
                          : 'border-zinc-800 hover:border-transparent bg-slate-900/30'
                      } group`}
                    >
                      {/* Gradient background on hover */}
                      <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 via-violet-500/5 to-cyan-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
                      <div className="absolute -inset-[2px] rounded-xl bg-gradient-to-r from-indigo-500 via-violet-500 to-cyan-500 opacity-0 group-hover:opacity-100 blur-[2px] -z-10 transition-opacity duration-500" />
                      <input
                        type="file"
                        accept=".pdf,.docx"
                        onChange={handleFileChange}
                        className="absolute inset-0 opacity-0 cursor-pointer"
                        id="cv-upload"
                      />
                      {file ? (
                        <div className="flex flex-col items-center justify-center gap-2">
                          <div className="w-12 h-12 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                            <FileText className="w-6 h-6 text-indigo-400" />
                          </div>
                          <p className="text-sm font-semibold text-zinc-400 max-w-[220px] truncate">{file.name}</p>
                          <p className="text-xs text-zinc-400">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center">
                          <Upload className="w-8 h-8 text-zinc-400 mb-3 group-hover:text-indigo-400 group-hover:scale-110 transition-all duration-300" />
                          <p className="text-sm font-medium text-zinc-400">
                            Drag CV here or <span className="text-indigo-400 font-semibold group-hover:underline">browse</span>
                          </p>
                          <p className="text-xs text-zinc-400 mt-1">PDF or DOCX (Max 10MB)</p>
                        </div>
                      )}
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={!file || uploading}
                    className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 disabled:opacity-50 text-white font-medium rounded-lg py-3 text-sm transition-all shadow-lg shadow-indigo-600/10 flex items-center justify-center gap-1.5 cursor-pointer text-center border border-transparent"
                    id="apply-submit"
                  >
                    Submit Application
                  </button>
                </form>
              </div>
            )}

            {/* Application Success Summary (Locked Left State after Submission) */}
            {(step === 'uploading' || step === 'tracking') && (
              <div className="space-y-6">
                <div className="border-b border-zinc-800 pb-4 mb-4">
                  <h2 className="text-lg font-bold text-zinc-400 flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 animate-pulse" />
                    Application Ingested
                  </h2>
                </div>

                <div className="bg-zinc-800/40 border border-zinc-800 rounded-xl p-5 space-y-4 shadow-sm">
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] text-zinc-400 uppercase tracking-wider font-bold">Applicant</span>
                    <span className="text-sm font-semibold text-zinc-400">{name}</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] text-zinc-400 uppercase tracking-wider font-bold">Email Address</span>
                    <span className="text-sm font-semibold text-zinc-400">{email}</span>
                  </div>
                  {phone && (
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] text-zinc-400 uppercase tracking-wider font-bold">Phone</span>
                      <span className="text-sm font-semibold text-zinc-400">{phone}</span>
                    </div>
                  )}
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] text-zinc-400 uppercase tracking-wider font-bold">Position Code</span>
                    <span className="text-sm font-mono text-indigo-400 font-semibold">{jobId}</span>
                  </div>
                </div>

                <div className="flex flex-col items-center justify-center p-6 bg-slate-900/40 border border-dashed border-zinc-800 rounded-xl">
                  <Zap className="w-6 h-6 text-indigo-400 mb-2 animate-bounce" />
                  <p className="text-xs text-zinc-400 text-center font-medium">
                    Evaluation status updates live. Keep this page open to track AI parsing and score outputs.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* RIGHT COLUMN: REAL-TIME PIPELINE OR PROGRESS TRACKING */}
          <div className="lg:col-span-7 bg-zinc-900/30  border border-zinc-800 rounded-xl p-6 md:p-8 shadow-sm">
            
            {/* Step: Form Input - Show Pipeline Preview */}
            {step === 'form' && (
              <div className="space-y-6">
                <div className="flex items-center gap-3 border-b border-zinc-800 pb-4 mb-4">
                  <div className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                  <h3 className="text-lg font-bold text-zinc-400 tracking-tight">AI Evaluation Stream</h3>
                </div>
                <p className="text-zinc-400 text-sm leading-relaxed">
                  Submit your resume to trigger the RecruitFlow evaluation pipeline. Once submitted, our system runs the following autonomous procedures:
                </p>

                <div className="space-y-4 relative before:absolute before:left-5 before:top-2 before:bottom-2 before:w-[2px] before:bg-slate-855">
                  <div className="flex items-start gap-4 relative group">
                    <div className="w-10 h-10 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 font-semibold z-10 hover:bg-indigo-500/20 transition-colors">
                      1
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-zinc-400">Native Resume Parsing</h4>
                      <p className="text-xs text-zinc-400 mt-0.5">Gemini processes the PDF/DOCX to extract skills, seniority parameters, and experience records.</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4 relative group">
                    <div className="w-10 h-10 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400 font-semibold z-10 hover:bg-violet-500/20 transition-colors">
                      2
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-zinc-400">6-Dimension Matrix Scoring</h4>
                      <p className="text-xs text-zinc-400 mt-0.5">Scoring metrics mapped across Technical capability, Fit, CV clarity, and Seniority match.</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4 relative group">
                    <div className="w-10 h-10 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 font-semibold z-10 hover:bg-cyan-500/20 transition-colors">
                      3
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-zinc-400">Automated Screening</h4>
                      <p className="text-xs text-zinc-400 mt-0.5">Candidates meeting threshold standards immediately pass screening to the technical assessment.</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4 relative group">
                    <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 font-semibold z-10 hover:bg-emerald-500/20 transition-colors">
                      4
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-zinc-400">Code Sandbox Test</h4>
                      <p className="text-xs text-zinc-400 mt-0.5">Personalized testing environments built in React and Python generated for sandbox review.</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Step: Uploading - Show Glowing Upload Percentage Track */}
            {step === 'uploading' && (
              <div className="flex flex-col items-center justify-center py-20 animate-fade-in">
                <div className="relative w-28 h-28 flex items-center justify-center mb-6">
                  {/* Outer spinning ring */}
                  <div className="absolute inset-0 rounded-full border-4 border-indigo-500/10 border-t-indigo-500 animate-spin" />
                  {/* Glowing core */}
                  <div className="absolute inset-2 bg-gradient-to-tr from-indigo-500 to-violet-500 rounded-full blur-[4px] opacity-10" />
                  <span className="text-xl font-bold text-zinc-400 z-10">{uploadProgress}%</span>
                </div>
                <h3 className="text-lg font-bold text-zinc-400 mb-2">Ingesting CV & Initiating Pipelines</h3>
                <p className="text-zinc-400 text-xs max-w-xs text-center leading-relaxed">
                  Uploading files to database repository. Our LLM will process the document text shortly.
                </p>
              </div>
            )}

            {/* Step: Tracking - Show Real-Time Pipeline Status Rows & Pulses */}
            {step === 'tracking' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between border-b border-zinc-800 pb-4 mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-ping" />
                    <h3 className="text-lg font-bold text-zinc-400 tracking-wide">Live Pipeline Ingestion</h3>
                  </div>
                  <StatusPill status={candidateStatus?.status} size="md" />
                </div>

                {/* Screening score (macro metric block) */}
                {candidateStatus?.screeningScore > 0 && (
                  <div className="p-6 bg-zinc-900/50 border border-zinc-800 rounded-xl flex items-center justify-between shadow-sm animate-slide-up">
                    <div>
                      <p className="text-xs text-zinc-400 uppercase font-semibold tracking-wider">AI Evaluation Score</p>
                      <p className="text-3xl font-extrabold text-indigo-400 mt-1">
                        {Math.round(candidateStatus.screeningScore)}
                        <span className="text-zinc-400 text-sm font-normal"> / 100</span>
                      </p>
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-xl">
                      🚀
                    </div>
                  </div>
                )}

                {/* Candidate Status Rows & Progress Lines */}
                <div className="space-y-5 relative before:absolute before:left-5 before:top-2 before:bottom-2 before:w-[2px] before:bg-slate-855">
                  {PIPELINE_STEPS.map((pStep, idx) => {
                    const currentIdx = getCurrentStepIndex()
                    const isComplete = idx <= currentIdx
                    const isCurrent = idx === currentIdx
                    const isFailed = candidateStatus?.status === 'AI_SCREENING_FAILED' || candidateStatus?.status === 'REJECTED' || candidateStatus?.status === 'PARSE_FAILED' || candidateStatus?.status === 'PROCESSING_FAILED'

                    return (
                      <div key={pStep.key} className="flex items-start gap-4 relative animate-fade-in">
                        {/* Status Light dot */}
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center text-base border-2 z-10 transition-all duration-500 ${
                            isComplete
                              ? 'bg-indigo-500/20 border-indigo-500 text-indigo-400'
                              : isFailed && idx > currentIdx
                              ? 'bg-red-500/15 border-red-500/30 text-red-500/60'
                              : 'bg-zinc-800 border-zinc-800 text-zinc-400'
                          } ${isCurrent ? 'ring-4 ring-indigo-500/10 animate-pulse' : ''}`}
                        >
                          {pStep.icon}
                        </div>
                        <div className="pt-2">
                          <h4 className={`text-sm font-semibold transition-colors duration-300 ${isComplete ? 'text-zinc-400' : 'text-zinc-400'}`}>
                            {pStep.label}
                          </h4>
                          {isCurrent && (
                            <p className="text-xs text-indigo-400 mt-0.5 animate-pulse">Processing active evaluation criteria...</p>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Failed Panel */}
                {candidateStatus?.status === 'AI_SCREENING_FAILED' && (
                  <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-center shadow-sm">
                    <p className="text-red-400 font-semibold text-sm">Pipeline Concluded</p>
                    <p className="text-zinc-400 text-xs mt-1 leading-relaxed">
                      Unfortunately, your profile did not match the required screening parameters for this role.
                    </p>
                  </div>
                )}

                {(candidateStatus?.status === 'PARSE_FAILED' || candidateStatus?.status === 'PROCESSING_FAILED') && (
                  <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl text-center shadow-sm">
                    <p className="text-amber-400 font-semibold text-sm">Processing Error</p>
                    <p className="text-zinc-400 text-xs mt-1 leading-relaxed">
                      There was an error processing your CV. Please try submitting again or contact support.
                    </p>
                  </div>
                )}

                {/* Assessment Launch Call To Action */}
                {candidateStatus?.status === 'ASSESSMENT_SENT' && candidateStatus.assessmentToken && (
                  <div className="mt-6 text-center shadow-sm">
                    <Link
                      to={`/assessment/${candidateStatus.assessmentToken}`}
                      className="block w-full text-center bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-medium py-3 rounded-lg text-sm transition-all shadow-md animate-pulse cursor-pointer"
                      id="start-assessment-btn"
                    >
                      Launch Sandbox Coding Test →
                    </Link>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer Login Navigation */}
        <p className="text-center text-zinc-400 text-xs mt-10">
          HR Management Access?{' '}
          <Link to="/login" className="text-indigo-400 hover:text-indigo-300 transition-colors font-medium">
            Log in to Dashboard
          </Link>
        </p>
      </div>
    </div>
  )
}
