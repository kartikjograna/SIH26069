import { STATUS } from '../theme'

interface Props {
  verified: number
  manualReview: number
  rejected: number
}

/**
 * Part-to-whole split of verification outcomes as one stacked bar.
 *
 * Status encoding (reserved palette), so each segment ships with a legend entry
 * carrying its glyph, label and count -- hue alone never has to be decoded.
 * A 2px surface gap separates the segments (see the .stacked `gap`).
 */
export function VerificationSplit({ verified, manualReview, rejected }: Props) {
  const segments = [
    { ...STATUS.verified, value: verified },
    { ...STATUS.manual_review, value: manualReview },
    { ...STATUS.rejected, value: rejected },
  ]
  const total = verified + manualReview + rejected

  if (total === 0) {
    return <div className="empty">No events processed yet</div>
  }

  return (
    <div>
      <div
        className="stacked"
        role="img"
        aria-label={segments.map((s) => `${s.label}: ${s.value}`).join(', ')}
      >
        {segments.map((s) =>
          s.value > 0 ? (
            <div
              key={s.label}
              className="stacked-seg"
              style={{ flexGrow: s.value, background: s.color }}
              title={`${s.label}: ${s.value.toLocaleString('en-IN')} (${((s.value / total) * 100).toFixed(1)}%)`}
            />
          ) : null,
        )}
      </div>

      <div className="chart-legend">
        {segments.map((s) => (
          <span className="legend-chip" key={s.label}>
            <span className="legend-swatch" style={{ background: s.color }} aria-hidden="true" />
            {s.label}
            <span className="legend-count">
              {s.value.toLocaleString('en-IN')}
              <span className="muted">
                {' '}
                ({total > 0 ? ((s.value / total) * 100).toFixed(0) : 0}%)
              </span>
            </span>
          </span>
        ))}
      </div>
    </div>
  )
}
