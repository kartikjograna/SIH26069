import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../api'
import type { SourceCredibility, WeatherEvent } from '../types'
import { toMarker, topCategory } from '../types'
import { STATUS, categoryLabel, sourceLabel, statusToken } from '../theme'
import { StatTile } from '../components/StatTile'
import { StatusBadge, Tag } from '../components/StatusBadge'
import { VerificationPanel } from '../components/VerificationPanel'
import { timeAgo } from '../components/EventList'

type Tab = 'queue' | 'sources' | 'recent'

export function Admin() {
  const [tab, setTab] = useState<Tab>('queue')
  const [queue, setQueue] = useState<WeatherEvent[]>([])
  const [sources, setSources] = useState<SourceCredibility[]>([])
  const [recent, setRecent] = useState<WeatherEvent[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [busyId, setBusyId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const [q, s, r] = await Promise.all([
        api.reviewQueue(100),
        api.sources(),
        api.recentEvents(60),
      ])
      setQueue(q)
      setSources(s)
      setRecent(r)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reach the backend')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    const id = window.setInterval(load, 8000)
    return () => window.clearInterval(id)
  }, [load])

  async function act(eventId: number, action: 'approve' | 'reject') {
    setBusyId(eventId)
    setError(null)
    try {
      const res = await api.reviewAction(eventId, action)
      // Drop it from the queue immediately; the poll will reconcile.
      setQueue((prev) => prev.filter((e) => e.id !== eventId))
      if (selectedId === eventId) setSelectedId(null)
      setNotice(`Event #${eventId} marked ${res.new_status}.`)
      window.setTimeout(() => setNotice(null), 4000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Review action failed')
    } finally {
      setBusyId(null)
    }
  }

  const selected = useMemo(() => {
    const pool = tab === 'recent' ? recent : queue
    const found = pool.find((e) => e.id === selectedId)
    return found ? toMarker(found) : null
  }, [selectedId, queue, recent, tab])

  const avgCredibility = useMemo(() => {
    if (sources.length === 0) return 0
    return sources.reduce((s, x) => s + x.credibility_score, 0) / sources.length
  }, [sources])

  const totalReports = useMemo(
    () => sources.reduce((s, x) => s + x.total_reports, 0),
    [sources],
  )

  return (
    <div>
      <h1 className="section-title">Verification control room</h1>
      <p className="section-sub">
        Events the models scored between 60% and 85% land here for an expert decision.
      </p>

      {error && <div className="error-box">{error}</div>}
      {notice && <div className="ok-box">{notice}</div>}

      <div className="kpi-row">
        <StatTile
          label="Awaiting review"
          value={queue.length}
          swatch={STATUS.manual_review.color}
          hero
        />
        <StatTile label="Known sources" value={sources.length} />
        <StatTile
          label="Mean source credibility"
          value={`${(avgCredibility * 100).toFixed(0)}%`}
        />
        <StatTile label="Reports attributed" value={totalReports} />
      </div>

      <div className="nav" style={{ marginBottom: 16, marginLeft: 0 }}>
        {(
          [
            ['queue', `Review queue (${queue.length})`],
            ['sources', 'Source credibility'],
            ['recent', 'Recent activity'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            className="icon-btn"
            onClick={() => setTab(key)}
            style={
              tab === key
                ? { background: 'var(--hover-wash)', color: 'var(--text-primary)' }
                : undefined
            }
          >
            {label}
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 16, alignItems: 'start' }}>
        <div className="card">
          {tab === 'queue' && (
            <>
              <div className="card-head">
                <span className="card-title">Manual review queue</span>
                <span className="card-note">highest confidence first</span>
              </div>
              {loading && queue.length === 0 ? (
                <div className="empty">Loading queue…</div>
              ) : queue.length === 0 ? (
                <div className="empty">
                  Queue is clear — nothing is waiting on a human right now.
                </div>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Conf.</th>
                        <th>Location</th>
                        <th>Report</th>
                        <th>Source</th>
                        <th>Flagged for</th>
                        <th>Decision</th>
                      </tr>
                    </thead>
                    <tbody>
                      {queue.map((e) => (
                        <tr
                          key={e.id}
                          onClick={() => setSelectedId(e.id)}
                          style={{ cursor: 'pointer' }}
                        >
                          <td className="num">
                            <strong style={{ color: statusToken('manual_review').color }}>
                              {(e.confidence_score * 100).toFixed(0)}%
                            </strong>
                          </td>
                          <td>
                            <div style={{ fontWeight: 600, fontSize: 12 }}>{e.city}</div>
                            <div className="muted" style={{ fontSize: 11 }}>
                              {e.state}
                            </div>
                          </td>
                          <td className="cell-text">
                            {e.text}
                            <div style={{ marginTop: 4 }}>
                              <Tag>{categoryLabel(topCategory(e.predicted_categories))}</Tag>
                            </div>
                          </td>
                          <td style={{ fontSize: 12 }}>{sourceLabel(e.source)}</td>
                          <td style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                            {e.verification?.reasons.length
                              ? e.verification.reasons.join('; ')
                              : '—'}
                          </td>
                          <td>
                            <div className="btn-row">
                              <button
                                type="button"
                                className="btn btn-approve"
                                disabled={busyId === e.id}
                                onClick={(ev) => {
                                  ev.stopPropagation()
                                  act(e.id, 'approve')
                                }}
                              >
                                Approve
                              </button>
                              <button
                                type="button"
                                className="btn btn-reject"
                                disabled={busyId === e.id}
                                onClick={(ev) => {
                                  ev.stopPropagation()
                                  act(e.id, 'reject')
                                }}
                              >
                                Reject
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

          {tab === 'sources' && (
            <>
              <div className="card-head">
                <span className="card-title">Source credibility</span>
                <span className="card-note">feeds model 5 (XGBoost stand-in)</span>
              </div>
              {sources.length === 0 ? (
                <div className="empty">No sources recorded yet</div>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Source</th>
                        <th>Type</th>
                        <th>Credibility</th>
                        <th>Reports</th>
                        <th>Verified</th>
                        <th>Verified rate</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sources.map((s) => {
                        const rate =
                          s.total_reports > 0 ? s.verified_reports / s.total_reports : 0
                        return (
                          <tr key={s.source_name}>
                            <td style={{ fontWeight: 500 }}>{sourceLabel(s.source_name)}</td>
                            <td>
                              <Tag>{s.source_type}</Tag>
                            </td>
                            <td className="num">{(s.credibility_score * 100).toFixed(0)}%</td>
                            <td className="num">{s.total_reports.toLocaleString('en-IN')}</td>
                            <td className="num">{s.verified_reports.toLocaleString('en-IN')}</td>
                            <td className="num">
                              {s.total_reports > 0 ? `${(rate * 100).toFixed(0)}%` : '—'}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

          {tab === 'recent' && (
            <>
              <div className="card-head">
                <span className="card-title">Recent activity</span>
                <span className="card-note">all statuses, newest first</span>
              </div>
              {recent.length === 0 ? (
                <div className="empty">No events yet</div>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Status</th>
                        <th>Conf.</th>
                        <th>Location</th>
                        <th>Report</th>
                        <th>Source</th>
                        <th>Ingested</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recent.map((e) => (
                        <tr
                          key={e.id}
                          onClick={() => setSelectedId(e.id)}
                          style={{ cursor: 'pointer' }}
                        >
                          <td>
                            <StatusBadge status={e.verification_status} />
                          </td>
                          <td className="num">{(e.confidence_score * 100).toFixed(0)}%</td>
                          <td style={{ fontSize: 12 }}>
                            {e.city}
                            <div className="muted" style={{ fontSize: 11 }}>
                              {e.state}
                            </div>
                          </td>
                          <td className="cell-text">{e.text}</td>
                          <td style={{ fontSize: 12 }}>{sourceLabel(e.source)}</td>
                          <td className="num muted" style={{ fontSize: 11 }}>
                            {timeAgo(e.ingested_at)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>

        <VerificationPanel event={selected} />
      </div>
    </div>
  )
}
