import { useEffect, useState } from 'react'

type RiskGaugeProps = {
  probability: number | null
  size?: number
}

function getGaugeColor(p: number): string {
  if (p < 0.2) return '#16a34a'
  if (p < 0.4) return '#22c55e'
  if (p < 0.6) return '#eab308'
  if (p < 0.8) return '#f97316'
  return '#dc2626'
}

export function RiskGauge({ probability, size = 80 }: RiskGaugeProps) {
  const [animated, setAnimated] = useState(false)
  const prob = probability ?? 0
  const pct = Math.round(prob * 100)

  const radius = (size - 12) / 2
  const cx = size / 2
  const cy = size / 2
  const circumference = 2 * Math.PI * radius

  useEffect(() => {
    const timer = setTimeout(() => setAnimated(true), 100)
    return () => clearTimeout(timer)
  }, [])

  const offset = animated ? circumference * (1 - prob) : circumference
  const color = getGaugeColor(prob)

  return (
    <div className="ca-gauge-container" style={{ width: size, height: size }}>
      <svg className="ca-gauge-svg" width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle className="ca-gauge-bg" cx={cx} cy={cy} r={radius} />
        <circle
          className="ca-gauge-fill"
          cx={cx}
          cy={cy}
          r={radius}
          stroke={color}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <span className="ca-gauge-label" style={{ color }}>
        {probability != null ? `${pct}%` : '—'}
      </span>
    </div>
  )
}
