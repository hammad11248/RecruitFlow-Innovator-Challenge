import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { storage, db, ref, uploadBytesResumable, getDownloadURL, doc, onSnapshot } from '../firebase'
import client from '../api/client'
import StatusPill from '../components/StatusPill'


const PIPELINE_STEPS = [
  { key: 'UPLOADED', label: 'Uploaded', icon: '📄' },
  { key: 'PROCESSING', label: 'AI Processing', icon: '🤖' },
  { key: 'AI_SCREENING_PASSED', label: 'Screening Passed', icon: '✅' },
  { key: 'ASSESSMENT_SENT', label: 'Assessment Sent', icon: '📝' },
  { key: 'ASSESSMENT_SUBMITTED', label: 'Submitted', icon: '📤' },
  { key: 'SCORED', label: 'Scored', icon: '📊' },
  { key: 'INTERVIEW_SCHEDULED', label: 'Interview', icon: '📅' },
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

  // Fetch available jobs
  useEffect(() => {
    client.get('/jobs').then((res) => {
      setJobs(res.data.jobs || [])
      if (res.data.jobs?.length > 0) {
        setJobId(res.data.jobs[0].id)
      }
    }).catch(() => {})
  }, [])

  // Real-time candidate status tracking via onSnapshot
  useEffect(() => {
    if (!candidateId) return

    const docRef = doc(db, 'candidates', candidateId)
    const unsubscribe = onSnapshot(docRef, (snapshot) => {
      if (snapshot.exists()) {
        setCandidateStatus(snapshot.data())
      }
    })

    return unsubscribe
  }, [candidateId])

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
      // Upload to Firebase Storage with progress tracking
      const storageRef = ref(storage, `cvs/temp/${Date.now()}_${file.name}`)
      const uploadTask = uploadBytesResumable(storageRef, file)

      await new Promise((resolve, reject) => {
        uploadTask.on(
          'state_changed',
          (snapshot) => {
            const progress = Math.round(
              (snapshot.bytesTransferred / snapshot.totalBytes) * 100
            )
            setUploadProgress(progress)
          },
          (err) => reject(err),
          () => resolve()
        )
      })

      // Now call FastAPI to create candidate and start pipeline
      const formData = new FormData()
      formData.append('file', file)
      formData.append('name', name)
      formData.append('email', email)
      formData.append('phone', phone)
      formData.append('jobId', jobId)

      const response = await client.post('/candidates/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
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

  const getCurrentStepIndex = () => {
    const status = candidateStatus?.status
    const idx = PIPELINE_STEPS.findIndex((s) => s.key === status)
    return idx >= 0 ? idx : -1
  }

  return (
    <div className="page-container min-h-screen flex items-center justify-center px-4 py-12" id="apply-page">
      {/* Background decoration */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-emerald-500/5 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-2xl animate-slide-up">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-500 to-cyan-500 shadow-lg shadow-primary-500/30 mb-4">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-surface-50 tracking-tight">Apply Now</h1>
          <p className="text-surface-400 mt-2">Submit your CV and track your application in real-time</p>
        </div>

        {/* Step: Application Form */}
        {step === 'form' && (
          <div className="glass-card p-8">
            <form onSubmit={handleSubmit} className="space-y-5" id="apply-form">
              {error && (
                <div className="flex items-center gap-3 bg-rose-500/10 border border-rose-500/20 rounded-xl px-4 py-3 animate-fade-in">
                  <svg className="w-5 h-5 text-rose-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  <span className="text-rose-300 text-sm">{error}</span>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-medium text-surface-300 mb-2" htmlFor="apply-name">Full Name</label>
                  <input id="apply-name" type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="John Doe" required className="glass-input w-full" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-surface-300 mb-2" htmlFor="apply-email">Email</label>
                  <input id="apply-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="john@example.com" required className="glass-input w-full" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-medium text-surface-300 mb-2" htmlFor="apply-phone">Phone (optional)</label>
                  <input id="apply-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 (555) 123-4567" className="glass-input w-full" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-surface-300 mb-2" htmlFor="apply-job">Position</label>
                  <select id="apply-job" value={jobId} onChange={(e) => setJobId(e.target.value)} className="glass-input w-full">
                    {jobs.length === 0 && <option value="">No positions available</option>}
                    {jobs.map((job) => (
                      <option key={job.id} value={job.id}>{job.title}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* File Upload Area */}
              <div>
                <label className="block text-sm font-medium text-surface-300 mb-2">Upload CV</label>
                <div className={`relative border-2 border-dashed rounded-2xl p-8 text-center transition-all duration-300 cursor-pointer ${file ? 'border-primary-500/50 bg-primary-500/5' : 'border-surface-600/40 hover:border-surface-500/50 hover:bg-surface-800/30'}`}>
                  <input type="file" accept=".pdf,.docx" onChange={handleFileChange} className="absolute inset-0 opacity-0 cursor-pointer" id="cv-upload" />
                  {file ? (
                    <div className="flex items-center justify-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-primary-500/20 flex items-center justify-center">
                        <svg className="w-5 h-5 text-primary-400" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div className="text-left">
                        <p className="text-surface-200 font-medium">{file.name}</p>
                        <p className="text-surface-500 text-sm">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                      </div>
                    </div>
                  ) : (
                    <>
                      <svg className="w-10 h-10 mx-auto text-surface-500 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                      <p className="text-surface-300 font-medium">Drop your CV here or click to browse</p>
                      <p className="text-surface-500 text-sm mt-1">PDF or DOCX, max 10MB</p>
                    </>
                  )}
                </div>
              </div>

              <button type="submit" disabled={!file || uploading} className="glass-button w-full disabled:opacity-50 disabled:cursor-not-allowed" id="apply-submit">
                Submit Application
              </button>
            </form>
          </div>
        )}

        {/* Step: Uploading Progress */}
        {step === 'uploading' && (
          <div className="glass-card p-10 text-center animate-fade-in">
            <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-primary-500/20 flex items-center justify-center">
              <svg className="animate-spin w-8 h-8 text-primary-400" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-surface-50 mb-4">Uploading your CV...</h2>
            <div className="w-full bg-surface-700/50 rounded-full h-3 mb-3 overflow-hidden">
              <div className="h-full bg-gradient-to-r from-primary-600 to-primary-400 rounded-full transition-all duration-300 progress-bar-animated" style={{ width: `${uploadProgress}%` }} />
            </div>
            <p className="text-primary-400 font-semibold text-lg">{uploadProgress}%</p>
          </div>
        )}

        {/* Step: Pipeline Tracking */}
        {step === 'tracking' && candidateStatus && (
          <div className="glass-card p-8 animate-fade-in" id="tracking-panel">
            <div className="text-center mb-8">
              <h2 className="text-xl font-bold text-surface-50">Application Submitted! 🎉</h2>
              <p className="text-surface-400 mt-2">Track your progress in real-time below</p>
            </div>

            {/* Status Badge */}
            <div className="flex justify-center mb-8">
              <StatusPill status={candidateStatus.status} size="lg" />
            </div>

            {/* Pipeline Progress */}
            <div className="space-y-4 max-w-md mx-auto">
              {PIPELINE_STEPS.map((pStep, idx) => {
                const currentIdx = getCurrentStepIndex()
                const isComplete = idx <= currentIdx
                const isCurrent = idx === currentIdx
                const isFailed = candidateStatus.status === 'AI_SCREENING_FAILED' || candidateStatus.status === 'REJECTED'

                return (
                  <div key={pStep.key} className="flex items-start gap-4">
                    {/* Line + Dot */}
                    <div className="flex flex-col items-center">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg border-2 transition-all duration-500 ${isComplete ? 'bg-primary-500/20 border-primary-500 text-primary-400' : isFailed && idx > currentIdx ? 'bg-rose-500/10 border-rose-500/30 text-rose-500/50' : 'bg-surface-800 border-surface-600 text-surface-500'} ${isCurrent ? 'ring-2 ring-primary-500/30 animate-pulse-glow' : ''}`}>
                        {pStep.icon}
                      </div>
                      {idx < PIPELINE_STEPS.length - 1 && (
                        <div className={`w-0.5 h-12 transition-all duration-500 ${isComplete ? 'bg-primary-500/40' : 'bg-surface-700'}`} />
                      )}
                    </div>
                    {/* Label */}
                    <div className="pt-2">
                      <p className={`font-medium transition-colors duration-300 ${isComplete ? 'text-surface-100' : 'text-surface-500'}`}>{pStep.label}</p>
                      {isCurrent && (
                        <p className="text-primary-400 text-sm mt-0.5 animate-fade-in">Current step</p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Score if available */}
            {candidateStatus.screeningScore > 0 && (
              <div className="mt-8 p-4 bg-surface-800/50 rounded-xl border border-surface-700/30">
                <p className="text-surface-400 text-sm">Screening Score</p>
                <p className="text-3xl font-bold text-primary-400">{Math.round(candidateStatus.screeningScore)}<span className="text-surface-500 text-lg">/100</span></p>
              </div>
            )}

            {candidateStatus.status === 'AI_SCREENING_FAILED' && (
              <div className="mt-6 p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-center">
                <p className="text-rose-300 font-medium">Unfortunately, your profile didn't match the current requirements.</p>
                <p className="text-surface-400 text-sm mt-1">We encourage you to apply for other positions.</p>
              </div>
            )}

            {candidateStatus.status === 'ASSESSMENT_SENT' && candidateStatus.assessmentToken && (
              <div className="mt-6 text-center">
                <Link to={`/assessment/${candidateStatus.assessmentToken}`} className="glass-button inline-block" id="start-assessment-btn">
                  Start Assessment →
                </Link>
              </div>
            )}
          </div>
        )}

        {/* HR login link */}
        <p className="text-center text-surface-500 text-sm mt-6">
          HR Manager? <Link to="/login" className="text-primary-400 hover:text-primary-300 transition-colors">Login here →</Link>
        </p>
      </div>
    </div>
  )
}
