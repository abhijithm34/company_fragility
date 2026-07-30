import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { API_BASE } from '../config/api'

type ScoreRunSummary = {
  _id: string
  fileName: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  rowCount?: number
  highRiskCount?: number
  avgProbability?: number
  createdAt?: string
}

type ListResponse = {
  total: number
  page: number
  pageSize: number
  runs: ScoreRunSummary[]
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { class: string; label: string }> = {
    completed: { class: 'badge--success', label: 'Completed' },
    failed: { class: 'badge--danger', label: 'Failed' },
    running: { class: 'badge--warning', label: 'Running' },
    pending: { class: 'badge--neutral', label: 'Pending' },
  }
  const c = config[status] || config.pending
  return (
    <span className={`badge ${c.class}`}>
      <span className="badge-dot" />
      {c.label}
    </span>
  )
}

function formatDate(iso: string | undefined) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function HistoryPage() {
  const [runs, setRuns] = useState<ScoreRunSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`${API_BASE}/api/score-runs?page=1&pageSize=50`)
        if (!res.ok) throw new Error('Failed to load history')
        const body: ListResponse = await res.json()
        setRuns(body.runs)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Unexpected error')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  return (
    <>
      <header className="main-header">
        <h2>Scoring History</h2>
        <p>All past scoring runs with results and status.</p>
      </header>

      <section className="card">
        {loading && (
          <div className="loading-spinner">
            <div className="spinner" />
          </div>
        )}

        {error && <div className="error-message">{error}</div>}

        {!loading && !error && runs.length === 0 && (
          <div className="empty-state">
            <p><strong>No scoring runs yet</strong></p>
            <p>Upload a CSV from the Upload page to get started.</p>
          </div>
        )}

        {!loading && !error && runs.length > 0 && (
          <table className="data-table">
            <thead>
              <tr>
                <th>File</th>
                <th>Date</th>
                <th>Status</th>
                <th className="text-right">Rows</th>
                <th className="text-right">High Risk</th>
                <th className="text-right">Avg Prob</th>
                <th className="text-center">Action</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => (
                <tr key={run._id}>
                  <td>
                    <span style={{ fontWeight: 500 }}>{run.fileName}</span>
                  </td>
                  <td style={{ color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                    {formatDate(run.createdAt)}
                  </td>
                  <td>
                    <StatusBadge status={run.status} />
                  </td>
                  <td className="text-right mono">
                    {run.rowCount != null ? run.rowCount.toLocaleString() : '—'}
                  </td>
                  <td className="text-right mono" style={{ color: run.highRiskCount ? 'var(--danger)' : undefined }}>
                    {run.highRiskCount != null ? run.highRiskCount.toLocaleString() : '—'}
                  </td>
                  <td className="text-right mono">
                    {run.avgProbability != null ? (run.avgProbability * 100).toFixed(1) + '%' : '—'}
                  </td>
                  <td className="text-center">
                    {run.status === 'completed' ? (
                      <Link to={`/runs/${run._id}`} className="primary-button" style={{ padding: '4px 12px', fontSize: '12px' }}>
                        View →
                      </Link>
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>—</span>
                    )}
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
