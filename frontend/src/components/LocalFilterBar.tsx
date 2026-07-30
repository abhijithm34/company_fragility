import './LocalFilterBar.css'

type Props = {
  startQuarter: string
  endQuarter: string
  selectedCompany: string
  minProbability: string // 'Any' or numeric string like '0.6'
  availableQuarters: string[]
  availableCompanies: string[]
  onFilterChange: (filters: {
    startQuarter: string
    endQuarter: string
    selectedCompany: string
    minProbability: string
  }) => void
}

export function LocalFilterBar({
  startQuarter,
  endQuarter,
  selectedCompany,
  minProbability,
  availableQuarters,
  availableCompanies,
  onFilterChange,
}: Props) {
  return (
    <div className="local-filter-bar">
      {/* ── Start Quarter ── */}
      <div className="lfb-control">
        <label>Start Quarter</label>
        <select
          value={startQuarter}
          onChange={(e) => onFilterChange({ startQuarter: e.target.value, endQuarter, selectedCompany, minProbability })}
        >
          <option value="Any">Any</option>
          {availableQuarters.map((q) => (
            <option key={q} value={q}>
              {q}
            </option>
          ))}
        </select>
      </div>

      {/* ── End Quarter ── */}
      <div className="lfb-control">
        <label>End Quarter</label>
        <select
          value={endQuarter}
          onChange={(e) => onFilterChange({ startQuarter, endQuarter: e.target.value, selectedCompany, minProbability })}
        >
          <option value="Any">Any</option>
          {availableQuarters.map((q) => (
            <option key={q} value={q}>
              {q}
            </option>
          ))}
        </select>
      </div>

      {/* ── Company ── */}
      <div className="lfb-control">
        <label>Company</label>
        <select
          value={selectedCompany}
          onChange={(e) => onFilterChange({ startQuarter, endQuarter, selectedCompany: e.target.value, minProbability })}
        >
          <option value="Any">Any</option>
          {availableCompanies.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      {/* ── Min Probability ── */}
      <div className="lfb-control">
        <label>Min Risk Probability</label>
        <select
          value={minProbability}
          onChange={(e) => onFilterChange({ startQuarter, endQuarter, selectedCompany, minProbability: e.target.value })}
        >
          <option value="Any">Any</option>
          <option value="0.2">≥ 0.2 (Low Risk+)</option>
          <option value="0.4">≥ 0.4 (Moderate+)</option>
          <option value="0.6">≥ 0.6 (High Risk+)</option>
          <option value="0.8">≥ 0.8 (Severe Only)</option>
        </select>
      </div>
    </div>
  )
}
