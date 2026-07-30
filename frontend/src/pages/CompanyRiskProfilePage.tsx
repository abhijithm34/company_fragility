import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  AreaChart, Area, LineChart, Line, BarChart, Bar, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts'
import { API_BASE } from '../config/api'
import './CompanyAnalyticsPage.css'

// ─── Types ──────────────────────────────────────────────

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

type TimeRange = '4q' | '8q' | '20q' | 'all'
type ChartPanel = 'probability' | 'leverage' | 'liquidity' | 'profitability' | 'cashFlow' | 'importance'

// ─── Helpers ────────────────────────────────────────────

function getRiskColor(cat: string): string {
  if (cat.includes('Very Safe')) return '#16a34a'
  if (cat.includes('Low')) return '#22c55e'
  if (cat.includes('Moderate')) return '#ca8a04'
  if (cat.includes('High')) return '#ea580c'
  return '#dc2626'
}

function formatQ(q: string): string {
  // 2024-Q1 from 2024-03-31
  const d = new Date(q)
  const yr = d.getFullYear()
  const m = d.getMonth() + 1
  if (m <= 3) return `${yr} Q4`
  if (m <= 6) return `${yr} Q1`
  if (m <= 9) return `${yr} Q2`
  return `${yr} Q3`
}

// ─── Expandable Chart Panel Component ───────────────────

function ChartSection({
  title,
  subtitle,
  panelId,
  expanded,
  onToggle,
  children,
}: {
  title: string
  subtitle?: string
  panelId: ChartPanel
  expanded: ChartPanel | null
  onToggle: (id: ChartPanel) => void
  children: React.ReactNode
}) {
  const isExpanded = expanded === panelId
  const isAnyExpanded = expanded !== null
  const isVisible = !isAnyExpanded || isExpanded

  if (!isVisible) return null

  return (
    <div className={`tv-chart-section ${isExpanded ? 'tv-chart-expanded' : ''}`}>
      <div className="tv-chart-header" onClick={() => onToggle(panelId)}>
        <div>
          <h4 className="tv-chart-title">{title}</h4>
          {subtitle && <span className="tv-chart-subtitle">{subtitle}</span>}
        </div>
        <button className="tv-expand-btn" title={isExpanded ? 'Collapse' : 'Expand'}>
          {isExpanded ? (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 10L8 6L12 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 6L8 10L12 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
          )}
        </button>
      </div>
      <div className={`tv-chart-body ${isExpanded ? 'tv-chart-body-expanded' : ''}`}>
        {children}
      </div>
    </div>
  )
}

// ─── Custom Tooltip ─────────────────────────────────────

function TVTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="tv-tooltip">
      <div className="tv-tooltip-label">{label}</div>
      {payload.map((p: any, i: number) => (
        <div key={i} className="tv-tooltip-row">
          <span className="tv-tooltip-dot" style={{ background: p.color }} />
          <span className="tv-tooltip-name">{p.name}</span>
          <span className="tv-tooltip-val">{typeof p.value === 'number' ? p.value.toFixed(4) : '—'}</span>
        </div>
      ))}
    </div>
  )
}

// ─── Main Page ──────────────────────────────────────────

export function CompanyRiskProfilePage() {
  const { companyName } = useParams<{ companyName: string }>()
  const [profile, setProfile] = useState<CompanyProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [timeRange, setTimeRange] = useState<TimeRange>('all')
  const [expandedPanel, setExpandedPanel] = useState<ChartPanel | null>(null)

  useEffect(() => {
    if (!companyName) return
    setLoading(true)
    setError(null)
    fetch(`${API_BASE}/api/companies/${encodeURIComponent(companyName)}`)
      .then((r) => {
        if (!r.ok) throw new Error(r.status === 404 ? 'Company not found. Score it first.' : 'Failed to load.')
        return r.json()
      })
      .then(setProfile)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [companyName])

  const togglePanel = (id: ChartPanel) => {
    setExpandedPanel((prev) => (prev === id ? null : id))
  }

  // Filter data by time range
  function filterByTime<T extends { quarter: string }>(data: T[]): T[] {
    if (timeRange === 'all') return data
    const n = timeRange === '4q' ? 4 : timeRange === '8q' ? 8 : 20
    return data.slice(-n)
  }

  if (loading) {
    return (
      <div className="tv-loading">
        <div className="spinner" />
        <span>Loading company data...</span>
      </div>
    )
  }

  if (error || !profile) {
    return (
      <div className="tv-error">
        <h3>Unable to load</h3>
        <p>{error || 'No data available'}</p>
        <Link to="/companies" className="primary-button">← Back</Link>
      </div>
    )
  }

  const { latest, probabilityHistory, financialIndicatorHistory, modelExplanation } = profile
  const filteredProb = filterByTime(probabilityHistory)
  const filteredFin = filterByTime(financialIndicatorHistory)
  const probColor = getRiskColor(latest.riskCategory)

  return (
    <div className="tv-page">
      {/* ─── Top Bar ─── */}
      <div className="tv-topbar">
        <div className="tv-topbar-left">
          <Link to="/companies" className="tv-back-link">←</Link>
          <div>
            <h1 className="tv-company-name">{profile.companyName}</h1>
            <div className="tv-company-meta">
              {latest.quarter && <span>Latest: {formatQ(latest.quarter)}</span>}
            </div>
          </div>
        </div>
        <div className="tv-topbar-right">
          <div className="tv-risk-badge" style={{ borderColor: probColor, color: probColor }}>
            {latest.riskCategory}
          </div>
          <div className="tv-prob-display" style={{ color: probColor }}>
            {latest.probability != null ? (latest.probability * 100).toFixed(1) + '%' : '—'}
          </div>
        </div>
      </div>

      {/* ─── Time Range Filter ─── */}
      <div className="tv-controls">
        <div className="tv-time-selector">
          {(['4q', '8q', '20q', 'all'] as TimeRange[]).map((r) => (
            <button
              key={r}
              className={`tv-time-btn ${timeRange === r ? 'active' : ''}`}
              onClick={() => setTimeRange(r)}
            >
              {r === 'all' ? 'ALL' : r.toUpperCase()}
            </button>
          ))}
        </div>
        <div className="tv-controls-hint">
          Click any chart header to expand • {filteredProb.length} quarters shown
        </div>
      </div>

      {/* ─── Chart Grid ─── */}
      <div className={`tv-charts-grid ${expandedPanel ? 'tv-charts-single' : ''}`}>

        {/* Probability History */}
        <ChartSection
          title="Distress Probability"
          subtitle="Model predicted probability over time"
          panelId="probability"
          expanded={expandedPanel}
          onToggle={togglePanel}
        >
          <ResponsiveContainer width="100%" height={expandedPanel === 'probability' ? 400 : 200}>
            <AreaChart data={filteredProb.map(d => ({ ...d, quarter: formatQ(d.quarter) }))}>
              <defs>
                <linearGradient id="probGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={probColor} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={probColor} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e3e8ee" vertical={false} />
              <XAxis dataKey="quarter" tick={{ fontSize: 10, fill: '#8792a2' }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 1]} tick={{ fontSize: 10, fill: '#8792a2' }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v*100).toFixed(0)}%`} />
              <Tooltip content={<TVTooltip />} />
              <ReferenceLine y={0.5} stroke="#e3e8ee" strokeDasharray="4 4" label={{ value: 'Threshold', position: 'right', fontSize: 9, fill: '#8792a2' }} />
              <Area type="monotone" dataKey="probability" stroke={probColor} fill="url(#probGrad)" strokeWidth={2} dot={false} name="Probability" />
            </AreaChart>
          </ResponsiveContainer>
        </ChartSection>

        {/* Leverage */}
        <ChartSection
          title="Leverage"
          subtitle="Debt/Assets & Leverage×Repo"
          panelId="leverage"
          expanded={expandedPanel}
          onToggle={togglePanel}
        >
          <ResponsiveContainer width="100%" height={expandedPanel === 'leverage' ? 400 : 200}>
            <LineChart data={filteredFin.map(d => ({ ...d, quarter: formatQ(d.quarter) }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e3e8ee" vertical={false} />
              <XAxis dataKey="quarter" tick={{ fontSize: 10, fill: '#8792a2' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#8792a2' }} axisLine={false} tickLine={false} />
              <Tooltip content={<TVTooltip />} />
              <Line type="monotone" dataKey="leverage" stroke="#ef4444" strokeWidth={2} dot={false} name="Leverage" />
            </LineChart>
          </ResponsiveContainer>
        </ChartSection>

        {/* Liquidity */}
        <ChartSection
          title="Liquidity"
          subtitle="Working Capital / Assets"
          panelId="liquidity"
          expanded={expandedPanel}
          onToggle={togglePanel}
        >
          <ResponsiveContainer width="100%" height={expandedPanel === 'liquidity' ? 400 : 200}>
            <AreaChart data={filteredFin.map(d => ({ ...d, quarter: formatQ(d.quarter) }))}>
              <defs>
                <linearGradient id="liqGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e3e8ee" vertical={false} />
              <XAxis dataKey="quarter" tick={{ fontSize: 10, fill: '#8792a2' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#8792a2' }} axisLine={false} tickLine={false} />
              <Tooltip content={<TVTooltip />} />
              <Area type="monotone" dataKey="liquidity" stroke="#3b82f6" fill="url(#liqGrad)" strokeWidth={2} dot={false} name="Liquidity" />
            </AreaChart>
          </ResponsiveContainer>
        </ChartSection>

        {/* Profitability */}
        <ChartSection
          title="Profitability"
          subtitle="EBIT/Assets & Interest Coverage"
          panelId="profitability"
          expanded={expandedPanel}
          onToggle={togglePanel}
        >
          <ResponsiveContainer width="100%" height={expandedPanel === 'profitability' ? 400 : 200}>
            <LineChart data={filteredFin.map(d => ({ ...d, quarter: formatQ(d.quarter) }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e3e8ee" vertical={false} />
              <XAxis dataKey="quarter" tick={{ fontSize: 10, fill: '#8792a2' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#8792a2' }} axisLine={false} tickLine={false} />
              <Tooltip content={<TVTooltip />} />
              <Line type="monotone" dataKey="profitability" stroke="#16a34a" strokeWidth={2} dot={false} name="Profitability" />
            </LineChart>
          </ResponsiveContainer>
        </ChartSection>

        {/* Cash Flow */}
        <ChartSection
          title="Cash Flow"
          subtitle="Operating Cash Flow / Assets"
          panelId="cashFlow"
          expanded={expandedPanel}
          onToggle={togglePanel}
        >
          <ResponsiveContainer width="100%" height={expandedPanel === 'cashFlow' ? 400 : 200}>
            <AreaChart data={filteredFin.map(d => ({ ...d, quarter: formatQ(d.quarter) }))}>
              <defs>
                <linearGradient id="cfGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e3e8ee" vertical={false} />
              <XAxis dataKey="quarter" tick={{ fontSize: 10, fill: '#8792a2' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#8792a2' }} axisLine={false} tickLine={false} />
              <Tooltip content={<TVTooltip />} />
              <Area type="monotone" dataKey="cashFlow" stroke="#8b5cf6" fill="url(#cfGrad)" strokeWidth={2} dot={false} name="Cash Flow" />
            </AreaChart>
          </ResponsiveContainer>
        </ChartSection>

        {/* Feature Importance */}
        <ChartSection
          title="Risk Factors"
          subtitle="SHAP feature contributions"
          panelId="importance"
          expanded={expandedPanel}
          onToggle={togglePanel}
        >
          <ResponsiveContainer width="100%" height={expandedPanel === 'importance' ? 400 : 200}>
            <BarChart data={modelExplanation.featureImportance.slice(0, 8)} layout="vertical" margin={{ left: 100 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e3e8ee" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10, fill: '#8792a2' }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="feature" tick={{ fontSize: 11, fill: '#525f7f' }} axisLine={false} tickLine={false} width={95} />
              <Tooltip content={<TVTooltip />} />
              <Bar dataKey="importance" name="Importance" radius={[0, 3, 3, 0]}>
                {modelExplanation.featureImportance.slice(0, 8).map((_, i) => (
                  <Cell key={i} fill={i < 3 ? '#ef4444' : i < 5 ? '#f59e0b' : '#3b82f6'} opacity={0.8} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartSection>
      </div>

      {/* ─── Risk Factors Summary ─── */}
      <div className="tv-factors">
        <div className="tv-factors-col">
          <h4 className="tv-factors-title tv-factors-danger">
            <span className="tv-factors-icon">▲</span> Increasing Risk ({modelExplanation.factorsIncreasingRisk.length})
          </h4>
          {modelExplanation.factorsIncreasingRisk.length === 0 ? (
            <p className="tv-factors-empty">No significant risk factors</p>
          ) : (
            <ul className="tv-factors-list">
              {modelExplanation.factorsIncreasingRisk.slice(0, 5).map((f, i) => (
                <li key={i}>
                  <span className="tv-factor-name">{f.feature}</span>
                  <span className="tv-factor-val tv-danger">
                    {f.contribution != null ? `+${f.contribution.toFixed(4)}` : f.value.toFixed(3)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="tv-factors-col">
          <h4 className="tv-factors-title tv-factors-safe">
            <span className="tv-factors-icon">▼</span> Decreasing Risk ({modelExplanation.factorsDecreasingRisk.length})
          </h4>
          {modelExplanation.factorsDecreasingRisk.length === 0 ? (
            <p className="tv-factors-empty">No protective factors</p>
          ) : (
            <ul className="tv-factors-list">
              {modelExplanation.factorsDecreasingRisk.slice(0, 5).map((f, i) => (
                <li key={i}>
                  <span className="tv-factor-name">{f.feature}</span>
                  <span className="tv-factor-val tv-safe">
                    {f.contribution != null ? f.contribution.toFixed(4) : f.value.toFixed(3)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
