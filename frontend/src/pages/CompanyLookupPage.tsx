import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

export function CompanyLookupPage() {
  const [name, setName] = useState('')
  const navigate = useNavigate()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (trimmed) {
      navigate(`/companies/${encodeURIComponent(trimmed)}`)
    }
  }

  return (
    <>
      <header className="main-header">
        <h2>Company risk profile</h2>
        <p>View detailed risk analytics for a company. Enter a company name that has been scored in at least one run.</p>
      </header>

      <section className="card">
        <h3>Look up a company</h3>
        <p className="helper-text" style={{ marginBottom: '1rem' }}>
          Company names are case-insensitive. You can also go to <strong>History</strong> → open a run → click a company name in the scored table.
        </p>
        <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. TCS, Infosys"
            style={{
              padding: '0.5rem 0.75rem',
              minWidth: '14rem',
              borderRadius: '6px',
              border: '1px solid #d1d5db',
              fontSize: '1rem',
            }}
            aria-label="Company name"
          />
          <button type="submit" className="primary-button" disabled={!name.trim()}>
            View profile
          </button>
        </form>
      </section>
    </>
  )
}
