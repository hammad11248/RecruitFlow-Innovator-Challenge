import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { useAssessment } from '../hooks/useAssessment'

export default function Assessment() {
  const { token } = useParams()
  const { assessment, loading, error, submitting, submitAnswers } = useAssessment(token)
  const [answers, setAnswers] = useState({})
  const [timeLeft, setTimeLeft] = useState(null)
  const [submitted, setSubmitted] = useState(false)
  const [activeQuestion, setActiveQuestion] = useState(0)
  const handleSubmitRef = useRef(null)

  // Initialize timer when assessment loads
  useEffect(() => {
    if (assessment && !assessment.answers?.length) {
      const totalSeconds = (assessment.timeLimitMinutes || 120) * 60
      setTimeLeft(totalSeconds)
    }
    if (assessment?.answers?.length > 0) {
      setSubmitted(true)
    }
  }, [assessment])

  // Countdown timer
  useEffect(() => {
    if (timeLeft === null || timeLeft <= 0 || submitted) return

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
  }, [timeLeft === null, submitted])


  const formatTime = (seconds) => {
    if (seconds === null) return '--:--'
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  const getTimeColor = () => {
    if (timeLeft === null) return 'text-surface-400'
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

  // Keep ref updated with handleSubmit
  useEffect(() => {
    handleSubmitRef.current = handleSubmit
  }, [handleSubmit])

  if (loading) {
    return (
      <div className="page-container flex items-center justify-center min-h-screen">
        <div className="text-center">
          <svg className="animate-spin w-10 h-10 text-primary-400 mx-auto mb-4" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <p className="text-surface-400">Loading assessment...</p>
        </div>
      </div>
    )
  }

  if (error || !assessment) {
    return (
      <div className="page-container flex items-center justify-center min-h-screen">
        <div className="glass-card p-10 text-center max-w-md">
          <div className="text-4xl mb-4">⚠️</div>
          <h2 className="text-xl font-bold text-surface-50 mb-2">Assessment Not Found</h2>
          <p className="text-surface-400">{error || 'This assessment link may have expired or is invalid.'}</p>
        </div>
      </div>
    )
  }

  if (submitted) {
    return (
      <div className="page-container flex items-center justify-center min-h-screen">
        <div className="glass-card p-10 text-center max-w-lg animate-slide-up">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-emerald-500/20 flex items-center justify-center">
            <svg className="w-10 h-10 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-surface-50 mb-3">Assessment Submitted! 🎉</h2>
          <p className="text-surface-400 mb-6">Your answers are being evaluated by our AI system. You'll receive an email with your results shortly.</p>
          {assessment.score > 0 && (
            <div className="p-4 bg-surface-800/50 rounded-xl border border-surface-700/30">
              <p className="text-surface-400 text-sm">Your Score</p>
              <p className="text-4xl font-bold text-primary-400">{Math.round(assessment.score)}<span className="text-surface-500 text-lg">/100</span></p>
            </div>
          )}
        </div>
      </div>
    )
  }

  const questions = assessment.questions || []
  const currentQ = questions[activeQuestion]

  return (
    <div className="page-container min-h-screen flex flex-col" id="assessment-page">
      {/* Top Bar */}
      <div className="h-16 bg-surface-900/90  border-b border-surface-700/30 flex items-center justify-between px-6 sticky top-0 z-20">
        <div className="flex items-center gap-4">
          <h1 className="font-bold text-surface-100">Technical Assessment</h1>
          <div className="flex items-center gap-1.5">
            {questions.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setActiveQuestion(idx)}
                className={`w-8 h-8 rounded-lg text-sm font-medium transition-all ${idx === activeQuestion ? 'bg-primary-500 text-white' : answers[questions[idx]?.id] ? 'bg-primary-500/20 text-primary-400 border border-primary-500/30' : 'bg-surface-800 text-surface-400 hover:bg-surface-700'}`}
              >
                {idx + 1}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className={`font-mono text-lg font-bold ${getTimeColor()}`} id="timer">
            ⏱ {formatTime(timeLeft)}
          </div>
          <button onClick={handleSubmit} disabled={submitting} className="glass-button text-sm py-2 px-5 disabled:opacity-50" id="submit-assessment">
            {submitting ? 'Submitting...' : 'Submit All'}
          </button>
        </div>
      </div>

      {/* Split Pane */}
      <div className="flex-1 flex">
        {/* Left: Instructions */}
        <div className="w-1/2 border-r border-surface-700/30 p-8 overflow-y-auto">
          {currentQ && (
            <div className="animate-fade-in">
              <div className="flex items-center gap-3 mb-6">
                <span className={`badge ${currentQ.type === 'mcq' ? 'bg-cyan-500/20 text-cyan-400' : currentQ.type === 'coding' ? 'bg-amber-500/20 text-amber-400' : 'bg-violet-500/20 text-violet-400'}`}>
                  {currentQ.type === 'mcq' ? '📝 Multiple Choice' : currentQ.type === 'coding' ? '💻 Coding' : '📖 Open-Ended'}
                </span>
                <span className="text-surface-500 text-sm">Question {activeQuestion + 1} of {questions.length}</span>
              </div>

              <h2 className="text-lg font-semibold text-surface-100 mb-6 leading-relaxed">{currentQ.prompt}</h2>

              {currentQ.type === 'mcq' && (
                <div className="space-y-3" id="mcq-options">
                  {currentQ.options?.map((option, idx) => (
                    <button
                      key={idx}
                      onClick={() => updateAnswer(currentQ.id, option)}
                      className={`w-full text-left p-4 rounded-xl border transition-all duration-200 ${answers[currentQ.id] === option ? 'bg-primary-500/15 border-primary-500/50 text-primary-300' : 'bg-surface-800/30 border-surface-700/30 text-surface-300 hover:bg-surface-800/50 hover:border-surface-600'}`}
                    >
                      <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-surface-700/50 text-sm font-medium mr-3">
                        {String.fromCharCode(65 + idx)}
                      </span>
                      {option}
                    </button>
                  ))}
                </div>
              )}

              {currentQ.type === 'coding' && currentQ.testCases?.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-sm font-semibold text-surface-300 mb-3">Test Cases</h3>
                  <div className="space-y-2">
                    {currentQ.testCases.map((tc, idx) => (
                      <div key={idx} className="bg-surface-800/50 rounded-lg p-3 font-mono text-sm">
                        <span className="text-surface-500">Input: </span>
                        <span className="text-cyan-400">{tc.input}</span>
                        <br />
                        <span className="text-surface-500">Expected: </span>
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
        <div className="w-1/2 p-8 overflow-y-auto">
          {currentQ && (
            <div className="h-full animate-fade-in">
              {currentQ.type === 'mcq' ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    {answers[currentQ.id] ? (
                      <>
                        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary-500/20 flex items-center justify-center">
                          <svg className="w-8 h-8 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                        <p className="text-surface-200 font-medium">Answer selected</p>
                        <p className="text-primary-400 mt-2 font-semibold">{answers[currentQ.id]}</p>
                      </>
                    ) : (
                      <p className="text-surface-500">Select an option from the left panel</p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="h-full flex flex-col glass-card border-surface-700/50 overflow-hidden shadow-2xl">
                  {/* IDE Tab Header */}
                  <div className="h-11 bg-surface-950/80 border-b border-surface-800 flex items-center justify-between px-4">
                    <div className="flex items-center gap-2">
                      <div className="flex gap-1.5">
                        <span className="w-3 h-3 rounded-full bg-rose-500/80" />
                        <span className="w-3 h-3 rounded-full bg-amber-500/80" />
                        <span className="w-3 h-3 rounded-full bg-emerald-500/80" />
                      </div>
                      <div className="w-[1px] h-4 bg-surface-800 mx-2" />
                      <div className="flex items-center gap-1.5 bg-surface-900 border border-surface-800/80 border-b-transparent rounded-t-lg px-3 py-1.5 text-xs text-primary-400 font-mono font-medium -mb-[13px] z-10 select-none">
                        <span>{currentQ.type === 'coding' ? '🐍' : '📝'}</span>
                        <span>{currentQ.type === 'coding' ? 'solution.py' : 'response.txt'}</span>
                      </div>
                    </div>
                    <span className="text-surface-500 text-xs font-mono select-none">UTF-8</span>
                  </div>

                  {/* Textarea container with background */}
                  <div className="flex-1 relative bg-surface-900/60 p-4">
                    <textarea
                      value={answers[currentQ.id] || ''}
                      onChange={(e) => updateAnswer(currentQ.id, e.target.value)}
                      placeholder={currentQ.type === 'coding' ? 'def find_duplicates(arr):\n    # Your code here\n    pass' : 'Type your answer here...'}
                      className={`w-full h-full bg-transparent resize-none border-none outline-none focus:ring-0 text-surface-200 placeholder-surface-650 focus:outline-none ${currentQ.type === 'coding' ? 'font-mono text-sm leading-relaxed' : 'text-sm'}`}
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
