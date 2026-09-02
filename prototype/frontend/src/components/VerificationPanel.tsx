import { useEffect, useState } from 'react'
import type { WeatherEvent, EventMarker } from '../types'
import { api } from '../api'
import { StatusBadge, Tag } from './StatusBadge'
import { categoryLabel, sourceLabel, statusToken } from '../theme'

/**
 * The 5-model verification breakdown for one event.
 *
 * Each model gets a meter. The meters are deliberately *not* all
 * "higher is better" -- fake-news and image-forensics scores are risk scores,
 * so the label says so and the fill uses the severity ramp.
 */

interface MeterRowProps {
  name: string
  impl: string
  score: number
  /** true = a high score is bad (risk), false = a high score is good. */
  risk: boolean
  note?: string
}

function severityColor(score: number, risk: boolean): string {
  const bad = risk ? score : 1 - score
  if (bad >= 0.6) return 'var(--status-critical)'
  if (bad >= 0.35) return 'var(--status-warning)'
  return 'var(--status-good)'
}

function MeterRow({ name, impl, score, risk, note }: MeterRowProps) {
  return (
    <div className="model-row">
      <div>
        <div className="model-name">{name}</div>
        <div className="model-impl">{impl}</div>
      </div>
      <div className="model-score">{(score * 100).toFixed(0)}%</div>
      <div className="meter">
        <div
          className="meter-fill"
          style={{
            width: `${Math.min(100, Math.max(0, score * 100))}%`,
            background: severityColor(score, risk),
          }}
        />
      </div>
      {note && <div className="model-impl" style={{ gridColumn: '1 / -1' }}>{note}</div>}
    </div>
  )
}

export function VerificationPanel({ event }: { event: EventMarker | null }) {
  const [full, setFull] = useState<WeatherEvent | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // The WS payload has no nested `verification`, so fetch the full record.
  useEffect(() => {
    if (!event) {
      setFull(null)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    api
      .getEvent(event.id)
      .then((e) => {
        if (!cancelled) setFull(e)
      })
      .catch((err) => {
        if (!cancelled) setError(err.message ?? 'Failed to load event')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [event])

  if (!event) {
    return (
      <div className="card">
        <div className="card-head">
          <span className="card-title">Verification breakdown</span>
        </div>
        <div className="empty">Select an event on the map or in the feed</div>
      </div>
    )
  }

  const v = full?.verification ?? null
  const token = statusToken(event.verification_status)

  return (
    <div className="card">
      <div className="card-head">
        <span className="card-title">Verification breakdown</span>
        <span className="card-note">#{event.id}</span>
      </div>

      <div style={{ marginBottom: 12 }}>
        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 2 }}>
          {event.city}, {event.state}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>
          {event.text}
        </div>
        <div className="event-meta">
          <StatusBadge status={event.verification_status} />
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
        }}
      >
        <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Final confidence</div>
        <div style={{ fontSize: 24, fontWeight: 600, color: token.color }}>
          {(event.confidence_score * 100).toFixed(1)}%
        </div>
      </div>

      {error && <div className="error-box">{error}</div>}
      {loading && !v && <div className="empty">Loading model scores…</div>}

      {v && (
        <>
          <div className="model-grid">
            <MeterRow
              name="1 · Fake-news detection"
              impl={v.fake_news_model}
              score={v.fake_news_score}
              risk
              note="Risk score — lower is better"
            />
            <MeterRow
              name="2 · Source credibility"
              impl="XGBoost ensemble (stub)"
              score={v.source_credibility_score}
              risk={false}
            />
            <MeterRow
              name="3 · Image forensics"
              impl={full?.has_image ? 'ELA + CNN (stub)' : 'no image attached'}
              score={v.image_forensics_score}
              risk
              note={full?.has_image ? 'Manipulation probability' : undefined}
            />
          </div>

          <div style={{ marginTop: 14 }}>
            <div className="card-title" style={{ marginBottom: 8 }}>
              4 · Event classification
            </div>
            <div className="event-meta">
              {Object.entries(v.event_classification)
                .sort((a, b) => b[1] - a[1])
                .map(([cat, score]) => (
                  <Tag key={cat}>
                    {categoryLabel(cat)} {(score * 100).toFixed(0)}%
                  </Tag>
                ))}
            </div>
          </div>

          <div style={{ marginTop: 14 }}>
            <div className="card-title" style={{ marginBottom: 6 }}>
              5 · Duplicate detection
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              {event.is_duplicate
                ? 'Near-duplicate of an earlier event (MinHash/LSH match)'
                : 'No near-duplicate found'}
            </div>
          </div>

          {v.reasons.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <div className="card-title">Why this decision</div>
              <ul className="reasons">
                {v.reasons.map((r, i) => (
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
