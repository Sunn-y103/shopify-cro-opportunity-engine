import React from 'react'

/**
 * ScoreRing — animated SVG circular progress ring for displaying CRO score.
 *
 * Props:
 *   score:       number 0–100
 *   size:        number (px), default 160
 *   strokeWidth: number (px), default 10
 *   animated:    boolean, default true
 */
export default function ScoreRing({
  score = 0,
  size = 160,
  strokeWidth = 10,
  animated = true,
}) {
  const center = size / 2
  const radius = center - strokeWidth / 2 - 4
  const circumference = 2 * Math.PI * radius
  const clampedScore = Math.min(100, Math.max(0, score))
  const offset = circumference - (clampedScore / 100) * circumference

  // Color based on score
  const getScoreColor = (s) => {
    if (s >= 75) return { stroke: '#059669', text: 'text-emerald-600', label: 'Excellent' }
    if (s >= 50) return { stroke: '#3B82F6', text: 'text-blue-600', label: 'Good' }
    if (s >= 25) return { stroke: '#F59E0B', text: 'text-amber-600', label: 'Fair' }
    return { stroke: '#EF4444', text: 'text-red-600', label: 'Needs Work' }
  }

  const { stroke, text, label } = getScoreColor(clampedScore)

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
        aria-label={`CRO Score: ${score} out of 100`}
        role="img"
      >
        {/* Track ring */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="#F3F4F6"
          strokeWidth={strokeWidth}
        />
        {/* Progress ring */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={animated ? 'score-ring-fill transition-all duration-1000 ease-out' : ''}
        />
      </svg>

      {/* Center content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-4xl font-black tracking-tight leading-none ${text}`}>
          {clampedScore}
        </span>
        <span className="text-xs font-semibold text-gray-400 mt-1 uppercase tracking-widest">
          / 100
        </span>
        <span className={`text-xs font-bold mt-1 ${text}`}>
          {label}
        </span>
      </div>
    </div>
  )
}
