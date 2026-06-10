import { useEffect, useState, useMemo } from 'react'

/**
 * AggregateGauge — Large animated semicircular gauge for the overall composite score.
 *
 * Props:
 *   score    — numeric score 0-100
 *   size     — gauge width (px), default 260
 *   animated — animate on mount, default true
 */
export default function AggregateGauge({ score = 0, size = 260, animated = true }) {
  const [displayScore, setDisplayScore] = useState(animated ? 0 : score)
  const [sweepAngle, setSweepAngle] = useState(animated ? 0 : score)

  useEffect(() => {
    if (!animated) {
      setDisplayScore(score)
      setSweepAngle(score)
      return
    }

    const duration = 1600
    const startTime = performance.now()
    let frameId

    const animate = (currentTime) => {
      const elapsed = currentTime - startTime
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 4)
      setDisplayScore(Math.round(eased * score))
      setSweepAngle(eased * score)
      if (progress < 1) {
        frameId = requestAnimationFrame(animate)
      }
    }

    frameId = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(frameId)
  }, [score, animated])

  const height = size * 0.6
  const centerX = size / 2
  const centerY = height - 20
  const radius = size / 2 - 24
  const thickness = 16

  /* Convert score 0-100 to angle on semicircle (180°) */
  const startAngle = Math.PI
  const endAngle = startAngle + (sweepAngle / 100) * Math.PI

  const bgArcEnd = startAngle + Math.PI

  const polarToXY = (angle, r) => ({
    x: centerX + r * Math.cos(angle),
    y: centerY + r * Math.sin(angle),
  })

  const createArc = (from, to, r) => {
    const start = polarToXY(from, r)
    const end = polarToXY(to, r)
    const largeArc = Math.abs(to - from) > Math.PI ? 1 : 0
    return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}`
  }

  const bgPath = createArc(startAngle, bgArcEnd, radius)
  const fillPath = createArc(startAngle, endAngle, radius)

  const tier = useMemo(() => {
    if (score >= 80) return { label: 'Excellent', color: 'text-emerald-400', bg: 'bg-emerald-500/15', border: 'border-emerald-500/30', stroke: '#34d399', glow: 'rgba(52,211,153,0.3)' }
    if (score >= 60) return { label: 'Strong', color: 'text-primary-400', bg: 'bg-primary-500/15', border: 'border-primary-500/30', stroke: '#818cf8', glow: 'rgba(129,140,248,0.3)' }
    if (score >= 40) return { label: 'Moderate', color: 'text-amber-400', bg: 'bg-amber-500/15', border: 'border-amber-500/30', stroke: '#fbbf24', glow: 'rgba(251,191,36,0.3)' }
    return { label: 'Developing', color: 'text-rose-400', bg: 'bg-rose-500/15', border: 'border-rose-500/30', stroke: '#fb7185', glow: 'rgba(251,113,133,0.3)' }
  }, [score])

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height }}>
        <svg width={size} height={height} viewBox={`0 0 ${size} ${height}`}>
          {/* Gradient definition */}
          <defs>
            <linearGradient id="gauge-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#fb7185" />
              <stop offset="35%" stopColor="#fbbf24" />
              <stop offset="65%" stopColor="#818cf8" />
              <stop offset="100%" stopColor="#34d399" />
            </linearGradient>
            <filter id="gauge-glow">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Tick marks */}
          {[0, 20, 40, 60, 80, 100].map((tick) => {
            const angle = startAngle + (tick / 100) * Math.PI
            const inner = polarToXY(angle, radius - thickness / 2 - 4)
            const outer = polarToXY(angle, radius - thickness / 2 - 12)
            return (
              <g key={tick}>
                <line
                  x1={inner.x} y1={inner.y}
                  x2={outer.x} y2={outer.y}
                  stroke="rgba(100,116,139,0.4)"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
                <text
                  x={outer.x}
                  y={outer.y - 6}
                  textAnchor="middle"
                  className="fill-surface-500 text-[9px] font-medium"
                >
                  {tick}
                </text>
              </g>
            )
          })}

          {/* Background arc */}
          <path
            d={bgPath}
            fill="none"
            stroke="rgba(51, 65, 85, 0.3)"
            strokeWidth={thickness}
            strokeLinecap="round"
          />

          {/* Fill arc */}
          <path
            d={fillPath}
            fill="none"
            stroke="url(#gauge-gradient)"
            strokeWidth={thickness}
            strokeLinecap="round"
            filter="url(#gauge-glow)"
          />

          {/* Needle dot at end of fill */}
          {sweepAngle > 0 && (
            <circle
              cx={polarToXY(endAngle, radius).x}
              cy={polarToXY(endAngle, radius).y}
              r="6"
              fill={tier.stroke}
              stroke="rgba(15, 23, 42, 0.8)"
              strokeWidth="2"
              style={{ filter: `drop-shadow(0 0 6px ${tier.glow})` }}
            />
          )}
        </svg>

        {/* Center score display */}
        <div className="absolute inset-0 flex flex-col items-center justify-end pb-2">
          <span className={`text-5xl font-extrabold ${tier.color} tabular-nums tracking-tight`}>
            {displayScore}
          </span>
          <span className="text-surface-500 text-sm font-medium -mt-1">out of 100</span>
        </div>
      </div>

      {/* Tier badge */}
      <div className={`mt-2 px-4 py-1.5 rounded-full text-sm font-semibold ${tier.bg} ${tier.color} border ${tier.border}`}>
        {tier.label}
      </div>
    </div>
  )
}
