import { useMemo, useState, useEffect } from 'react'

/**
 * FactorBreakdownChart — Horizontal bar chart showing all 6 dimensions
 * with animated fill and contribution labels.
 *
 * Props:
 *   dimensions — scoreDimensions object { technicalSkills: { rawScore, weight, label }, ... }
 *   animated   — animate bars on mount, default true
 */

const DIMENSION_COLORS = {
  technicalSkills: { bar: 'from-blue-500 to-cyan-400', text: 'text-cyan-400', bg: 'bg-cyan-500/10' },
  experienceSeniority: { bar: 'from-violet-500 to-purple-400', text: 'text-violet-400', bg: 'bg-violet-500/10' },
  assessmentPerformance: { bar: 'from-emerald-500 to-teal-400', text: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  cvQuality: { bar: 'from-amber-500 to-yellow-400', text: 'text-amber-400', bg: 'bg-amber-500/10' },
  culturalFit: { bar: 'from-pink-500 to-rose-400', text: 'text-pink-400', bg: 'bg-pink-500/10' },
  engagement: { bar: 'from-indigo-500 to-blue-400', text: 'text-indigo-400', bg: 'bg-indigo-500/10' },
}

const DIMENSION_ORDER = [
  'technicalSkills',
  'experienceSeniority',
  'assessmentPerformance',
  'cvQuality',
  'culturalFit',
  'engagement',
]

export default function FactorBreakdownChart({ dimensions = {}, animated = true }) {
  const [fillPercent, setFillPercent] = useState(animated ? 0 : 100)

  useEffect(() => {
    if (!animated) return
    const timer = setTimeout(() => setFillPercent(100), 100)
    return () => clearTimeout(timer)
  }, [animated])

  const entries = useMemo(() => {
    return DIMENSION_ORDER.map((key) => {
      const dim = dimensions[key] || {}
      const color = DIMENSION_COLORS[key] || DIMENSION_COLORS.technicalSkills
      return {
        key,
        label: dim.label || key,
        rawScore: dim.rawScore || 0,
        weight: dim.weight || 0,
        weightedScore: dim.weightedScore || 0,
        rationale: dim.rationale || '',
        ...color,
      }
    })
  }, [dimensions])

  return (
    <div className="space-y-4">
      {entries.map((entry, idx) => (
        <div
          key={entry.key}
          className="group"
          style={{
            animationDelay: animated ? `${idx * 100}ms` : '0ms',
            animationFillMode: 'backwards',
          }}
        >
          {/* Header row */}
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-2 min-w-0">
              <span className={`text-sm font-semibold ${entry.text}`}>{entry.label}</span>
              <span className="text-surface-600 text-xs font-medium">
                ({Math.round(entry.weight * 100)}% weight)
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-lg font-extrabold tabular-nums ${
                entry.rawScore >= 80 ? 'text-emerald-400' :
                entry.rawScore >= 60 ? 'text-surface-200' :
                entry.rawScore >= 40 ? 'text-amber-400' :
                'text-rose-400'
              }`}>
                {Math.round(entry.rawScore)}
              </span>
              <span className="text-surface-600 text-xs">/100</span>
            </div>
          </div>

          {/* Bar */}
          <div className="w-full h-2.5 bg-surface-700/40 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full bg-gradient-to-r ${entry.bar} transition-all duration-1000 ease-out`}
              style={{
                width: `${Math.min(100, (entry.rawScore * fillPercent) / 100)}%`,
                transitionDelay: animated ? `${idx * 100}ms` : '0ms',
              }}
            />
          </div>

          {/* Rationale (if available, shown on hover/always in HR mode) */}
          {entry.rationale && (
            <p className="text-surface-500 text-xs mt-1 leading-relaxed opacity-0 group-hover:opacity-100 transition-opacity duration-200 line-clamp-2">
              {entry.rationale}
            </p>
          )}
        </div>
      ))}
    </div>
  )
}
