import React, { useState, useRef } from 'react'
import client from '../api/client'
import { Upload, FileText, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'

export default function FileUpload({ onUploadSuccess }) {
  const [file, setFile] = useState(null)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [jobId, setJobId] = useState('job-frontend') // default job ID
  const [loading, setLoading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [candidateId, setCandidateId] = useState(null)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const fileInputRef = useRef(null)

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
        setError(null)
      } else {
        setError("Only PDF and DOCX files are allowed")
      }
    }
  }

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0]
      const ext = selectedFile.name.split('.').pop().toLowerCase()
      if (['pdf', 'docx'].includes(ext)) {
        setFile(selectedFile)
        setError(null)
      } else {
        setError("Only PDF and DOCX files are allowed")
      }
    }
  }

  const onButtonClick = () => {
    fileInputRef.current.click()
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!file) {
      setError("Please select a CV file (PDF or DOCX)")
      return
    }
    if (!name.trim() || !email.trim()) {
      setError("Please fill in candidate Name and Email")
      return
    }

    setLoading(true)
    setUploadProgress(0)
    setError(null)
    setSuccess(false)
    setCandidateId(null)

    const formData = new FormData()
    formData.append('file', file)
    formData.append('name', name)
    formData.append('email', email)
    formData.append('jobId', jobId)

    try {
      const response = await client.post('/candidates/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total)
          setUploadProgress(percentCompleted)
        }
      })
      const returnedCandidateId = response.data.candidateId || response.data.id
      setCandidateId(returnedCandidateId)
      setSuccess(true)
      setFile(null)
      setName('')
      setEmail('')
      if (onUploadSuccess) {
        onUploadSuccess(response.data)
      }
    } catch (err) {
      console.error("Upload error details:", err)
      const errMsg = err.response?.data?.detail || err.message || "Failed to upload candidate CV."
      setError(errMsg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl text-slate-200">
      <h2 className="text-lg font-semibold text-slate-100 mb-4 flex items-center gap-2">
        <Upload className="w-5 h-5 text-indigo-500" />
        Upload Candidate CV
      </h2>

      {error && (
        <div className="flex items-center gap-2 p-3.5 bg-rose-500/10 border border-rose-500/25 rounded-lg text-rose-400 text-sm mb-4">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="flex flex-col gap-1 p-3.5 bg-emerald-500/10 border border-emerald-500/25 rounded-lg text-emerald-400 text-sm mb-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span className="font-semibold">CV uploaded and parsed successfully!</span>
          </div>
          {candidateId && (
            <p className="text-xs text-slate-400 ml-6">
              Candidate ID: <span className="font-mono bg-slate-950 px-1.5 py-0.5 rounded select-all text-slate-200 border border-slate-850">{candidateId}</span>
            </p>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Candidate Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={loading}
            placeholder="John Doe"
            className="w-full bg-slate-950 border border-slate-850 hover:border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg px-3.5 py-2 text-sm text-slate-200 placeholder-slate-650 transition-all outline-none"
            required
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Candidate Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
            placeholder="john.doe@example.com"
            className="w-full bg-slate-950 border border-slate-850 hover:border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg px-3.5 py-2 text-sm text-slate-200 placeholder-slate-650 transition-all outline-none"
            required
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Apply for Job Position</label>
          <select
            value={jobId}
            onChange={(e) => setJobId(e.target.value)}
            disabled={loading}
            className="w-full bg-slate-950 border border-slate-850 hover:border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg px-3.5 py-2 text-sm text-slate-200 transition-all outline-none cursor-pointer"
          >
            <option value="job-frontend">Frontend React Developer</option>
            <option value="job-backend">Backend Python Developer</option>
            <option value="job-fullstack">Fullstack Architect</option>
          </select>
        </div>

        <div
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
          onClick={onButtonClick}
          className={`relative border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer transition-all ${
            dragActive 
              ? 'border-indigo-500 bg-indigo-500/5' 
              : 'border-slate-850 hover:border-slate-800 hover:bg-slate-950/20'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileChange}
            accept=".pdf,.docx"
            disabled={loading}
            className="hidden"
          />

          {file ? (
            <div className="flex flex-col items-center text-center">
              <FileText className="w-10 h-10 text-indigo-400 mb-2" />
              <span className="text-sm font-medium text-slate-300 max-w-[200px] truncate">{file.name}</span>
              <span className="text-xs text-slate-500 mt-1">{(file.size / 1024).toFixed(1)} KB</span>
            </div>
          ) : (
            <div className="flex flex-col items-center text-center">
              <Upload className="w-10 h-10 text-slate-650 mb-2" />
              <span className="text-sm font-medium text-slate-400">Drag & drop CV or <span className="text-indigo-500 hover:text-indigo-400 font-semibold">Browse</span></span>
              <span className="text-xs text-slate-550 mt-1">Only PDF and DOCX files are supported</span>
            </div>
          )}
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 disabled:opacity-50 text-white font-medium rounded-lg py-2.5 text-sm transition-all shadow-lg shadow-indigo-600/10 flex items-center justify-center gap-1.5 cursor-pointer text-center"
        >
          {loading ? (
            <div className="w-full flex flex-col items-center gap-1">
              <div className="flex items-center gap-1.5 justify-center">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Uploading & parsing CV ({uploadProgress}%)</span>
              </div>
              <div className="w-3/4 bg-slate-950/50 rounded-full h-1.5 overflow-hidden mt-1">
                <div className="bg-indigo-400 h-full rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
              </div>
            </div>
          ) : (
            "Submit Application"
          )}
        </button>
      </form>
    </div>
  )
}
