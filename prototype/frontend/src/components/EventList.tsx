import type { EventMarker } from '../types'
import { topCategory } from '../types'
import { StatusBadge, Tag } from './StatusBadge'
import { categoryLabel, sourceLabel } from '../theme'

function timeAgo(iso: string): string {
  // Backend timestamps are naive UTC (datetime.utcnow), so append Z.
  const t = new Date(/[Z+]/.test(iso) ? iso : `${iso}Z`).getTime()
  if (Number.isNaN(t)) return ''
  const secs = Math.max(0, Math.floor((Date.now() - t) / 1000))
  if (secs < 60) return `${secs}s ago`
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`
  if (secs < 86_400) return `${Math.floor(secs / 3600)}h ago`
  return `${Math.floor(secs / 86_400)}d ago`
}

interface Props {
  events: EventMarker[]
  selectedId?: number
  onSelect: (e: EventMarker) => void
  emptyNote?: string
}

export function EventList({ events, selectedId, onSelect, emptyNote }: Props) {
  if (events.length === 0) {
    return <div className="empty">{emptyNote ?? 'No events match these filters'}</div>
  }

  return (
    <div className="event-list">
      {events.map((e) => {
        const cls = [
          'event-item',
          e.id === selectedId ? 'selected' : '',
          e.isLive ? 'fresh' : '',
        ]
          .filter(Boolean)
          .join(' ')

        return (
          <button type="button" className={cls} key={e.id} onClick={() => onSelect(e)}>
            <div className="event-top">
              <span className="event-place">
                {e.city}, {e.state}
              </span>
              <span className="event-time">{timeAgo(e.ingested_at)}</span>
            </div>
            <div className="event-text">{e.text}</div>
            <div className="event-meta">
              <StatusBadge status={e.verification_status} />
              <Tag>{categoryLabel(topCategory(e.predicted_categories))}</Tag>
              <Tag>{sourceLabel(e.source)}</Tag>
              <Tag>{(e.confidence_score * 100).toFixed(0)}%</Tag>
              {e.is_duplicate && <Tag>duplicate</Tag>}
            </div>
          </button>
        )
      })}
    </div>
  )
}

export { timeAgo }
