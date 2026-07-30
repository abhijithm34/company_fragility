import { useMemo } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts'

type Props = {
  data: {
    quarters: string[]
    companies: string[]
    data: Record<string, Record<string, number>>
  }
}

// Generate a distinct color palette for the lines so they're easy to distinguish
const COLORS = [
  '#2563eb', '#dc2626', '#16a34a', '#d97706', '#9333ea', 
  '#0891b2', '#be185d', '#15803d', '#ea580c', '#4f46e5'
]

export function RiskTrajectoriesChart({ data }: Props) {
  // We only want to plot lines if there are <= 15 companies, 
  // otherwise it becomes an unreadable spaghetti chart.
  const isTooManyLines = data.companies.length > 20

  const chartData = useMemo(() => {
    if (isTooManyLines) return []

    return data.quarters.map((q) => {
      const point: any = { quarter: q }
      data.companies.forEach((c) => {
        const prob = data.data[c]?.[q]
        if (prob !== undefined) {
          point[c] = prob
        }
      })
      return point
    })
  }, [data, isTooManyLines])

  if (data.quarters.length === 0) return null

  if (isTooManyLines) {
    return (
      <div style={{ padding: '40px 24px', textAlign: 'center' }}>
        <p style={{ color: 'var(--ca-ink-600)', maxWidth: 500, margin: '0 auto' }}>
          <strong>Too many companies selected ({data.companies.length}).</strong><br/><br/>
          This multi-line chart is unreadable with more than 20 companies. 
          Please use the Local Filter Bar above to select a specific company or raise the Minimum Probability threshold to focus on a smaller subset.
        </p>
      </div>
    )
  }

  return (
    <div style={{ height: 500, width: '100%' }}>
      <ResponsiveContainer>
        <LineChart data={chartData} margin={{ top: 20, right: 30, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
          <XAxis dataKey="quarter" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
          <YAxis domain={[0, 1]} tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} tickFormatter={(v) => (v * 100).toFixed(0) + '%'} />
          <Tooltip
            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
            formatter={(val: any) => [(val * 100).toFixed(2) + '%', 'Probability']}
          />
          <Legend wrapperStyle={{ paddingTop: '20px' }} />
          {data.companies.map((c, index) => (
            <Line
              key={c}
              type="monotone"
              dataKey={c}
              stroke={COLORS[index % COLORS.length]}
              strokeWidth={2}
              dot={{ r: 3, strokeWidth: 0, fill: COLORS[index % COLORS.length] }}
              activeDot={{ r: 6 }}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
