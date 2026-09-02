import type { EventFilters } from '../types'
import { CATEGORY_LABELS, SOURCE_LABELS, STATUS } from '../theme'

interface Props {
  filters: EventFilters
  onChange: (f: EventFilters) => void
  states: string[]
  onReset: () => void
}

export function FilterSidebar({ filters, onChange, states, onReset }: Props) {
  const set = <K extends keyof EventFilters>(key: K, value: EventFilters[K]) =>
    onChange({ ...filters, [key]: value === '' ? undefined : value })

  return (
    <div className="card">
      <div className="card-head">
        <span className="card-title">Filters</span>
        <button className="icon-btn" onClick={onReset} type="button">
          Reset
        </button>
      </div>

      <label className="field">
        <span className="field-label">Verification status</span>
        <select value={filters.status ?? ''} onChange={(e) => set('status', e.target.value)}>
          <option value="">All statuses</option>
          {(['verified', 'manual_review', 'rejected'] as const).map((s) => (
            <option key={s} value={s}>
              {STATUS[s].label}
            </option>
          ))}
        </select>
      </label>

      <label className="field">
        <span className="field-label">Event category</span>
        <select value={filters.category ?? ''} onChange={(e) => set('category', e.target.value)}>
          <option value="">All categories</option>
          {Object.entries(CATEGORY_LABELS).map(([k, label]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </select>
      </label>

      <label className="field">
        <span className="field-label">Source</span>
        <select value={filters.source ?? ''} onChange={(e) => set('source', e.target.value)}>
          <option value="">All sources</option>
          {Object.entries(SOURCE_LABELS).map(([k, label]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </select>
      </label>

      <label className="field">
        <span className="field-label">State</span>
        <select value={filters.state ?? ''} onChange={(e) => set('state', e.target.value)}>
          <option value="">All states</option>
          {states.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </label>

      <label className="field">
        <span className="field-label">City</span>
        <input
          type="text"
          placeholder="e.g. Mumbai"
          value={filters.city ?? ''}
          onChange={(e) => set('city', e.target.value)}
        />
      </label>

      <label className="field">
        <span className="field-label">
          Minimum confidence: {((filters.min_confidence ?? 0) * 100).toFixed(0)}%
        </span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={filters.min_confidence ?? 0}
          onChange={(e) => {
            const v = Number(e.target.value)
            onChange({ ...filters, min_confidence: v === 0 ? undefined : v })
          }}
        />
      </label>

      <label className="field">
        <span className="field-label">Max results</span>
        <select
          value={String(filters.limit ?? 200)}
          onChange={(e) => onChange({ ...filters, limit: Number(e.target.value) })}
        >
          {[100, 200, 500, 1000].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </label>
    </div>
  )
}
