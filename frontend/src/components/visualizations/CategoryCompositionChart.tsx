import { useMemo } from 'react'
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'

type Props = {
  data: {
    quarters: string[]
    companies: string[]
    data: Record<string, Record<string, number>>
  }
}

const RISK_TIERS = [
  { max: 0.2, label: 'Very Safe' },
  { max: 0.4, label: 'Low Risk' },
  { max: 0.6, label: 'Moderate' },
  { max: 0.8, label: 'High Risk' },
  { max: 1.01, label: 'Severe' },
]

function getCategory(prob: number) {
  return RISK_TIERS.find((t) => prob < t.max)?.label ?? 'Severe'
}

export function CategoryCompositionChart({ data }: Props) {
  const chartData = useMemo(() => {
    if (data.quarters.length === 0) {
      return { points: [], startQ: '', endQ: '' }
    }

    const sortedQuarters = [...data.quarters].sort()
    const startQ = sortedQuarters[0]
    const endQ = sortedQuarters[sortedQuarters.length - 1]

    // Initialize counts for each tier with explicit typing
    const dataPoints: { subject: string; startValues: number; endValues: number }[] = RISK_TIERS.map((tier) => ({
      subject: tier.label,
      startValues: 0,
      endValues: 0,
    }))

    data.companies.forEach((c) => {
      // Tally Start Quarter
      const startProb = data.data[c]?.[startQ]
      if (startProb !== undefined) {
        const idx = RISK_TIERS.findIndex(t => t.label === getCategory(startProb))
        if (idx !== -1) dataPoints[idx].startValues++
      }

      // Tally End Quarter
      const endProb = data.data[c]?.[endQ]
      if (endProb !== undefined) {
        const idx = RISK_TIERS.findIndex(t => t.label === getCategory(endProb))
        if (idx !== -1) dataPoints[idx].endValues++
      }
    })

    return {
      points: dataPoints,
      startQ,
      endQ
    }
  }, [data])

  if (!chartData || chartData.points.length === 0) return null

  const { points, startQ, endQ } = chartData
  const showTwoPolygons = startQ !== endQ

  return (
    <div style={{ height: 450, width: '100%' }}>
      <p style={{ textAlign: 'center', fontSize: '0.9rem', color: 'var(--ca-ink-600)', marginBottom: '10px' }}>
        Comparing the shape of the portfolio's risk profile from <strong>{startQ}</strong> to <strong>{endQ}</strong>.
      </p>
      <ResponsiveContainer>
        <RadarChart cx="50%" cy="50%" outerRadius="75%" data={points} margin={{ top: 20, right: 30, bottom: 20, left: 30 }}>
          <PolarGrid stroke="#e2e8f0" />
          <PolarAngleAxis dataKey="subject" tick={{ fill: '#475569', fontSize: 13, fontWeight: 600 }} />
          <PolarRadiusAxis angle={90} domain={[0, 'auto']} tick={{ fill: '#94a3b8', fontSize: 11 }} />
          
          <Tooltip 
            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
          />
          <Legend wrapperStyle={{ paddingTop: '20px' }} />
          
          <Radar 
            name={`Start (${startQ})`} 
            dataKey="startValues" 
            stroke="#94a3b8" 
            fill="#cbd5e1" 
            fillOpacity={0.4} 
          />
          
          {showTwoPolygons && (
            <Radar 
              name={`End (${endQ})`} 
              dataKey="endValues" 
              stroke="#ef4444" 
              fill="#ef4444" 
              fillOpacity={0.4} 
            />
          )}
        </RadarChart>
      </ResponsiveContainer>
    </div>
  )
}
