/**
 * TimelineStepper — Vertical pipeline progress timeline with animated transitions.
 *
 * Props:
 *   steps      — array of { key, label, icon }
 *   currentStatus — current pipeline status string
 *   stateHistory  — array of { state, timestamp, meta }
 */

const STEP_STATUS = {
  completed: {
    dot: 'bg-emerald-500 border-emerald-400 shadow-emerald-500/30',
    line: 'bg-emerald-500/40',
    label: 'text-surface-100',
    sublabel: 'text-emerald-400/80',
  },
  active: {
    dot: 'bg-primary-500 border-primary-400 shadow-primary-500/30 animate-pulse',
    line: 'bg-surface-700',
    label: 'text-surface-100',
    sublabel: 'text-primary-400',
  },
  upcoming: {
    dot: 'bg-surface-800 border-surface-600',
    line: 'bg-surface-700',
    label: 'text-surface-500',
    sublabel: 'text-surface-600',
  },
  failed: {
    dot: 'bg-rose-500 border-rose-400 shadow-rose-500/30',
    line: 'bg-rose-500/20',
    label: 'text-rose-300',
    sublabel: 'text-rose-400/80',
  },
}

const DEFAULT_STEPS = [
  { key: 'UPLOADED', label: 'CV Uploaded', icon: '📄' },
  { key: 'PROCESSING', label: 'AI Processing', icon: '🤖' },
  { key: 'AI_SCREENING_PASSED', label: 'Screening Passed', icon: '✅' },
  { key: 'ASSESSMENT_SENT', label: 'Assessment Sent', icon: '📝' },
  { key: 'ASSESSMENT_SUBMITTED', label: 'Assessment Submitted', icon: '📤' },
  { key: 'SCORED', label: 'Evaluation Complete', icon: '📊' },
  { key: 'INTERVIEW_SCHEDULED', label: 'Interview Scheduled', icon: '📅' },
]

const FAILED_STATUSES = ['AI_SCREENING_FAILED', 'PROCESSING_FAILED', 'REJECTED']

export default function TimelineStepper({
  steps = DEFAULT_STEPS,
  currentStatus = 'UPLOADED',
  stateHistory = [],
}) {
  const isFailed = FAILED_STATUSES.includes(currentStatus)
  const currentIndex = steps.findIndex((s) => s.key === currentStatus)

  /* Build a timestamp map from state history */
  const timestampMap = {}
  stateHistory.forEach((entry) => {
    const ts = entry.timestamp?.toDate
      ? entry.timestamp.toDate()
      : entry.timestamp
        ? new Date(entry.timestamp)
        : null
    if (ts) {
      timestampMap[entry.state] = ts
    }
  })

  const getStepState = (index) => {
    if (isFailed && index > currentIndex) return 'upcoming'
    if (isFailed && index === currentIndex) return 'failed'
    if (index < currentIndex) return 'completed'
    if (index === currentIndex) return 'active'
    return 'upcoming'
  }

  return (
    <div className="space-y-0">
      {steps.map((step, idx) => {
        const state = getStepState(idx)
        const styles = STEP_STATUS[state]
        const ts = timestampMap[step.key]
        const isLast = idx === steps.length - 1

        return (
          <div
            key={step.key}
            className="flex items-start gap-4 animate-fade-in"
            style={{ animationDelay: `${idx * 80}ms`, animationFillMode: 'backwards' }}
          >
            {/* Timeline connector */}
            <div className="flex flex-col items-center">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center text-base border-2 shadow-lg transition-all duration-500 ${styles.dot}`}
              >
                {state === 'completed' ? (
                  <svg className="w-4.5 h-4.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                ) : state === 'failed' ? (
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                ) : (
                  <span className="text-sm">{step.icon}</span>
                )}
              </div>
              {!isLast && (
                <div className={`w-0.5 h-14 transition-all duration-700 ${styles.line}`} />
              )}
            </div>

            {/* Step content */}
            <div className="pt-2 pb-6 min-w-0 flex-1">
              <p className={`font-semibold text-sm transition-colors duration-300 ${styles.label}`}>
                {step.label}
              </p>
              {ts && (
                <p className={`text-xs mt-0.5 ${styles.sublabel}`}>
                  {ts.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  {' · '}
                  {ts.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                </p>
              )}
              {state === 'active' && (
                <div className="mt-1.5 flex items-center gap-1.5">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-primary-500" />
                  </span>
                  <span className="text-primary-400 text-xs font-medium">In progress</span>
                </div>
              )}
              {state === 'failed' && (
                <p className="text-rose-400/80 text-xs mt-1">This step encountered an issue</p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
