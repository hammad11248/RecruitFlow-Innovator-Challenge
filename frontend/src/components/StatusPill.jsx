const STATUS_CONFIG = {
  UPLOADED: { label: 'Uploaded', bg: 'bg-surface-600/20', text: 'text-surface-300', border: 'border-surface-500/30', dot: 'bg-surface-400' },
  PROCESSING: { label: 'Processing', bg: 'bg-amber-500/15', text: 'text-amber-300', border: 'border-amber-500/30', dot: 'bg-amber-400' },
  PROCESSING_FAILED: { label: 'Failed', bg: 'bg-rose-500/15', text: 'text-rose-300', border: 'border-rose-500/30', dot: 'bg-rose-400' },
  AI_SCREENING_PASSED: { label: 'Passed', bg: 'bg-emerald-500/15', text: 'text-emerald-300', border: 'border-emerald-500/30', dot: 'bg-emerald-400' },
  AI_SCREENING_FAILED: { label: 'Screened Out', bg: 'bg-rose-500/15', text: 'text-rose-300', border: 'border-rose-500/30', dot: 'bg-rose-400' },
  ASSESSMENT_SENT: { label: 'Assessment Sent', bg: 'bg-cyan-500/15', text: 'text-cyan-300', border: 'border-cyan-500/30', dot: 'bg-cyan-400' },
  ASSESSMENT_SUBMITTED: { label: 'Submitted', bg: 'bg-blue-500/15', text: 'text-blue-300', border: 'border-blue-500/30', dot: 'bg-blue-400' },
  SCORED: { label: 'Scored', bg: 'bg-violet-500/15', text: 'text-violet-300', border: 'border-violet-500/30', dot: 'bg-violet-400' },
  INTERVIEW_SCHEDULED: { label: 'Interview', bg: 'bg-emerald-500/15', text: 'text-emerald-300', border: 'border-emerald-500/30', dot: 'bg-emerald-400' },
  REJECTED: { label: 'Rejected', bg: 'bg-rose-500/15', text: 'text-rose-300', border: 'border-rose-500/30', dot: 'bg-rose-400' },
}

export default function StatusPill({ status, size = 'md' }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.UPLOADED

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-3 py-1 text-xs',
    lg: 'px-4 py-1.5 text-sm',
  }

  return (
    <span className={`badge ${config.bg} ${config.text} border ${config.border} ${sizeClasses[size]}`} id={`status-${status}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot} mr-1.5`} />
      {config.label}
    </span>
  )
}
