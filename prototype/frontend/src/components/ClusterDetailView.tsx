import { useEffect, useState } from 'react'
import { api } from '../api'
import type { WeatherEvent } from '../types'
import { StatusBadge, Tag } from './StatusBadge'
import { categoryLabel, sourceLabel, statusToken } from '../theme'

interface MeterRowProps {
  name: string
  impl: string
  score: number
  risk: boolean
}

function severityColor(score: number, risk: boolean): string {
  const bad = risk ? score : 1 - score
  if (bad >= 0.6) return 'var(--status-critical)'
  if (bad >= 0.35) return 'var(--status-warning)'
  return 'var(--status-good)'
}

function MeterRow({ name, impl, score, risk }: MeterRowProps) {
  return (
    <div className="model-row" style={{ fontSize: 11, gap: 8 }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600, fontSize: 10 }}>{name}</div>
        <div style={{ fontSize: 9, opacity: 0.7 }}>{impl}</div>
      </div>
      <div style={{ fontSize: 11, fontWeight: 600, width: 40, textAlign: 'right' }}>
        {(score * 100).toFixed(0)}%
      </div>
      <div className="meter" style={{ width: 60 }}>
        <div
          className="meter-fill"
          style={{
            width: `${Math.min(100, Math.max(0, score * 100))}%`,
            background: severityColor(score, risk),
          }}
        />
      </div>
    </div>
  )
}

function ComparisonCard({ event }: { event: WeatherEvent }) {
  const v = event.verification
  const token = statusToken(event.verification_status)

  return (
    <div className="card" style={{ minWidth: '320px', maxWidth: '320px', height: 'fit-content' }}>
      <div className="card-head">
        <span className="card-title">Report #{event.id}</span>
        <StatusBadge status={event.verification_status} />
      </div>

      <div style={{ marginBottom: 12 }}>
        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 2 }}>
          {event.city}, {event.state}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {event.text}
        </div>
        <div className="event-meta">
          <Tag>{sourceLabel(event.source)}</Tag>
          {event.is_duplicate && <Tag>duplicate</Tag>}
        </div>
      </div>

      <div
        style={{
          padding: '10px 12px',
          borderRadius: 'var(--radius-sm)',
          background: 'var(--hover-wash)',
          marginBottom: 14,
          textAlign: 'center'
        }}
      >
        <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Confidence</div>
        <div style={{ fontSize: 20, fontWeight: 600, color: token.color }}>
          {(event.confidence_score * 100).toFixed(1)}%
        </div>
      </div>

      {v && (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <MeterRow
              name="Fake-news"
              impl={v.fake_news_model}
              score={v.fake_news_score}
              risk
            />
            <MeterRow
              name="Source"
              impl="XGBoost ensemble"
              score={v.source_credibility_score}
              risk={false}
            />
            <MeterRow
              name="Forensics"
              impl={event.has_image ? 'ELA + CNN' : 'no image'}
              score={v.image_forensics_score}
              risk
            />
          </div>

          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 6 }}>Classification</div>
            <div className="event-meta">
              {Object.entries(v.event_classification)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 2)
                .map(([cat, score]) => (
                  <Tag key={cat}>
                    {categoryLabel(cat)} {(score * 100).toFixed(0)}%
                  </Tag>
                ))}
            </div>
          </div>

          {v.reasons.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 4 }}>Key Reasons</div>
              <ul className="reasons" style={{ fontSize: 11 }}>
                {v.reasons.slice(0, 3).map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export function ClusterDetailView({
  clusterId,
  eventIds,
  onBack,
}: {
  clusterId: string
  eventIds: number[]
  onBack: () => void
}) {
  const [events, setEvents] = useState<WeatherEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    api.getEventsBulk(eventIds)
      .then(setEvents)
      .catch((err) => setError(err.message ?? 'Failed to load cluster members'))
      .finally(() => setLoading(false))
  }, [eventIds])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="section-title" style={{ margin: 0 }}>Cluster Analysis</h1>
          <p className="section-sub" style={{ margin: 0 }}>
            Comparing {eventIds.length} reports for cluster <strong style={{ color: 'var(--accent)' }}>{clusterId}</strong>
          </p>
        </div>
        <button className="btn" onClick={onBack}>← Back to Admin</button>
      </div>

      {error && <div className="error-box">{error}</div>}

      {loading ? (
        <div className="empty" style={{ padding: '60px' }}>Loading cluster member reports…</div>
      ) : (
        <div style={{
          display: 'flex',
          overflowX: 'auto',
          gap: '20px',
          paddingBottom: '20px',
          scrollbarWidth: 'thin'
        }}>
          {events.map((e) => (
            <ComparisonCard key={e.id} event={e} />
          ))}
        </div>
      )}
    </div>
  )
}
