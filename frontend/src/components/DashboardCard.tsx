import type { ReactNode, CSSProperties } from 'react'

type DashboardCardProps = {
  title?: string
  subtitle?: string
  icon?: ReactNode
  iconBg?: string
  headerRight?: ReactNode
  children: ReactNode
  className?: string
  style?: CSSProperties
  noPadding?: boolean
}

export function DashboardCard({
  title,
  subtitle,
  icon,
  iconBg = '#eef2ff',
  headerRight,
  children,
  className = '',
  style,
  noPadding = false,
}: DashboardCardProps) {
  return (
    <div className={`ca-card ${className}`} style={style}>
      {(title || headerRight) && (
        <div className="ca-card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            {icon && (
              <div className="ca-card-icon" style={{ background: iconBg }}>
                {icon}
              </div>
            )}
            <div>
              {title && <h3 className="ca-card-title">{title}</h3>}
              {subtitle && <p className="ca-card-subtitle">{subtitle}</p>}
            </div>
          </div>
          {headerRight && <div>{headerRight}</div>}
        </div>
      )}
      <div style={{ padding: noPadding ? 0 : '1.5rem', flex: 1 }}>
        {children}
      </div>
    </div>
  )
}
