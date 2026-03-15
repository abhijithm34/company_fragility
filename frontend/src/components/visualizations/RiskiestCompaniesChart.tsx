import { useMemo } from 'react'
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceArea
} from 'recharts'

type Props = {
  data: {
    quarters: string[]
    companies: string[]
    data: Record<string, Record<string, number>>
  }
}

export function RiskiestCompaniesChart({ data }: Props) {
  const chartData = useMemo(() => {
    if (data.quarters.length < 2) return []

    const sortedQuarters = [...data.quarters].sort()
    const startQ = sortedQuarters[0]
    const endQ = sortedQuarters[sortedQuarters.length - 1]

    return data.companies.map((c) => {
      let maxP = 0
      data.quarters.forEach((q) => {
        const p = data.data[c]?.[q]
        if (p !== undefined && p > maxP) maxP = p
      })

      const startProb = data.data[c]?.[startQ] ?? 0
      const endProb = data.data[c]?.[endQ] ?? 0
      const delta = endProb - startProb

      return {
        company: c,
        maxProb: maxP,
        delta: delta,
        isDanger: maxP >= 0.6 && delta > 0.1 // Highly fragile AND rapidly deteriorating
      }
    }).filter(p => p.maxProb > 0)
  }, [data])

  if (chartData.length === 0) {
    return (
      <div style={{ padding: '40px 24px', textAlign: 'center' }}>
        <p style={{ color: 'var(--ca-ink-600)', maxWidth: 500, margin: '0 auto' }}>
          <strong>Insufficient Data for Momentum Plot.</strong><br /><br />
          This scatter plot requires at least 2 quarters to measure how a company's risk probability has changed over time.
        </p>
      </div>
    )
  }

  // Split into danger zone vs normal zone for CSS coloring
  const dangerZone = chartData.filter(d => d.isDanger)
  const normalZone = chartData.filter(d => !d.isDanger)

  return (
    <div style={{ height: 500, width: '100%' }}>
      <p style={{ textAlign: 'center', fontSize: '0.9rem', color: 'var(--ca-ink-600)', marginBottom: '5px' }}>
        <strong>Risk vs. Deterioration:</strong> Companies in the top-right <span style={{color: '#ef4444', fontWeight: 600}}>Danger Zone</span> are highly fragile and rapidly worsening.
      </p>
      <ResponsiveContainer>
        <ScatterChart margin={{ top: 20, right: 30, bottom: 20, left: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          
          <XAxis 
            type="number" 
            dataKey="maxProb" 
            name="Peak Probability" 
            domain={[0, 1]} 
            tick={{ fontSize: 12, fill: '#64748b' }} 
            axisLine={false} 
            tickLine={false}
            tickFormatter={(v) => (v * 100).toFixed(0) + '%'}
            label={{ value: "Peak Distress Probability (T+4)", position: "bottom", style: {fill: '#64748b', fontSize: 13} }}
          />
          
          <YAxis 
            type="number" 
            dataKey="delta" 
            name="Change (Delta)" 
            tick={{ fontSize: 12, fill: '#64748b' }} 
            axisLine={false} 
            tickLine={false}
            tickFormatter={(v) => (v > 0 ? '+' : '') + (v * 100).toFixed(0) + '%'}
            label={{ value: "Probability Change (Start vs End)", angle: -90, position: "left", style: {fill: '#64748b', fontSize: 13} }}
          />
          
          <ZAxis type="category" dataKey="company" name="Company" />

          <Tooltip 
            cursor={{ strokeDasharray: '3 3' }}
            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
            formatter={(val: any, name: any) => {
              if (name === "Peak Probability") return [(val * 100).toFixed(1) + '%', name]
              if (name === "Change (Delta)") return [(val > 0 ? '+' : '') + (val * 100).toFixed(1) + '%', name]
              return [val, name]
            }}
          />

          {/* Highlight the High Risk Zone */}
          <ReferenceArea x1={0.6} x2={1} y1={0.05} y2={1} fill="#ef4444" fillOpacity={0.06} />

          <Scatter name="Normal" data={normalZone} fill="#3b82f6" opacity={0.6} line={false} />
          <Scatter name="Danger" data={dangerZone} fill="#ef4444" opacity={0.9} line={false} />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  )
}
