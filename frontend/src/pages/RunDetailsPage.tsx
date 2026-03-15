import { useEffect, useState, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { RiskCategoryBadge } from '../components/RiskCategoryBadge'
import { useFilters } from '../context/FilterContext'
import { FilterPanel } from '../components/FilterPanel'
import './RunDetailsPage.css'

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000'

type ScoreRun = {
  _id: string
  fileName: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  rowCount?: number
  highRiskCount?: number
  avgProbability?: number
  maxProbability?: number
  createdAt?: string
  predictionQuarter?: string
  selectedCompanies?: string[]
}

type RowsResponse = {
  page: number
  pageSize: number
  totalRows: number
  rows: Record<string, string>[]
}

export function RunDetailsPage() {
  const { id } = useParams<{ id: string }>()
  const [run, setRun] = useState<ScoreRun | null>(null)
  const [rows, setRows] = useState<RowsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 100
  
  const { filters } = useFilters()

  // Reset page to 1 when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [filters])

  useEffect(() => {
    if (!id) return
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const [runRes, rowsRes] = await Promise.all([
          fetch(`${API_BASE}/api/score-runs/${id}`),
          fetch(`${API_BASE}/api/score-runs/${id}/rows?page=1&pageSize=10000`),
        ])
        if (!runRes.ok) throw new Error('Failed to load run')
        if (!rowsRes.ok) throw new Error('Failed to load rows')
        const runBody: ScoreRun = await runRes.json()
        const rowsBody: RowsResponse = await rowsRes.json()
        setRun(runBody)
        setRows(rowsBody)
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Unexpected error'
        setError(msg)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

  const filteredRows = useMemo(() => {
    if (!rows) return []
    return rows.rows.filter(row => {
      // 1. Min Probability
      const p = parseFloat(row.predicted_probability ?? row.predicted_Probability ?? '')
      if (!Number.isNaN(p) && p < filters.minProbability) return false
      
      // 2. Risk Category
      const rawCat = row.risk_category ?? row.Risk_Category ?? ''
      const normalizedCat = String(rawCat).toLowerCase().replace('_', ' ').trim()
      if (filters.riskCategories.length > 0) {
        const matchesCat = filters.riskCategories.some(c => c.toLowerCase().replace('_', ' ').trim() === normalizedCat)
        if (!matchesCat) return false
      }

      // 3. Company
      const comp = row.company ?? row.Company ?? ''
      if (filters.companies.length > 0 && !filters.companies.some(c => c.toLowerCase() === String(comp).toLowerCase().trim())) return false

      // 4. Quarter Range
      const q = String(row.quarter ?? row.Quarter ?? '').trim()
      if (q) {
        if (filters.startQuarter && q < filters.startQuarter) return false
        if (filters.endQuarter && q > filters.endQuarter) return false
      }

      return true
    })
  }, [rows, filters])

  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filteredRows.slice(start, start + pageSize)
  }, [filteredRows, currentPage, pageSize])

  const totalPages = Math.ceil(filteredRows.length / pageSize)

  const availableCompanies = useMemo(() => {
    if (!rows) return []
    const set = new Set<string>()
    rows.rows.forEach(r => {
      const c = r.company ?? r.Company
      if (c) set.add(String(c).trim())
    })
    return Array.from(set).sort((a,b) => a.localeCompare(b))
  }, [rows])

  const availableQuarters = useMemo(() => {
    if (!rows) return []
    const set = new Set<string>()
    rows.rows.forEach(r => {
      const q = r.quarter ?? r.Quarter
      if (q) set.add(String(q).trim())
    })
    return Array.from(set).sort()
  }, [rows])

  return (
    <>
      <header className="main-header">
        <h2>Run details</h2>
        {run && (
          <p>
            {run.fileName} · <span style={{textTransform:'capitalize'}}>{run.status}</span>{' '}
            {run.createdAt && `· ${new Date(run.createdAt).toLocaleString()}`}
          </p>
        )}
      </header>

      {loading && (
        <div style={{display:'flex', alignItems:'center', gap:'0.5rem', color:'var(--text-secondary)'}}>
          <svg className="animate-spin" style={{width:'20px', height:'20px', animation:'spin 1s linear infinite'}} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle opacity="0.25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path opacity="0.75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Loading run data...
        </div>
      )}
      
      {error && <div className="error-message"><strong>Error:</strong> {error}</div>}

      {!loading && !error && run && (
        <>
          <FilterPanel availableCompanies={availableCompanies} availableQuarters={availableQuarters} hideCompany={true} />

          {(run.predictionQuarter != null || (run.selectedCompanies != null && run.selectedCompanies.length > 0)) && (
            <section className="card" style={{padding: '1.5rem', marginBottom: '1.5rem', display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center'}}>
              <h3 style={{margin: 0, marginRight: '1rem', fontSize: '1.1rem'}}>Run Scope</h3>
              {run.predictionQuarter != null && (
                <div className="scope-badge">
                  <svg style={{width:'16px', height:'16px', color:'#64748b'}} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Quarter: <strong>{run.predictionQuarter}</strong>
                </div>
              )}
              {run.selectedCompanies != null && run.selectedCompanies.length > 0 && (
                <div className="scope-badge">
                  <svg style={{width:'16px', height:'16px', color:'#64748b'}} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                  Companies: <strong>{run.selectedCompanies.length}</strong>
                  <span style={{color: '#64748b', fontSize: '0.8rem', marginLeft: '0.25rem'}}>
                    {run.selectedCompanies.length <= 5
                      ? `(${run.selectedCompanies.join(', ')})`
                      : `(${run.selectedCompanies.slice(0, 3).join(', ')}… +${run.selectedCompanies.length - 3})`}
                  </span>
                </div>
              )}
            </section>
          )}

          <div className="run-details-metrics">
            <div className="metric-card-styled">
              <span className="metric-title">Total Rows Scored</span>
              <span className="metric-value-large">{run.rowCount ?? '—'}</span>
            </div>
            <div className="metric-card-styled">
              <span className="metric-title">High-Risk Alerts</span>
              <span className="metric-value-large" style={{color: (run.highRiskCount ?? 0) > 0 ? '#ef4444' : 'inherit'}}>
                {run.highRiskCount ?? '—'}
              </span>
            </div>
          </div>

          {rows && filteredRows.length > 0 && (
            <section className="card">
              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem'}}>
                <div style={{display: 'flex', alignItems: 'center', gap: '1rem'}}>
                   <h3 style={{margin: 0}}>Scored Results</h3>
                   <span className="scope-badge" style={{ backgroundColor: '#fff', border: '1px solid var(--border-medium)' }}>
                      {filteredRows.length} results found
                   </span>
                </div>
              </div>
              <p className="helper-text" style={{ marginBottom: '1.25rem' }}>
                Click a company name to view its risk profile and detailed model explanation.
                {Object.keys(rows.rows[0]).some((k) => k.startsWith('shap_')) && (
                  <span style={{ color: '#059669', display: 'block', marginTop: '0.25rem' }}>
                    SHAP feature contributions are available for this run.
                  </span>
                )}
              </p>
              
              <div className="data-table-container">
                <table className="modern-table">
                  <thead>
                    <tr>
                      {Object.keys(rows.rows[0]).map((key) => {
                        const displayKey = key === 'predicted_probability' ? 'Probability (T+4)' : key.replace(/_/g, ' ')
                        return (
                          <th key={key}>
                            {displayKey}
                          </th>
                        )
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedRows.map((row, idx) => {
                       // Determine row risk background if we have a probability column
                       let rowRiskClass = ''
                       const pVal = row.predicted_probability || row.predicted_Probability
                       if (pVal) {
                          const p = parseFloat(pVal)
                          if (!Number.isNaN(p)) {
                             if (p >= 0.8) rowRiskClass = 'risk-bg-high'
                             else if (p >= 0.6) rowRiskClass = 'risk-bg-medium'
                             else if (p <= 0.2) rowRiskClass = 'risk-bg-low'
                          }
                       }
                      
                      return (
                      <tr key={idx} className={rowRiskClass}>
                        {Object.entries(row).map(([key, value]) => {
                          const isCompanyCol = key.toLowerCase() === 'company'
                          const isRiskCategoryCol = key.toLowerCase() === 'risk_category' || key.toLowerCase() === 'risk_category'
                          const isProbCol = key.toLowerCase() === 'predicted_probability'
                          
                          let displayValue = value
                          if (isProbCol && value) {
                            const num = parseFloat(String(value))
                            if (!Number.isNaN(num)) displayValue = (num * 100).toFixed(1) + '%'
                          } else if (!isNaN(Number(value)) && value !== '' && key.toLowerCase() !== 'quarter' && !isProbCol) {
                             // Format long numbers, avoid formatting integer IDs if any
                             const numVal = Number(value)
                             if (numVal % 1 !== 0 || numVal > 10000) {
                                displayValue = numVal.toLocaleString(undefined, {maximumFractionDigits: 3})
                             }
                          }

                          return (
                            <td key={key}>
                              {isCompanyCol && value != null && String(value).trim() !== '' ? (
                                <Link to={`/companies/${encodeURIComponent(String(value).trim())}`} className="company-link">
                                  {value}
                                  <svg style={{width:'14px', height:'14px'}} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                  </svg>
                                </Link>
                              ) : isRiskCategoryCol && value != null && String(value).trim() !== '' ? (
                                <div style={{ display: 'inline-block' }}>
                                   <RiskCategoryBadge category={String(value).trim().replace('_', ' ')} />
                                </div>
                              ) : (
                                <span style={{ color: isProbCol ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                                   {displayValue}
                                </span>
                              )}
                            </td>
                          )
                        })}
                      </tr>
                    )})}
                  </tbody>
                </table>
              </div>
              
              {/* Pagination Controls */}
              {totalPages > 1 && (
                 <div className="pagination-controls">
                    <button 
                       className="pagination-btn"
                       disabled={currentPage === 1}
                       onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    >
                       Previous
                    </button>
                    <span className="pagination-info">
                       Page <strong>{currentPage}</strong> of <strong>{totalPages}</strong>
                    </span>
                    <button 
                       className="pagination-btn"
                       disabled={currentPage === totalPages}
                       onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    >
                       Next
                    </button>
                 </div>
              )}
            </section>
          )}
        </>
      )}
    </>
  )
}

