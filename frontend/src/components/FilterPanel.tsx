import React, { useState } from 'react'
import { useFilters } from '../context/FilterContext'
import { DashboardCard } from './DashboardCard'
import './FilterPanel.css'

type Props = {
  availableCompanies?: string[]
  availableQuarters?: string[]
  hideCompany?: boolean // Useful for Company Analytics page where it's locked to one company
}

const RISK_TIERS = ['Low Risk', 'Medium Risk', 'High Risk', 'Severe Risk']

export function FilterPanel({ availableCompanies = [], availableQuarters = [], hideCompany = false }: Props) {
  const { filters, setFilters, clearFilters } = useFilters()
  const [companyInput, setCompanyInput] = useState('')

  const handleProbChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFilters(prev => ({ ...prev, minProbability: parseFloat(e.target.value) }))
  }

  const toggleCategory = (category: string) => {
    setFilters(prev => {
      const exists = prev.riskCategories.includes(category)
      return {
        ...prev,
        riskCategories: exists 
          ? prev.riskCategories.filter(c => c !== category)
          : [...prev.riskCategories, category]
      }
    })
  }

  const addCompany = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = companyInput.trim()
    if (!trimmed) return
    
    // Check case insensitive
    const match = availableCompanies.find(c => c.toLowerCase() === trimmed.toLowerCase())
    const companyToAdd = match || trimmed

    if (!filters.companies.includes(companyToAdd)) {
      setFilters(prev => ({ ...prev, companies: [...prev.companies, companyToAdd] }))
    }
    setCompanyInput('')
  }

  const removeCompany = (company: string) => {
    setFilters(prev => ({ ...prev, companies: prev.companies.filter(c => c !== company) }))
  }

  const handleStartQuarter = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setFilters(prev => ({ ...prev, startQuarter: e.target.value }))
  }

  const handleEndQuarter = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setFilters(prev => ({ ...prev, endQuarter: e.target.value }))
  }

  const isFiltered = filters.minProbability > 0 || filters.riskCategories.length > 0 || filters.companies.length > 0 || filters.startQuarter !== '' || filters.endQuarter !== ''

  return (
    <DashboardCard 
      title="Global Filters" 
      iconBg="hsla(216, 41%, 87%, 0.3)"
      style={{ marginBottom: '24px' }}
      headerRight={
        isFiltered && (
          <button onClick={clearFilters} className="ca-filter-reset-btn">
            Clear all filters
          </button>
        )
      }
    >
      <div className="ca-filter-panel">
        
        {/* Probability Threshold */}
        <div className="ca-filter-group" style={{ flex: '1.2' }}>
          <div className="ca-filter-label">
            <span>Min Probability</span>
            <span style={{ color: 'var(--ca-danger)', fontVariantNumeric: 'tabular-nums' }}>
              &gt; {filters.minProbability.toFixed(2)}
            </span>
          </div>
          <input 
            type="range" 
            min="0" 
            max="1" 
            step="0.05"
            value={filters.minProbability}
            onChange={handleProbChange}
            className="ca-filter-slider"
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--ca-ink-600)' }}>
            <span>0</span>
            <span>1</span>
          </div>
        </div>

        {/* Risk Categories */}
        <div className="ca-filter-group" style={{ flex: '1.5' }}>
          <span className="ca-filter-label">Risk Categories</span>
          <div className="ca-filter-checkboxes">
            {RISK_TIERS.map(tier => (
              <label key={tier} className="ca-filter-checkbox-label">
                <input 
                  type="checkbox" 
                  style={{ display: 'none' }}
                  checked={filters.riskCategories.includes(tier)}
                  onChange={() => toggleCategory(tier)}
                />
                <span>{tier}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Companies */}
        {!hideCompany && (
          <div className="ca-filter-group" style={{ flex: '1.5' }}>
            <span className="ca-filter-label">Companies</span>
            <form onSubmit={addCompany} className="ca-filter-form">
              <input 
                type="text" 
                placeholder="Add company..."
                value={companyInput}
                onChange={e => setCompanyInput(e.target.value)}
                className="ca-filter-input"
                list="fp-company-list"
              />
              <datalist id="fp-company-list">
                {availableCompanies.map(c => <option key={c} value={c} />)}
              </datalist>
              <button type="submit" className="ca-btn ca-btn-primary" style={{ padding: '6px 12px' }}>Add</button>
            </form>
            {filters.companies.length > 0 && (
              <div className="ca-filter-tags">
                {filters.companies.map(c => (
                  <div key={c} className="ca-filter-tag">
                    <span>{c}</span>
                    <button type="button" onClick={() => removeCompany(c)}>×</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Quarters (Range) */}
        <div className="ca-filter-group" style={{ flex: '1.5' }}>
          <span className="ca-filter-label">Quarter Range</span>
          <div className="ca-filter-form">
            <select className="ca-filter-input" value={filters.startQuarter} onChange={handleStartQuarter}>
              <option value="">Start quarter...</option>
              {availableQuarters.map(q => (
                <option key={q} value={q}>{q}</option>
              ))}
            </select>
            <span style={{ color: 'var(--text-secondary)', alignSelf: 'center', fontWeight: 500 }}>to</span>
            <select className="ca-filter-input" value={filters.endQuarter} onChange={handleEndQuarter}>
              <option value="">End quarter...</option>
              {availableQuarters.map(q => (
                <option key={q} value={q}>{q}</option>
              ))}
            </select>
          </div>
        </div>

      </div>
    </DashboardCard>
  )
}
