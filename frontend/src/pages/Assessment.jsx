import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { useAssessment } from '../hooks/useAssessment'
import { Clock, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react'

export default function Assessment() {
  const { token } = useParams()
  const { assessment, loading, error, submitting, submitAnswers } = useAssessment(token)
  const [answers, setAnswers] = useState({})
  const [timeLeft, setTimeLeft] = useState(null)
  const [submitted, setSubmitted] = useState(false)
  const [activeQuestion, setActiveQuestion] = useState(0)
  const handleSubmitRef = useRef(null)

  useEffect(() => {
    if (!assessment) return
    if (assessment.submitted) {
      setSubmitted(true)
      return
    }
    const totalSeconds = (assessment.timeLimitMinutes || 120) * 60
    setTimeLeft(totalSeconds)
  }, [assessment])

  const timerStarted = useRef(false)

  useEffect(() => {
    if (timeLeft === null || timeLeft <= 0 || submitted || timerStarted.current) return
    timerStarted.current = true

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer)
          handleSubmitRef.current()
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [timeLeft, submitted])

  const formatTime = (seconds) => {
    if (seconds === null) return '--:--'
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  const getTimeColor = () => {
    if (timeLeft === null) return 'text-zinc-400'
    if (timeLeft < 300) return 'text-rose-400'
    if (timeLeft < 600) return 'text-amber-400'
    return 'text-emerald-400'
  }

  const updateAnswer = (questionId, value) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }))
  }

  const handleSubmit = useCallback(async () => {
    if (submitted || !assessment) return

    const questions = assessment.questions || []
    const formattedAnswers = questions.map((q) => ({
      questionId: q.id,
      answer: answers[q.id] || '',
      codeSubmissionsCount: 1,
    }))

    try {
      await submitAnswers(formattedAnswers)
      setSubmitted(true)
    } catch (err) {
      console.error('Submit failed:', err)
    }
  }, [submitted, assessment, answers, submitAnswers])

  useEffect(() => {
    handleSubmitRef.current = handleSubmit
  }, [handleSubmit])

  if (loading) {
    return (
      <div className="page-container flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-indigo-400 mx-auto mb-4 animate-spin" />
          <p className="text-zinc-400">Loading assessment...</p>
        </div>
      </div>
    )
  }

  if (error || !assessment) {
    return (
      <div className="page-container flex items-center justify-center min-h-screen px-4">
        <div className="glass-card p-10 text-center max-w-md w-full">
          <AlertTriangle className="w-12 h-12 text-amber-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-zinc-50 mb-2">Assessment Not Found</h2>
          <p className="text-zinc-400 text-sm">{error || 'This assessment link may have expired or is invalid.'}</p>
          <p className="text-zinc-500 text-xs mt-4">Ensure the link matches: <code className="text-indigo-400">/assessment/{'{token}'}</code></p>
        </div>
      </div>
    )
  }

  if (submitted) {
    return (
      <div className="page-container flex items-center justify-center min-h-screen px-4">
        <div className="glass-card p-10 text-center max-w-lg w-full animate-slide-up">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
            <CheckCircle2 className="w-10 h-10 text-emerald-400" />
          </div>
          <h2 className="text-2xl font-bold text-zinc-50 mb-3">Assessment Submitted</h2>
          <p className="text-zinc-400 mb-6 text-sm">Your answers are being evaluated. You'll receive an email with your results shortly.</p>
          {assessment.score > 0 && (
            <div className="p-4 bg-zinc-900/60 rounded-xl border border-zinc-800">
              <p className="text-zinc-500 text-sm">Your Score</p>
              <p className="text-4xl font-bold text-indigo-400 tabular-nums">{Math.round(assessment.score)}<span className="text-zinc-500 text-lg">/100</span></p>
            </div>
          )}
        </div>
      </div>
    )
  }

  const questions = assessment.questions || []
  const currentQ = questions[activeQuestion]

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col" id="assessment-page">
      {/* Top Bar */}
      <div className="h-16 bg-zinc-900/90 backdrop-blur border-b border-zinc-800 flex items-center justify-between px-4 sm:px-6 sticky top-0 z-20">
        <div className="flex items-center gap-4">
          <h1 className="font-bold text-zinc-50 text-sm sm:text-base">Technical Assessment</h1>
          <div className="hidden sm:flex items-center gap-1.5">
            {questions.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setActiveQuestion(idx)}
                className={`w-8 h-8 rounded-lg text-sm font-medium transition-all ${
                  idx === activeQuestion
                    ? 'bg-indigo-600 text-white shadow-[0_0_12px_rgba(99,102,241,0.4)]'
                    : answers[questions[idx]?.id]
                    ? 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/30'
                    : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                }`}
              >
                {idx + 1}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-4 sm:gap-6">
          <div className={`font-mono text-base sm:text-lg font-bold tabular-nums flex items-center gap-1.5 ${getTimeColor()}`} id="timer">
            <Clock className="w-4 h-4" />
            {formatTime(timeLeft)}
          </div>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="glass-button text-sm py-2 px-4 sm:px-5 disabled:opacity-50"
            id="submit-assessment"
          >
            {submitting ? 'Submitting...' : 'Submit All'}
          </button>
        </div>
      </div>

      {/* Split Pane */}
      <div className="flex-1 flex flex-col lg:flex-row">
        {/* Left: Instructions */}
        <div className="w-full lg:w-1/2 border-b lg:border-b-0 lg:border-r border-zinc-800 p-6 sm:p-8 overflow-y-auto">
          {currentQ && (
            <div className="animate-fade-in">
              <div className="flex items-center gap-3 mb-6 flex-wrap">
                <span className={`badge ${
                  currentQ.type === 'mcq' ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/25' :
                  currentQ.type === 'coding' ? 'bg-amber-500/15 text-amber-400 border border-amber-500/25' :
                  'bg-violet-500/15 text-violet-400 border border-violet-500/25'
                }`}>
                  {currentQ.type === 'mcq' ? 'Multiple Choice' : currentQ.type === 'coding' ? 'Coding' : 'Open-Ended'}
                </span>
                <span className="text-zinc-500 text-sm">Question {activeQuestion + 1} of {questions.length}</span>
              </div>

              <h2 className="text-lg font-semibold text-zinc-50 mb-6 leading-relaxed">{currentQ.prompt}</h2>

              {currentQ.type === 'mcq' && (
                <div className="space-y-3" id="mcq-options">
                  {currentQ.options?.map((option, idx) => (
                    <button
                      key={idx}
                      onClick={() => updateAnswer(currentQ.id, option)}
                      className={`w-full text-left p-4 rounded-xl border transition-all duration-200 ${
                        answers[currentQ.id] === option
                          ? 'bg-indigo-500/15 border-indigo-500/50 text-indigo-200'
                          : 'bg-zinc-900/50 border-zinc-800 text-zinc-300 hover:bg-zinc-800/50 hover:border-zinc-700'
                      }`}
                    >
                      <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-zinc-800 text-sm font-medium mr-3 text-zinc-300">
                        {String.fromCharCode(65 + idx)}
                      </span>
                      {option}
                    </button>
                  ))}
                </div>
              )}

              {currentQ.type === 'coding' && currentQ.testCases?.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-sm font-semibold text-zinc-300 mb-3">Test Cases</h3>
                  <div className="space-y-2">
                    {currentQ.testCases.map((tc, idx) => (
                      <div key={idx} className="bg-zinc-900/60 border border-zinc-800 rounded-lg p-3 font-mono text-sm">
                        <span className="text-zinc-500">Input: </span>
                        <span className="text-cyan-400">{tc.input}</span>
                        <br />
                        <span className="text-zinc-500">Expected: </span>
                        <span className="text-emerald-400">{tc.expected_output}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right: Answer Area */}
        <div className="w-full lg:w-1/2 p-6 sm:p-8 overflow-y-auto">
          {currentQ && (
            <div className="h-full min-h-[300px] animate-fade-in">
              {currentQ.type === 'mcq' ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    {answers[currentQ.id] ? (
                      <>
                        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center">
                          <CheckCircle2 className="w-8 h-8 text-indigo-400" />
                        </div>
                        <p className="text-zinc-200 font-medium">Answer selected</p>
                        <p className="text-indigo-400 mt-2 font-semibold">{answers[currentQ.id]}</p>
                      </>
                    ) : (
                      <p className="text-zinc-500">Select an option from the left panel</p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="h-full flex flex-col glass-card overflow-hidden">
                  <div className="h-11 bg-zinc-950 border-b border-zinc-800 flex items-center justify-between px-4">
                    <div className="flex items-center gap-2">
                      <div className="flex gap-1.5">
                        <span className="w-3 h-3 rounded-full bg-rose-500/80" />
                        <span className="w-3 h-3 rounded-full bg-amber-500/80" />
                        <span className="w-3 h-3 rounded-full bg-emerald-500/80" />
                      </div>
                      <span className="text-xs text-indigo-400 font-mono ml-2">
                        {currentQ.type === 'coding' ? 'solution.py' : 'response.txt'}
                      </span>
                    </div>
                    <span className="text-zinc-500 text-xs font-mono">UTF-8</span>
                  </div>
                  <div className="flex-1 relative bg-zinc-950 p-4 min-h-[240px]">
                    <textarea
                      value={answers[currentQ.id] || ''}
                      onChange={(e) => updateAnswer(currentQ.id, e.target.value)}
                      placeholder={currentQ.type === 'coding' ? 'def find_duplicates(arr):\n    # Your code here\n    pass' : 'Type your answer here...'}
                      className={`w-full h-full min-h-[200px] bg-transparent resize-none border-none outline-none focus:ring-0 text-zinc-200 placeholder-zinc-600 ${currentQ.type === 'coding' ? 'font-mono text-sm leading-relaxed' : 'text-sm'}`}
                      id={`answer-${currentQ.id}`}
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
