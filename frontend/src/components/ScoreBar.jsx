export default function ScoreBar({ score = 0, showLabel = false, label = '', height = 'h-2' }) {
  const getColor = () => {
    if (score >= 80) return 'from-emerald-500 to-emerald-400'
    if (score >= 60) return 'from-primary-500 to-primary-400'
    if (score >= 40) return 'from-amber-500 to-amber-400'
    return 'from-rose-500 to-rose-400'
  }

  return (
    <div className="w-full">
      {(showLabel || label) && (
        <div className="flex items-center justify-between mb-1">
          <span className="text-surface-400 text-xs">{label}</span>
          <span className="text-surface-200 text-xs font-semibold">{Math.round(score)}/100</span>
        </div>
      )}
      <div className={`score-bar-container ${height}`}>
        <div
          className={`score-bar-fill bg-gradient-to-r ${getColor()}`}
          style={{ width: `${Math.min(100, Math.max(0, score))}%`, '--score-width': `${score}%` }}
        />
      </div>
    </div>
  )
}
