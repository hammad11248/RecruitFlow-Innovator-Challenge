import { useMemo, useEffect, useState } from 'react'

/**
 * RadialScore — Animated SVG radial/donut chart for individual dimension scores.
 * 
 * Props:
 *   score     — numeric score 0-100
 *   label     — dimension label text
 *   size      — chart diameter (px), default 120
 *   thickness — stroke width, default 8
 *   animated  — animate fill on mount, default true
 *   showLabel — show label text below, default true
 */
export default function RadialScore({
  score = 0,
  label = '',
  size = 120,
  thickness = 8,
  animated = true,
  showLabel = true,
}) {
  const [displayScore, setDisplayScore] = useState(animated ? 0 : score)
  const [fillPercent, setFillPercent] = useState(animated ? 0 : score)

  const center = size / 2
  const radius = (size - thickness * 2) / 2
  const circumference = 2 * Math.PI * radius

  useEffect(() => {
    if (!animated) {
      setDisplayScore(score)
      setFillPercent(score)
      return
    }

    /* Animate the numeric counter */
    const duration = 1200
    const startTime = performance.now()
    let frameId

    const animate = (currentTime) => {
      const elapsed = currentTime - startTime
      const progress = Math.min(elapsed / duration, 1)
      /* Ease-out cubic */
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplayScore(Math.round(eased * score))
      setFillPercent(eased * score)
      if (progress < 1) {
        frameId = requestAnimationFrame(animate)
      }
    }

    frameId = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(frameId)
  }, [score, animated])

  const strokeDashoffset = circumference - (fillPercent / 100) * circumference

  const getColor = useMemo(() => {
    if (score >= 80) return { stroke: '#34d399', text: 'text-emerald-400', glow: 'rgba(52, 211, 153, 0.15)' }
    if (score >= 60) return { stroke: '#818cf8', text: 'text-primary-400', glow: 'rgba(129, 140, 248, 0.15)' }
    if (score >= 40) return { stroke: '#fbbf24', text: 'text-amber-400', glow: 'rgba(251, 191, 36, 0.15)' }
    return { stroke: '#fb7185', text: 'text-rose-400', glow: 'rgba(251, 113, 133, 0.15)' }
  }, [score])

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="transform -rotate-90">
          {/* Background track */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="rgba(51, 65, 85, 0.4)"
            strokeWidth={thickness}
          />
          {/* Animated fill arc */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={getColor.stroke}
            strokeWidth={thickness}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            style={{
              filter: `drop-shadow(0 0 6px ${getColor.glow})`,
              transition: animated ? 'none' : 'stroke-dashoffset 0.8s ease-out',
            }}
          />
        </svg>
        {/* Center score text */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`text-2xl font-extrabold ${getColor.text} tabular-nums`}>
            {displayScore}
          </span>
        </div>
      </div>
      {showLabel && label && (
        <span className="text-xs font-medium text-surface-400 text-center leading-tight max-w-[100px]">
          {label}
        </span>
      )}
    </div>
  )
}
