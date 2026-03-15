import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import Papa from 'papaparse'
import './UploadPage.css'

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000'

type ScoreRun = {
  _id: string
  fileName: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  rowCount?: number
  highRiskCount?: number
  avgProbability?: number
  maxProbability?: number
}

function findColumn(headers: string[], name: string): string | null {
  const lower = name.toLowerCase()
  return headers.find((h) => h && String(h).toLowerCase() === lower) ?? null
}

export function UploadPage() {
  const [file, setFile] = useState<File | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentRun, setCurrentRun] = useState<ScoreRun | null>(null)
  const [polling, setPolling] = useState(false)
  const [parseError, setParseError] = useState<string | null>(null)
  const [companyQuarters, setCompanyQuarters] = useState<Record<string, string[]>>({})
  const [companies, setCompanies] = useState<string[]>([])
  const [predictionQuarter, setPredictionQuarter] = useState<string>('')
  const [selectedCompanies, setSelectedCompanies] = useState<string[]>([])
  const [companyDropdownOpen, setCompanyDropdownOpen] = useState(false)
  const navigate = useNavigate()

  const allSelected = useMemo(
    () => companies.length > 0 && selectedCompanies.length === companies.length,
    [companies.length, selectedCompanies.length]
  )

  /** Quarters that appear in the CSV for the currently selected companies only */
  const quartersForSelectedCompanies = useMemo(() => {
    if (selectedCompanies.length === 0) return []
    const set = new Set<string>()
    selectedCompanies.forEach((c) => (companyQuarters[c] ?? []).forEach((q) => set.add(q)))
    return [...set].sort()
  }, [selectedCompanies, companyQuarters])

  useEffect(() => {
    if (quartersForSelectedCompanies.length === 0) return
    setPredictionQuarter((prev) =>
      prev && quartersForSelectedCompanies.includes(prev) ? prev : quartersForSelectedCompanies[0]
    )
  }, [quartersForSelectedCompanies])

  useEffect(() => {
    let timeoutId: number | undefined
    async function poll() {
      if (!currentRun || currentRun.status === 'completed' || currentRun.status === 'failed') {
        setPolling(false)
        return
      }
      try {
        const res = await fetch(`${API_BASE}/api/score-runs/${currentRun._id}`)
        if (!res.ok) {
          throw new Error('Failed to fetch run status')
        }
        const updated: ScoreRun = await res.json()
        setCurrentRun(updated)
        if (updated.status === 'pending' || updated.status === 'running') {
          timeoutId = window.setTimeout(poll, 2000)
        } else {
          setPolling(false)
        }
      } catch (e) {
        console.error(e)
        setPolling(false)
      }
    }

    if (polling && currentRun) {
      timeoutId = window.setTimeout(poll, 1500)
    }

    return () => {
      if (timeoutId) {
        window.clearTimeout(timeoutId)
      }
    }
  }, [polling, currentRun])

  const onFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || event.target.files.length === 0) {
      setFile(null)
      setCompanyQuarters({})
      setCompanies([])
      setPredictionQuarter('')
      setSelectedCompanies([])
      setParseError(null)
      return
    }
    const f = event.target.files[0]
    setFile(f)
    setError(null)
    setParseError(null)
    setCompanyQuarters({})
    setCompanies([])
    setPredictionQuarter('')
    setSelectedCompanies([])

    const reader = new FileReader()
    reader.onload = () => {
      const text = String(reader.result ?? '')
      const result = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true })
      const headers = result.meta.fields ?? []
      const data = result.data
      const quarterCol = findColumn(headers, 'quarter')
      const companyCol = findColumn(headers, 'company')

      if (!quarterCol) {
        setParseError('This CSV does not contain a quarter column.')
        return
      }
      if (!companyCol) {
        setParseError('This CSV does not contain a company column.')
        return
      }
      const byCompany: Record<string, Set<string>> = {}
      data.forEach((row) => {
        const q = String(row[quarterCol] ?? '').trim()
        const c = String(row[companyCol] ?? '').trim()
        if (!q || !c) return
        if (!byCompany[c]) byCompany[c] = new Set()
        byCompany[c].add(q)
      })
      const cList = Object.keys(byCompany).sort()
      const quartersMap: Record<string, string[]> = {}
      cList.forEach((c) => {
        quartersMap[c] = [...byCompany[c]].sort()
      })
      setCompanyQuarters(quartersMap)
      setCompanies(cList)
      const allQuarters = [...new Set(data.map((r) => String(r[quarterCol] ?? '').trim()).filter(Boolean))].sort()
      setPredictionQuarter(allQuarters[0] ?? '')
      setSelectedCompanies(cList)
    }
    reader.onerror = () => setParseError('Failed to read file.')
    reader.readAsText(f, 'utf-8')
  }

  const toggleCompany = (company: string) => {
    setSelectedCompanies((prev) =>
      prev.includes(company) ? prev.filter((c) => c !== company) : [...prev, company].sort()
    )
  }

  const toggleSelectAllCompanies = () => {
    if (allSelected) {
      setSelectedCompanies([])
    } else {
      setSelectedCompanies([...companies])
    }
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!file) {
      setError('Please select a CSV file first.')
      return
    }
    if (quartersForSelectedCompanies.length === 0 || !predictionQuarter) {
      setError('Please ensure the selected companies have quarter data and a prediction quarter is selected.')
      return
    }
    if (selectedCompanies.length === 0) {
      setError('Please select at least one company.')
      return
    }
    setIsSubmitting(true)
    setError(null)
    setCurrentRun(null)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('predictionQuarter', predictionQuarter)
      formData.append('selectedCompanies', JSON.stringify(selectedCompanies))

      const res = await fetch(`${API_BASE}/api/score-runs`, {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.message || 'Failed to start scoring run')
      }

      const run: ScoreRun = await res.json()
      setCurrentRun(run)
      setPolling(true)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unexpected error'
      setError(msg)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <header className="main-header">
        <h2>Upload & Score</h2>
        <p>Drop a financials CSV to compute corporate fragility scores with our model.</p>
      </header>

      <section className="card upload-card">
        <h3>Source Data</h3>
        <p className="helper-text">
          Select a CSV with either raw financials or pre-engineered features compatible with the model.
          It must include <strong>Quarter</strong> and <strong>Company</strong> columns.
        </p>

        <form onSubmit={handleSubmit} className="upload-container">
          <label className="upload-dropzone">
            <svg className="upload-dropzone-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <p className="upload-dropzone-text">Click to choose a CSV file</p>
            <p className="upload-dropzone-subtext">or drag and drop it here</p>
            <input type="file" accept=".csv,text/csv" className="upload-file-input" onChange={onFileChange} />
          </label>
          
          {file && (
            <div className="upload-selected-file">
              <svg style={{width:'24px', height:'24px'}} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{file.name}</span>
            </div>
          )}

          {parseError && (
            <div className="error-message">
              <strong>Error:</strong> {parseError}
            </div>
          )}

          {file && companies.length > 0 && (
            <div className="upload-options-card">
              <h4 className="upload-options-header">Prediction Options</h4>

              <div className="form-group">
                <label htmlFor="prediction-quarter" className="form-label">
                  Prediction target quarter
                </label>
                <select
                  id="prediction-quarter"
                  value={predictionQuarter}
                  onChange={(e) => setPredictionQuarter(e.target.value)}
                  className="form-select"
                >
                  {quartersForSelectedCompanies.map((q) => (
                    <option key={q} value={q}>{q}</option>
                  ))}
                </select>
                <p className="helper-text-muted" style={{ marginTop: '0.35rem' }}>
                  Only quarters present in the CSV for the selected companies are shown.
                </p>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">
                  Companies to score
                </label>
                <div style={{ position: 'relative' }}>
                  <button
                    type="button"
                    onClick={() => setCompanyDropdownOpen((o) => !o)}
                    className="custom-dropdown-button"
                  >
                    <span>
                      {allSelected
                        ? 'All companies selected'
                        : `${selectedCompanies.length} of ${companies.length} selected`}
                    </span>
                    <svg style={{width:'20px', height:'20px', color:'#94a3b8'}} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {companyDropdownOpen && (
                    <>
                      <div
                        role="button"
                        tabIndex={0}
                        style={{ position: 'fixed', inset: 0, zIndex: 10 }}
                        onClick={() => setCompanyDropdownOpen(false)}
                        onKeyDown={(e) => e.key === 'Escape' && setCompanyDropdownOpen(false)}
                        aria-label="Close"
                      />
                      <div className="custom-dropdown-menu">
                        <label className="custom-dropdown-item header">
                          <input
                            type="checkbox"
                            checked={allSelected}
                            onChange={toggleSelectAllCompanies}
                            className="custom-checkbox"
                          />
                          Select all
                        </label>
                        {companies.map((c) => (
                          <label key={c} className="custom-dropdown-item">
                            <input
                              type="checkbox"
                              checked={selectedCompanies.includes(c)}
                              onChange={() => toggleCompany(c)}
                              className="custom-checkbox"
                            />
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c}</span>
                          </label>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>

              <p className="helper-text" style={{ marginTop: '1.25rem' }}>
                Scoring will run for <strong>{predictionQuarter}</strong> targeting <strong>{selectedCompanies.length}</strong> companies.
              </p>
            </div>
          )}

          {error && (
            <div className="error-message">
              <strong>Error:</strong> {error}
            </div>
          )}

          <div className="upload-actions">
            <button
              className="primary-button"
              type="submit"
              disabled={isSubmitting || quartersForSelectedCompanies.length === 0 || selectedCompanies.length === 0}
            >
              {isSubmitting ? (
                <>
                  <svg className="animate-spin" style={{width:'20px', height:'20px', animation:'spin 1s linear infinite'}} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle opacity="0.25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path opacity="0.75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    <style>{`@keyframes spin { from {transform:rotate(0deg);} to {transform:rotate(360deg);} }`}</style>
                  </svg>
                  Starting...
                </>
              ) : 'Run Scoring Engine'}
            </button>
          </div>
        </form>
      </section>

      {currentRun && (
        <section className={`card status-card ${currentRun.status === 'completed' ? 'completed' : currentRun.status === 'failed' ? 'failed' : ''}`}>
          <h3>Run Status</h3>
          <p className="helper-text" style={{marginBottom: '1rem'}}>
            Track the status of your data ingestion and scoring pipeline.
          </p>
          
          <div className="status-detail-grid">
             <div className="status-metric">
                <span className="status-metric-label">File</span>
                <span className="status-metric-value" style={{fontSize: '1.05rem', wordBreak: 'break-all'}}>{currentRun.fileName}</span>
             </div>
             <div className="status-metric">
                <span className="status-metric-label">Status</span>
                <span className="status-metric-value" style={{textTransform: 'capitalize'}}>
                  <span className="badge" style={{
                    backgroundColor: currentRun.status === 'completed' ? '#ecfdf5' : currentRun.status === 'failed' ? '#fef2f2' : '#f0f9ff',
                    color: currentRun.status === 'completed' ? '#166534' : currentRun.status === 'failed' ? '#991b1b' : '#0369a1',
                    borderColor: currentRun.status === 'completed' ? '#bbf7d0' : currentRun.status === 'failed' ? '#fecaca' : '#bae6fd',
                    padding: '0.35rem 0.75rem', fontSize: '0.85rem'
                  }}>
                     {currentRun.status === 'running' || currentRun.status === 'pending' ? (
                        <svg className="animate-spin" style={{marginRight:'0.35rem', width:'14px', height:'14px', animation:'spin 1s linear infinite'}} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle opacity="0.25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path opacity="0.75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                     ) : currentRun.status === 'completed' ? (
                       <svg style={{marginRight:'0.35rem', width:'14px', height:'14px'}} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                     ) : null}
                     {currentRun.status}
                  </span>
                </span>
             </div>
             {currentRun.status === 'completed' && (
               <>
                 <div className="status-metric">
                    <span className="status-metric-label">Total Rows Scored</span>
                    <span className="status-metric-value">{currentRun.rowCount ?? 'n/a'}</span>
                 </div>
                 <div className="status-metric">
                    <span className="status-metric-label">High Risk Alerts</span>
                    <span className="status-metric-value" style={{color: (currentRun.highRiskCount ?? 0) > 0 ? '#b91c1c' : 'inherit'}}>
                      {currentRun.highRiskCount ?? 'n/a'}
                    </span>
                 </div>
               </>
             )}
          </div>

          {currentRun.status === 'completed' && (
            <div style={{display: 'flex', justifyContent: 'flex-end', marginTop: '1rem'}}>
              <button
                className="primary-button"
                type="button"
                onClick={() => navigate(`/runs/${currentRun._id}`)}
              >
                View Detailed Results
                <svg style={{width:'18px', height:'18px'}} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          )}
          
          {currentRun.status === 'failed' && (
            <div className="error-message">
              <strong>Error:</strong> Run failed. Check backend logs for more details.
            </div>
          )}
        </section>
      )}
    </>
  )
}

