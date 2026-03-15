import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { RiskCategoryBadge } from '../components/RiskCategoryBadge'
import { DashboardCard } from '../components/DashboardCard'
import { RiskGauge } from '../components/RiskGauge'
import { MetricsTable } from '../components/MetricsTable'
import { ProsConsPanel } from '../components/ProsConsPanel'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  ReferenceLine,
} from 'recharts'
import './CompanyAnalyticsPage.css'

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000'

type CompanyProfile = {
  companyName: string
  latest: {
    quarter: string | null
    probability: number | null
    riskCategory: string
    isHighRisk: boolean
  }
  probabilityHistory: { quarter: string; probability: number | null }[]
  financialIndicatorHistory: {
    quarter: string
    leverage: number | null
    liquidity: number | null
    profitability: number | null
    cashFlow: number | null
  }[]
  modelExplanation: {
    useShap?: boolean
    factorsIncreasingRisk: { feature: string; value: number; benchmark: number; contribution?: number }[]
    factorsDecreasingRisk: { feature: string; value: number; benchmark: number; contribution?: number }[]
    featureImportance: { feature: string; importance: number }[]
  }
}

type TimeRange = 'all' | '8q' | '4q'

/* ───────── Helpers ───────── */

function formatPct(v: number | null, decimals = 1): string {
  return v != null ? `${(v * 100).toFixed(decimals)}%` : '—'
}

function formatNum(v: number | null, decimals = 3): string {
  return v != null ? v.toFixed(decimals) : '—'
}

function getProbColor(p: number | null): string {
  if (p == null) return '#64748b'
  if (p < 0.2) return '#16a34a'
  if (p < 0.4) return '#22c55e'
  if (p < 0.6) return '#eab308'
  if (p < 0.8) return '#f97316'
  return '#dc2626'
}

function generateInsight(
  feature: string,
  value: number,
  benchmark: number,
  direction: 'pro' | 'con',
  isShap: boolean,
): string {
  if (isShap) {
    const magnitude = Math.abs(value).toFixed(4)
    return direction === 'pro'
      ? `${feature} reduces risk (contribution: −${magnitude})`
      : `${feature} increases risk (contribution: +${magnitude})`
  }
  const v = value.toFixed(3)
  const b = benchmark.toFixed(3)
  return direction === 'pro'
    ? `${feature} is favorable (${v} vs benchmark ${b})`
    : `${feature} is concerning (${v} vs benchmark ${b})`
}

function sliceByRange<T>(arr: T[], range: TimeRange): T[] {
  if (range === '4q') return arr.slice(-4)
  if (range === '8q') return arr.slice(-8)
  return arr
}

/* ───────── Custom Recharts Tooltip ───────── */

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.[0]) return null
  const val = payload[0].value
  return (
    <div className="ca-tooltip">
      <p className="ca-tooltip-label">{label}</p>
      <p className="ca-tooltip-value">{formatPct(val, 2)}</p>
    </div>
  )
}

/* ───────── Main Component ───────── */

export function CompanyRiskProfilePage() {
  const { companyName } = useParams<{ companyName: string }>()
  const [profile, setProfile] = useState<CompanyProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [timeRange, setTimeRange] = useState<TimeRange>('all')

  useEffect(() => {
    if (!companyName) return
    setLoading(true)
    setError(null)
    fetch(`${API_BASE}/api/companies/${encodeURIComponent(companyName)}`)
      .then((res) => {
        if (!res.ok) {
          if (res.status === 404) return res.json().then((b) => { throw new Error(b.message || 'Company not found') })
          throw new Error('Failed to load company profile')
        }
        return res.json()
      })
      .then((data: CompanyProfile) => setProfile(data))
      .catch((e) => setError(e instanceof Error ? e.message : 'Unexpected error'))
      .finally(() => setLoading(false))
  }, [companyName])

  const probabilityHistory = profile ? profile.probabilityHistory : []
  const financialIndicatorHistory = profile ? profile.financialIndicatorHistory : []

  /* ── Loading ── */
  if (loading) {
    return (
      <div className="ca-loading">
        <div className="ca-spinner" />
        <span className="ca-loading-text">Loading analytics for {companyName}…</span>
      </div>
    )
  }

  /* ── Error ── */
  if (error) {
    return (
      <div className="ca-page">
        <header className="ca-header">
          <div className="ca-header-left"><div className="ca-header-info"><h2 className="ca-company-name">Company Analytics</h2></div></div>
        </header>
        <DashboardCard title="Error" iconBg="rgba(220,38,38,0.08)">
          <p className="ca-error-msg">{error}</p>
          <p style={{ color: '#64748b', fontSize: '0.9rem' }}>
            No scored data found for this company. Run scoring from the Upload &amp; Score page first.
          </p>
          <Link to="/upload" className="ca-btn ca-btn-primary" style={{ display: 'inline-flex', marginTop: '0.75rem', textDecoration: 'none' }}>
            Upload &amp; Score
          </Link>
        </DashboardCard>
      </div>
    )
  }

  if (!profile) return null

  const { latest, modelExplanation } = profile
  
  const probPct = formatPct(latest.probability)
  const probColor = getProbColor(latest.probability)

  /* ── Ensure chart data has no nulls ── */
  const probabilityChartData = probabilityHistory.map((p: any, i: number, arr: any[]) => ({
    quarter: p.quarter,
    probability: p.probability ?? (i > 0 ? (arr[i - 1].probability ?? 0) : 0),
  }))
  const chartDataForRange = sliceByRange(
    probabilityChartData.length === 1
      ? [probabilityChartData[0], { ...probabilityChartData[0], quarter: probabilityChartData[0].quarter + ' ' }]
      : probabilityChartData,
    timeRange,
  )

  /* ── Build metrics table data ── */
  const latestFinancials = financialIndicatorHistory.length > 0
    ? financialIndicatorHistory[financialIndicatorHistory.length - 1]
    : null

  const metricsData = [
    { label: 'Fragility Probability (T+4)', value: <span style={{ color: probColor, fontWeight: 700 }}>{probPct}</span> },
    { label: 'Risk Category', value: <RiskCategoryBadge category={latest.riskCategory} /> },
    { label: 'Predicted Label', value: latest.isHighRisk ? 'Distress (1)' : 'Safe (0)' },
    { label: 'Debt / Assets', value: formatNum(latestFinancials?.leverage ?? null) },
    { label: 'Liquidity (WC/Assets)', value: formatNum(latestFinancials?.liquidity ?? null) },
    { label: 'Profitability (EBIT)', value: formatNum(latestFinancials?.profitability ?? null) },
    { label: 'Cash Flow / Assets', value: formatNum(latestFinancials?.cashFlow ?? null) },
    { label: 'Latest Quarter', value: latest.quarter ?? '—' },
  ]

  /* ── Build feature analysis chart data ── */
  const featureChartData = [
    ...modelExplanation.factorsIncreasingRisk.map((f) => ({
      feature: f.feature,
      contribution: f.contribution ?? f.value,
      type: 'increase' as const,
    })),
    ...modelExplanation.factorsDecreasingRisk.map((f) => ({
      feature: f.feature,
      contribution: f.contribution ?? -f.value,
      type: 'decrease' as const,
    })),
  ].sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution))

  const featureBarHeight = Math.max(240, featureChartData.length * 36)

  /* ── Build Pros & Cons ── */
  const pros = modelExplanation.factorsDecreasingRisk.map((f) =>
    generateInsight(f.feature, f.contribution ?? f.value, f.benchmark, 'pro', !!modelExplanation.useShap),
  )
  const cons = modelExplanation.factorsIncreasingRisk.map((f) =>
    generateInsight(f.feature, f.contribution ?? f.value, f.benchmark, 'con', !!modelExplanation.useShap),
  )


  return (
    <div className="ca-page">
      {/* ═══════════════════════════════════════
          SECTION 1: Company Header
         ═══════════════════════════════════════ */}
      <header className="ca-header">
        <div className="ca-header-left">
          <RiskGauge probability={latest.probability} size={80} />
          <div className="ca-header-info">
            <h2 className="ca-company-name">{profile.companyName}</h2>
            <div className="ca-header-meta">
              <RiskCategoryBadge category={latest.riskCategory} />
              <span className="ca-header-divider" />
              <span className="ca-header-meta-item">
                Probability (T+4): <span className="ca-header-prob" style={{ color: probColor }}>{probPct}</span>
              </span>
              <span className="ca-header-divider" />
              <span className="ca-header-meta-item">
                Quarter: <strong>{latest.quarter ?? '—'}</strong>
              </span>
              {latest.isHighRisk && (
                <>
                  <span className="ca-header-divider" />
                  <span style={{ fontSize: '0.82rem', color: '#dc2626', fontWeight: 600 }}>High Risk</span>
                </>
              )}
            </div>
          </div>
        </div>
      </header>


      {/* ═══════════════════════════════════════
          SECTION 2 & 3: Metrics Panel + Probability Chart (side by side)
         ═══════════════════════════════════════ */}
      <div className="ca-grid-2">
        {/* ── Key Risk Metrics ── */}
        <DashboardCard
          title="Key Risk Metrics"
          subtitle="Model-derived financial indicators"
          iconBg="hsla(236, 96%, 70%, 0.08)"
        >
          <MetricsTable metrics={metricsData} />
        </DashboardCard>

        {/* ── Risk Probability Chart ── */}
        <DashboardCard
          title="Risk Probability Trend"
          subtitle="Fragility probability over time"
          iconBg="hsla(163, 70%, 70%, 0.12)"
          headerRight={
            probabilityHistory.length > 4 ? (
              <div className="ca-chart-filters">
                {(['all', '8q', '4q'] as TimeRange[]).map((r) => (
                  <button
                    key={r}
                    className={`ca-chart-filter-btn ${timeRange === r ? 'active' : ''}`}
                    onClick={() => setTimeRange(r)}
                  >
                    {r === 'all' ? 'All' : r === '8q' ? 'Last 8Q' : 'Last 4Q'}
                  </button>
                ))}
              </div>
            ) : undefined
          }
        >
          {probabilityHistory.length > 0 ? (
            <div className="ca-chart-container" style={{ height: 320 }}>
              <ResponsiveContainer width="100%" height={320}>
                <AreaChart data={chartDataForRange} margin={{ top: 12, right: 20, left: 0, bottom: 8 }}>
                  <defs>
                    <linearGradient id="probGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(243, 93%, 67%)" stopOpacity={0.3} />
                      <stop offset="50%" stopColor="hsl(243, 93%, 67%)" stopOpacity={0.08} />
                      <stop offset="100%" stopColor="hsl(243, 93%, 67%)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsla(216, 41%, 87%, 0.6)" vertical={false} />
                  <XAxis
                    dataKey="quarter"
                    tick={{ fontSize: 11, fill: 'hsl(207, 12%, 43%)' }}
                    axisLine={{ stroke: 'hsla(216, 41%, 87%, 0.8)' }}
                    tickLine={false}
                  />
                  <YAxis
                    domain={[0, 1]}
                    tick={{ fontSize: 11, fill: 'hsl(207, 12%, 43%)' }}
                    tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
                    axisLine={false}
                    tickLine={false}
                    width={40}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <ReferenceLine
                    y={0.5}
                    stroke="hsl(0, 89%, 63%)"
                    strokeDasharray="8 4"
                    strokeOpacity={0.4}
                    strokeWidth={1.5}
                  />
                  <Area
                    type="natural"
                    dataKey="probability"
                    name="Fragility Probability"
                    stroke="hsl(243, 93%, 67%)"
                    strokeWidth={2}
                    fill="url(#probGradient)"
                    dot={{ r: 3, fill: 'hsl(243, 93%, 67%)', strokeWidth: 1.5, stroke: '#fff' }}
                    activeDot={{ r: 5, fill: 'hsl(243, 93%, 67%)', strokeWidth: 2, stroke: '#fff' }}
                    connectNulls
                    animationDuration={1200}
                    animationEasing="ease-out"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p style={{ color: '#94a3b8', fontSize: '0.9rem', textAlign: 'center', padding: '2rem 0' }}>
              No probability history available.
            </p>
          )}
        </DashboardCard>
      </div>

      {/* ═══════════════════════════════════════
          SECTION 4: Model Feature Analysis
         ═══════════════════════════════════════ */}
      {featureChartData.length > 0 && (
        <DashboardCard
          title="Model Feature Analysis"
          subtitle={
            modelExplanation.useShap
              ? 'SHAP contributions — which variables most influenced this prediction'
              : 'Features compared to historical benchmarks'
          }
          iconBg="rgba(99, 102, 241, 0.08)"
        >
          <p className="ca-section-label" style={{ marginBottom: '0.5rem' }}>
            Feature Contributions
          </p>
          <div className="ca-chart-container" style={{ height: featureBarHeight }}>
            <ResponsiveContainer width="100%" height={featureBarHeight}>
              <BarChart
                data={featureChartData}
                layout="vertical"
                margin={{ top: 4, right: 32, left: 8, bottom: 4 }}
                barGap={2}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="hsla(216, 41%, 87%, 0.5)" horizontal={false} />
                <XAxis
                  type="number"
                  tick={{ fontSize: 10, fill: 'hsl(207, 12%, 43%)' }}
                  tickFormatter={(v) => (v >= 0 ? `+${v.toFixed(3)}` : v.toFixed(3))}
                  axisLine={{ stroke: 'hsla(216, 41%, 87%, 0.8)' }}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="feature"
                  width={180}
                  tick={{ fontSize: 11, fill: 'hsl(207, 12%, 43%)' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  formatter={(v: unknown) => {
                    const n = Number(v)
                    return [
                      (n >= 0 ? `+${n.toFixed(4)}` : n.toFixed(4)) + ' (impact)',
                      'Contribution',
                    ]
                  }}
                  contentStyle={{
                    background: 'var(--ca-base, #fff)',
                    border: '1.5px solid hsla(216, 41%, 87%, 0.8)',
                    borderRadius: '6px',
                    color: 'hsl(240, 16%, 16%)',
                    fontSize: '0.82rem',
                    boxShadow: '0 8px 24px hsla(219, 37%, 18%, 0.12)',
                  }}
                  labelStyle={{ color: 'hsl(207, 12%, 43%)', fontSize: '0.72rem', textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}
                />
                <ReferenceLine x={0} stroke="hsl(207, 12%, 43%)" strokeWidth={1} strokeOpacity={0.5} />
                <Bar dataKey="contribution" name="Contribution" radius={[0, 4, 4, 0]} maxBarSize={18} animationDuration={800}>
                  {featureChartData.map((entry, i) => (
                    <Cell
                      key={i}
                      fill={entry.type === 'increase' ? 'hsl(0, 89%, 63%)' : 'hsl(89, 89%, 38%)'}
                      fillOpacity={0.75}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* ── Feature Importance Bars (mini) ── */}
          {modelExplanation.featureImportance.length > 0 && (
            <div style={{ marginTop: 'var(--ca-spacing-lg)' }}>
              <p className="ca-section-label" style={{ marginBottom: '0.75rem' }}>
                {modelExplanation.useShap ? 'Absolute Impact Ranking' : 'Relative Feature Importance'}
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {modelExplanation.featureImportance.slice(0, 8).map((fi, i) => {
                  const maxImp = modelExplanation.featureImportance[0]?.importance ?? 1
                  const widthPct = Math.max(4, (fi.importance / maxImp) * 100)
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                      <span style={{ fontSize: '0.82rem', color: '#475569', width: 180, flexShrink: 0, textAlign: 'right' }}>
                        {fi.feature}
                      </span>
                      <div style={{ flex: 1, background: '#f1f5f9', borderRadius: 6, height: 10, overflow: 'hidden' }}>
                        <div
                          style={{
                            width: `${widthPct}%`,
                            height: '100%',
                            borderRadius: 6,
                            background: 'linear-gradient(90deg, #6366f1, #818cf8)',
                            transition: 'width 0.8s ease-out',
                          }}
                        />
                      </div>
                      <span style={{ fontSize: '0.75rem', color: '#94a3b8', width: 50, fontFamily: 'var(--ca-font-mono)' }}>
                        {modelExplanation.useShap ? fi.importance.toFixed(4) : `${(fi.importance * 100).toFixed(0)}%`}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </DashboardCard>
      )}

      {/* ═══════════════════════════════════════
          SECTION 5: Pros & Cons / Insights
         ═══════════════════════════════════════ */}
      <DashboardCard
        title="Risk Assessment Summary"
        subtitle="Based on model feature analysis"
        iconBg="rgba(234, 179, 8, 0.08)"
      >
        <ProsConsPanel pros={pros} cons={cons} />
      </DashboardCard>

      {/* ═══════════════════════════════════════
          SECTION 6: Financial Indicator Trends (bonus detail section)
         ═══════════════════════════════════════ */}
      {financialIndicatorHistory.length > 0 && (
        <>
          <p className="ca-section-label">Financial Indicator Trends</p>
          <div className="ca-indicator-grid">
            {([
              { key: 'leverage' as const, label: 'Leverage (Debt/Assets)', color: '#7c3aed' },
              { key: 'liquidity' as const, label: 'Liquidity (WC/Assets)', color: '#059669' },
              { key: 'profitability' as const, label: 'Profitability (EBIT)', color: '#d97706' },
              { key: 'cashFlow' as const, label: 'Cash Flow / Assets', color: '#0284c7' },
            ] as const).map(({ key, label, color }) => {
              const chartData = financialIndicatorHistory.map((p: any, i: number, arr: any[]) => ({
                quarter: p.quarter,
                value: p[key] ?? (i > 0 ? (arr[i - 1][key] ?? 0) : 0),
              }))
              const data =
                chartData.length === 1
                  ? [chartData[0], { ...chartData[0], quarter: chartData[0].quarter + ' ' }]
                  : chartData
              return (
                <DashboardCard key={key} title={label} iconBg={`${color}14`}>
                  <div className="ca-chart-container" style={{ height: 160 }}>
                    <ResponsiveContainer width="100%" height={160}>
                      <AreaChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
                        <defs>
                          <linearGradient id={`grad-${key}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={color} stopOpacity={0.15} />
                            <stop offset="100%" stopColor={color} stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsla(216, 41%, 87%, 0.5)" vertical={false} />
                        <XAxis dataKey="quarter" tick={{ fontSize: 9, fill: 'hsl(207, 12%, 43%)' }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 9, fill: 'hsl(207, 12%, 43%)' }} axisLine={false} tickLine={false} width={36} />
                        <Tooltip
                          contentStyle={{
                            background: 'var(--ca-base, #fff)',
                            border: '1.5px solid hsla(216, 41%, 87%, 0.8)',
                            borderRadius: '6px',
                            color: 'hsl(240, 16%, 16%)',
                            fontSize: '0.78rem',
                            boxShadow: '0 4px 16px hsla(219, 37%, 18%, 0.1)',
                          }}
                        />
                        <Area
                          type="natural"
                          dataKey="value"
                          name={label}
                          stroke={color}
                          strokeWidth={1.5}
                          fill={`url(#grad-${key})`}
                          dot={{ r: 2, fill: color, strokeWidth: 1, stroke: '#fff' }}
                          activeDot={{ r: 4, fill: color, strokeWidth: 1.5, stroke: '#fff' }}
                          connectNulls
                          animationDuration={1000}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </DashboardCard>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
