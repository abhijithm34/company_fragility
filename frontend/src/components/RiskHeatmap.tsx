import '../pages/RiskHeatmapPage.css'

type HeatmapData = {
  quarters: string[]
  companies: string[]
  data: Record<string, Record<string, number>>
}

type Props = {
  heatmap: HeatmapData
}

function getInterpolatedColor(prob: number) {
  if (prob < 0.2) return `hsla(89, 89%, 38%, ${Math.max(0.1, prob / 0.2)})` // Green shades
  if (prob < 0.5) {
    // Green to Orange transition
    const ratio = (prob - 0.2) / 0.3
    return `hsla(${89 - ratio * 59}, 89%, ${38 + ratio * 12}%, ${0.5 + ratio * 0.5})`
  }
  // Orange to Red transition
  const ratio = (prob - 0.5) / 0.5
  return `hsla(${30 - ratio * 30}, 89%, ${50 + ratio * 13}%, ${0.6 + ratio * 0.4})`
}

export function RiskHeatmap({ heatmap }: Props) {
  const { quarters, companies, data } = heatmap

  if (quarters.length === 0 || companies.length === 0) {
    return <p className="ca-error-msg" style={{ marginTop: '1rem' }}>No data matches the selected filters.</p>
  }

  return (
    <div>
      <div className="ca-heatmap-legend">
        <span>Low Risk</span>
        <div className="ca-heatmap-legend-gradient" />
        <span>High Risk (Distress)</span>
      </div>

      <div className="ca-heatmap-container">
        <div
          className="ca-heatmap-grid"
          style={{ gridTemplateColumns: `200px repeat(${quarters.length}, minmax(80px, 1fr))` }}
        >
          {/* Header Row */}
          <div className="ca-heatmap-row">
            <div className="ca-heatmap-cell ca-heatmap-header ca-heatmap-company-cell">Company</div>
            {quarters.map((q) => (
              <div key={q} className="ca-heatmap-cell ca-heatmap-header">
                {q}
              </div>
            ))}
          </div>

          {/* Data Rows */}
          {companies.map((company) => (
            <div key={company} className="ca-heatmap-row">
              <div className="ca-heatmap-cell ca-heatmap-company-cell">
                <a
                  href={`/companies/${encodeURIComponent(company)}`}
                  style={{ color: 'inherit', textDecoration: 'none' }}
                >
                  {company}
                </a>
              </div>
              {quarters.map((q) => {
                const prob = data[company][q]

                if (prob === undefined) {
                  return (
                    <div
                      key={q}
                      className="ca-heatmap-cell ca-heatmap-value-cell ca-heatmap-empty"
                      title={`${company} - ${q}\nNo data`}
                    >
                      —
                    </div>
                  )
                }

                const bgColor = getInterpolatedColor(prob)
                const textColor = prob > 0.6 ? '#fff' : 'var(--ca-ink-900)'

                return (
                  <div
                    key={q}
                    className="ca-heatmap-cell ca-heatmap-value-cell"
                    style={{ background: bgColor, color: textColor }}
                    title={`${company} - ${q}\nProbability (T+4): ${(prob * 100).toFixed(1)}%`}
                  >
                    {prob.toFixed(3)}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
