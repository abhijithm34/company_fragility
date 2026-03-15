import { useEffect, useState, useMemo } from 'react'
import { DashboardCard } from '../components/DashboardCard'
import { RiskHeatmap } from '../components/RiskHeatmap'
import { LocalFilterBar } from '../components/LocalFilterBar'
import { CategoryCompositionChart } from '../components/visualizations/CategoryCompositionChart'
import { RiskiestCompaniesChart } from '../components/visualizations/RiskiestCompaniesChart'
import { RiskTrajectoriesChart } from '../components/visualizations/RiskTrajectoriesChart'
import './CompanyAnalyticsPage.css'
import './RiskHeatmapPage.css'

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000'

type HeatmapData = {
  quarters: string[]
  companies: string[]
  data: Record<string, Record<string, number>>
}

export function RiskHeatmapPage() {
  const [data, setData] = useState<HeatmapData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Local Filters
  const [filters, setFilters] = useState({
    startQuarter: 'Any',
    endQuarter: 'Any',
    selectedCompany: 'Any',
    minProbability: 'Any',
  })

  // Tabs
  const [activeTab, setActiveTab] = useState<
    'heatmap' | 'composition' | 'offenders' | 'trajectories'
  >('heatmap')

  useEffect(() => {
    setLoading(true)
    fetch(`${API_BASE}/api/heatmap`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load heatmap data')
        return res.json()
      })
      .then((d: HeatmapData) => setData(d))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  /* ── 1. Apply Local Filters to Data ── */
  const filteredData = useMemo(() => {
    if (!data) return null

    // Filter Quarters
    let validQuarters = [...data.quarters]
    if (filters.startQuarter !== 'Any') {
      validQuarters = validQuarters.filter((q) => q >= filters.startQuarter)
    }
    if (filters.endQuarter !== 'Any') {
      validQuarters = validQuarters.filter((q) => q <= filters.endQuarter)
    }

    // Filter Companies
    let validCompanies = [...data.companies]
    if (filters.selectedCompany !== 'Any') {
      validCompanies = validCompanies.filter((c) => c === filters.selectedCompany)
    }

    // Filter by Min Probability (Company must hit this prob AT LEAST ONCE in the valid quarters)
    if (filters.minProbability !== 'Any') {
      const minP = parseFloat(filters.minProbability)
      validCompanies = validCompanies.filter((c) => {
        return validQuarters.some((q) => {
          const prob = data.data[c]?.[q]
          return prob !== undefined && prob >= minP
        })
      })
    }

    return {
      quarters: validQuarters,
      companies: validCompanies,
      data: data.data,
    }
  }, [data, filters])

  if (loading) {
    return (
      <div className="ca-loading">
        <div className="ca-spinner" />
        <span className="ca-loading-text">Loading risk dashboard data...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="ca-page">
        <header className="ca-header">
          <h2 className="ca-company-name">Risk Variations Dashboard</h2>
        </header>
        <DashboardCard title="Error" iconBg="rgba(220,38,38,0.08)">
          <p className="ca-error-msg">{error}</p>
        </DashboardCard>
      </div>
    )
  }

  if (!data || data.companies.length === 0) {
    return (
      <div className="ca-page">
        <header className="ca-header">
          <h2 className="ca-company-name">Risk Variations Dashboard</h2>
        </header>
        <DashboardCard title="No Data" iconBg="rgba(37,99,235,0.08)">
          <p className="ca-error-msg" style={{ color: 'var(--ca-ink-600)' }}>
            No scored companies found. Upload and score a dataset first.
          </p>
        </DashboardCard>
      </div>
    )
  }

  // Define Tabs Data
  const tabs = [
    { id: 'heatmap', label: '1. Risk Heatmap Matrix' },
    { id: 'composition', label: '2. Category Composition (Radar)' },
    { id: 'offenders', label: '3. Highest Risk Offenders (Scatter)' },
    { id: 'trajectories', label: '4. Risk Trajectories' },
  ] as const

  return (
    <div className="ca-page">
      <header className="ca-header">
        <div className="ca-header-left">
          <div className="ca-header-info">
            <h2 className="ca-company-name">Risk Variations Dashboard</h2>
            <div className="ca-header-meta">
              <span className="ca-header-meta-item">
                Multi-dimensional analysis of financial distress probability (T+4 quarters ahead)
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Local Filter Bar */}
      <LocalFilterBar
        startQuarter={filters.startQuarter}
        endQuarter={filters.endQuarter}
        selectedCompany={filters.selectedCompany}
        minProbability={filters.minProbability}
        availableQuarters={data.quarters}
        availableCompanies={data.companies}
        onFilterChange={setFilters}
      />

      {/* Tabs Navigation */}
      <div className="ca-tabs-nav" style={{ display: 'flex', gap: '8px', marginBottom: '24px', flexWrap: 'wrap' }}>
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            style={{
              padding: '10px 16px',
              borderRadius: '8px',
              border: 'none',
              background: activeTab === t.id ? '#1e293b' : '#f1f5f9',
              color: activeTab === t.id ? '#ffffff' : '#475569',
              fontWeight: activeTab === t.id ? 600 : 500,
              fontSize: '0.9rem',
              cursor: 'pointer',
              transition: 'background 0.2s',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Full-width Visualization Container */}
      {filteredData && (
        <DashboardCard
          title={tabs.find((t) => t.id === activeTab)?.label ?? 'Visualization'}
          iconBg="hsla(236, 96%, 70%, 0.08)"
          noPadding={activeTab === 'heatmap' || activeTab === 'composition' || activeTab === 'offenders' || activeTab === 'trajectories'}
        >
          <div style={{ padding: '24px', overflowX: 'auto', minHeight: '450px' }}>
            {activeTab === 'heatmap' && <RiskHeatmap heatmap={filteredData} />}
            {activeTab === 'composition' && <CategoryCompositionChart data={filteredData} />}
            {activeTab === 'offenders' && <RiskiestCompaniesChart data={filteredData} />}
            {activeTab === 'trajectories' && <RiskTrajectoriesChart data={filteredData} />}
          </div>
        </DashboardCard>
      )}
    </div>
  )
}
