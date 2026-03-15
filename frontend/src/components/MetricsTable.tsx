import type { ReactNode } from 'react'

export type MetricRow = {
  label: string
  value: ReactNode
}

type MetricsTableProps = {
  metrics: MetricRow[]
}

export function MetricsTable({ metrics }: MetricsTableProps) {
  return (
    <table className="ca-metrics-table">
      <tbody>
        {metrics.map((m, i) => (
          <tr key={i}>
            <td>{m.label}</td>
            <td>{m.value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
