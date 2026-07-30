/**
 * Shared risk category config and badge for consistent display across the dashboard.
 * Aligned with backend/Python: Very Safe, Low Risk, Moderate Risk, High Risk, Severe Risk.
 */

export const RISK_CATEGORIES = [
  'Very Safe',
  'Low Risk',
  'Moderate Risk',
  'High Risk',
  'Severe Risk',
] as const

export type RiskCategoryLabel = (typeof RISK_CATEGORIES)[number] | string

const RISK_STYLES: Record<string, { bg: string; color: string; border: string }> = {
  'Very Safe': { bg: '#ecfdf5', color: '#166534', border: '#bbf7d0' },
  'Low Risk': { bg: '#d1fae5', color: '#15803d', border: '#86efac' },
  'Moderate Risk': { bg: '#fef9c3', color: '#a16207', border: '#fde047' },
  'High Risk': { bg: '#ffedd5', color: '#c2410c', border: '#fdba74' },
  'Severe Risk': { bg: '#fef2f2', color: '#b91c1c', border: '#fecaca' },
  // Legacy 3-tier labels (before five-tier rollout)
  Low: { bg: '#d1fae5', color: '#15803d', border: '#86efac' },
  Medium: { bg: '#fef9c3', color: '#a16207', border: '#fde047' },
  High: { bg: '#fef2f2', color: '#b91c1c', border: '#fecaca' },
  Unknown: { bg: '#f3f4f6', color: '#6b7280', border: '#e5e7eb' },
}

export function getRiskCategoryStyle(category: string) {
  return RISK_STYLES[category] ?? RISK_STYLES.Unknown
}

type RiskCategoryBadgeProps = {
  category: string
  className?: string
  style?: React.CSSProperties
}

export function RiskCategoryBadge({ category, className = '', style = {} }: RiskCategoryBadgeProps) {
  const s = getRiskCategoryStyle(category)
  return (
    <span
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '0.2rem 0.5rem',
        borderRadius: '9999px',
        fontSize: '0.8rem',
        fontWeight: 500,
        backgroundColor: s.bg,
        color: s.color,
        border: `1px solid ${s.border}`,
        ...style,
      }}
    >
      {category || 'Unknown'}
    </span>
  )
}
