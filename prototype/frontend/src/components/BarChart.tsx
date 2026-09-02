import { sequentialStep } from '../theme'

export interface BarDatum {
  key: string
  label: string
  value: number
}

interface Props {
  data: BarDatum[]
  /** Cap the number of rows; the remainder folds into "Other". */
  limit?: number
  emptyNote?: string
}

/**
 * Horizontal bar chart for a magnitude comparison (counts).
 *
 * Sequential encoding: a single blue hue, more-is-darker. One series, so no
 * legend box -- the card title says what is plotted, and every bar is
 * direct-labelled with its value at the tip.
 */
export function BarChart({ data, limit = 8, emptyNote = 'No data yet' }: Props) {
  if (data.length === 0) {
    return <div className="empty">{emptyNote}</div>
  }

  const sorted = [...data].sort((a, b) => b.value - a.value)
  let rows = sorted
  if (sorted.length > limit) {
    const head = sorted.slice(0, limit)
    const tail = sorted.slice(limit)
    const otherTotal = tail.reduce((s, d) => s + d.value, 0)
    rows = otherTotal > 0
      ? [...head, { key: '__other', label: `Other (${tail.length})`, value: otherTotal }]
      : head
  }

  const max = Math.max(...rows.map((d) => d.value))

  return (
    <div className="bars">
      {rows.map((d) => (
        <div className="bar-row" key={d.key} title={`${d.label}: ${d.value.toLocaleString('en-IN')}`}>
          <div className="bar-name">{d.label}</div>
          <div className="bar-track">
            <div
              className="bar-fill"
              style={{
                width: `${max > 0 ? (d.value / max) * 100 : 0}%`,
                background: sequentialStep(d.value, max),
              }}
            />
          </div>
          <div className="bar-value">{d.value.toLocaleString('en-IN')}</div>
        </div>
      ))}
    </div>
  )
}
