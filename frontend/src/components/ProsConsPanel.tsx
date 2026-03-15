type ProsConsPanelProps = {
  pros: string[]
  cons: string[]
}

export function ProsConsPanel({ pros, cons }: ProsConsPanelProps) {
  return (
    <div className="ca-proscons">
      <div className="ca-proscons-col">
        <h4 className="ca-proscons-title pros">
          Strengths
        </h4>
        {pros.length > 0 ? (
          <ul className="ca-proscons-list">
            {pros.map((p, i) => (
              <li key={i} className="ca-proscons-item">
                <span className="ca-proscons-icon pro">+</span>
                <span>{p}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="ca-proscons-empty">No positive indicators identified</p>
        )}
      </div>

      <div className="ca-proscons-col">
        <h4 className="ca-proscons-title cons">
          Risk Factors
        </h4>
        {cons.length > 0 ? (
          <ul className="ca-proscons-list">
            {cons.map((c, i) => (
              <li key={i} className="ca-proscons-item">
                <span className="ca-proscons-icon con">-</span>
                <span>{c}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="ca-proscons-empty">No risk indicators identified</p>
        )}
      </div>
    </div>
  )
}
