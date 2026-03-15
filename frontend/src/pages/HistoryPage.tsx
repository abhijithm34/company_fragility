import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000'

type ScoreRunSummary = {
  _id: string
  fileName: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  rowCount?: number
  highRiskCount?: number
  createdAt?: string
}

type ListResponse = {
  total: number
  page: number
  pageSize: number
  runs: ScoreRunSummary[]
}

export function HistoryPage() {
  const [runs, setRuns] = useState<ScoreRunSummary[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`${API_BASE}/api/score-runs?page=1&pageSize=20`)
        if (!res.ok) {
          throw new Error('Failed to load history')
        }
        const body: ListResponse = await res.json()
        setRuns(body.runs)
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Unexpected error'
        setError(msg)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  return (
    <>
      <header className="main-header">
        <h2>History</h2>
        <p>Recent scoring runs.</p>
      </header>

      <section className="card">
        {loading && <p>Loading...</p>}
        {error && <p style={{ color: '#b91c1c' }}>{error}</p>}

        {!loading && !error && runs.length === 0 && <p>No runs yet. Upload a CSV to get started.</p>}

        {!loading && !error && runs.length > 0 && (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '0.5rem' }}>File</th>
                <th style={{ textAlign: 'left', padding: '0.5rem' }}>Created</th>
                <th style={{ textAlign: 'left', padding: '0.5rem' }}>Status</th>
                <th style={{ textAlign: 'right', padding: '0.5rem' }}>Rows</th>
                <th style={{ textAlign: 'right', padding: '0.5rem' }}>High risk</th>
                <th style={{ padding: '0.5rem' }}>Details</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => (
                <tr key={run._id} style={{ borderTop: '1px solid #e5e7eb' }}>
                  <td style={{ padding: '0.5rem' }}>{run.fileName}</td>
                  <td style={{ padding: '0.5rem' }}>
                    {run.createdAt ? new Date(run.createdAt).toLocaleString() : '—'}
                  </td>
                  <td style={{ padding: '0.5rem' }}>{run.status}</td>
                  <td style={{ padding: '0.5rem', textAlign: 'right' }}>{run.rowCount ?? '—'}</td>
                  <td style={{ padding: '0.5rem', textAlign: 'right' }}>{run.highRiskCount ?? '—'}</td>
                  <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                    <Link to={`/runs/${run._id}`} className="primary-button" style={{ padding: '0.35rem 0.75rem', fontSize: '0.85rem' }}>
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  )
}

