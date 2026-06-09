import { useMemo, useState } from 'react'

const DIMENSION_LABELS = {
  technicalSkills: 'Technical Skills',
  experienceSeniority: 'Experience',
  assessmentPerformance: 'Assessment',
  cvQuality: 'CV Quality',
  culturalFit: 'Cultural Fit',
  engagement: 'Engagement',
}

const DIMENSION_ORDER = [
  'technicalSkills',
  'experienceSeniority',
  'assessmentPerformance',
  'cvQuality',
  'culturalFit',
  'engagement',
]

export default function ScoreRadar({ dimensions = {} }) {
  const [hoveredDim, setHoveredDim] = useState(null)

  const size = 240
  const center = size / 2
  const radius = 90
  const levels = 5

  const scores = useMemo(() => {
    return DIMENSION_ORDER.map((key) => ({
      key,
      label: DIMENSION_LABELS[key] || key,
      score: dimensions[key]?.rawScore || 0,
      rationale: dimensions[key]?.rationale || '',
      weight: dimensions[key]?.weight || 0,
    }))
  }, [dimensions])

  const angleStep = (Math.PI * 2) / scores.length

  const getPoint = (index, value) => {
    const angle = (index * angleStep) - Math.PI / 2
    const r = (value / 100) * radius
    return {
      x: center + r * Math.cos(angle),
      y: center + r * Math.sin(angle),
    }
  }

  const dataPath = useMemo(() => {
    return scores
      .map((s, i) => {
        const { x, y } = getPoint(i, s.score)
        return `${i === 0 ? 'M' : 'L'} ${x} ${y}`
      })
      .join(' ') + ' Z'
  }, [scores])

  const gridPaths = useMemo(() => {
    return Array.from({ length: levels }, (_, levelIdx) => {
      const levelValue = ((levelIdx + 1) / levels) * 100
      return scores
        .map((_, i) => {
          const { x, y } = getPoint(i, levelValue)
          return `${i === 0 ? 'M' : 'L'} ${x} ${y}`
        })
        .join(' ') + ' Z'
    })
  }, [scores])

  const getScoreColor = (score) => {
    if (score >= 80) return '#34d399'
    if (score >= 60) return '#818cf8'
    if (score >= 40) return '#fbbf24'
    return '#fb7185'
  }

  return (
    <div className="flex justify-center relative">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Grid lines */}
        {gridPaths.map((path, idx) => (
          <path
            key={idx}
            d={path}
            fill="none"
            stroke="rgba(71, 85, 105, 0.3)"
            strokeWidth="1"
          />
        ))}

        {/* Axis lines */}
        {scores.map((_, idx) => {
          const { x, y } = getPoint(idx, 100)
          return (
            <line
              key={idx}
              x1={center}
              y1={center}
              x2={x}
              y2={y}
              stroke="rgba(71, 85, 105, 0.2)"
              strokeWidth="1"
            />
          )
        })}

        {/* Data polygon */}
        <path
          d={dataPath}
          fill="rgba(99, 102, 241, 0.15)"
          stroke="rgba(99, 102, 241, 0.8)"
          strokeWidth="2"
          className="transition-all duration-700 ease-out"
        />

        {/* Data points */}
        {scores.map((s, idx) => {
          const { x, y } = getPoint(idx, s.score)
          return (
            <circle
              key={idx}
              cx={x}
              cy={y}
              r={hoveredDim === s.key ? 6 : 4}
              fill={getScoreColor(s.score)}
              stroke="rgba(15, 23, 42, 0.8)"
              strokeWidth="2"
              className="cursor-pointer transition-all duration-200"
              onMouseEnter={() => setHoveredDim(s.key)}
              onMouseLeave={() => setHoveredDim(null)}
            />
          )
        })}

        {/* Labels */}
        {scores.map((s, idx) => {
          const angle = (idx * angleStep) - Math.PI / 2
          const labelR = radius + 28
          const x = center + labelR * Math.cos(angle)
          const y = center + labelR * Math.sin(angle)

          return (
            <text
              key={idx}
              x={x}
              y={y}
              textAnchor="middle"
              dominantBaseline="middle"
              className="fill-surface-400 text-[10px] font-medium cursor-pointer"
              onMouseEnter={() => setHoveredDim(s.key)}
              onMouseLeave={() => setHoveredDim(null)}
            >
              {s.label}
            </text>
          )
        })}
      </svg>

      {/* Tooltip */}
      {hoveredDim && (
        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-2 bg-surface-800 border border-surface-600 rounded-xl px-4 py-3 shadow-2xl z-50 min-w-[200px] animate-fade-in pointer-events-none">
          {scores
            .filter((s) => s.key === hoveredDim)
            .map((s) => (
              <div key={s.key}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-surface-200 font-semibold text-sm">{s.label}</span>
                  <span className="font-bold text-lg" style={{ color: getScoreColor(s.score) }}>
                    {Math.round(s.score)}
                  </span>
                </div>
                <p className="text-surface-400 text-xs">Weight: {Math.round(s.weight * 100)}%</p>
                {s.rationale && (
                  <p className="text-surface-500 text-xs mt-1 border-t border-surface-700/30 pt-1">{s.rationale}</p>
                )}
              </div>
            ))}
        </div>
      )}
    </div>
  )
}
