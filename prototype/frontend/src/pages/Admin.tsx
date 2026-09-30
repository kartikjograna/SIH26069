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

// In-memory module cache to prevent skeleton flickers during route navigation (stale-while-revalidate)
let cachedQueue: WeatherEvent[] | null = null
let cachedSources: SourceCredibility[] | null = null
let cachedRecent: WeatherEvent[] | null = null

export function Admin() {
  const [tab, setTab] = useState<Tab>('queue')
  const hasCache = cachedQueue !== null && cachedSources !== null && cachedRecent !== null

  const [queue, setQueue] = useState<WeatherEvent[]>(cachedQueue ?? [])
  const [totalQueue, setTotalQueue] = useState(0)
  const [sources, setSources] = useState<SourceCredibility[]>(cachedSources ?? [])
  const [recent, setRecent] = useState<WeatherEvent[]>(cachedRecent ?? [])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [busyId, setBusyId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [loading, setLoading] = useState(!hasCache)

  // Pagination & Sorting State
  const [offset, setOffset] = useState(0)
  const [sortBy, setSortBy] = useState<'ingested_at' | 'confidence_score'>('ingested_at')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [confRange, setConfRange] = useState({ min: 0, max: 1 })
  const LIMIT = 50

  const load = useCallback(async () => {
    try {
      const [qRes, s, r] = await Promise.all([
        api.reviewQueue({
          limit: LIMIT,
          offset,
          sortBy,
          sortDir,
          minConf: confRange.min,
          maxConf: confRange.max,
        }),
        api.sources(),
        api.recentEvents(60),
      ])
      cachedQueue = qRes.items
      cachedSources = s
      cachedRecent = r
      setQueue(qRes.items)
      setTotalQueue(qRes.total)
      setSources(s)
      setRecent(r)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reach the backend')
    } finally {
      setLoading(false)
    }
  }, [offset, sortBy, sortDir, confRange])

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
      setQueue((prev) => {
        const next = prev.filter((e) => e.id !== eventId)
        cachedQueue = next
        return next
      })
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
          loading={loading && queue.length === 0 && sources.length === 0}
          hero
        />
        <StatTile
          label="Known sources"
          value={sources.length}
          loading={loading && queue.length === 0 && sources.length === 0}
        />
        <StatTile
          label="Mean source credibility"
          value={`${(avgCredibility * 100).toFixed(0)}%`}
          loading={loading && queue.length === 0 && sources.length === 0}
        />
        <StatTile
          label="Reports attributed"
          value={totalReports}
          loading={loading && queue.length === 0 && sources.length === 0}
        />
      </div>

      <div className="admin-tabs">
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

      <div className="admin-grid">
        <div className="card">
          {tab === 'queue' && (
            <>
              <div className="card-head">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                  <div>
                    <span className="card-title">Manual review queue</span>
                    <span className="card-note">Experts decision needed</span>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <select
                      value={sortBy}
                      onChange={(e) => {
                        setSortBy(e.target.value as any)
                        setSortDir(e.target.value === 'confidence_score' ? 'asc' : 'desc')
                        setOffset(0)
                      }}
                      style={{ fontSize: 12, padding: 4, borderRadius: 4, border: '1px solid var(--border)' }}
                    >
                      <option value="ingested_at">Newest First</option>
                      <option value="confidence_score">Most Uncertain</option>
                    </select>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
                      <span>Conf:</span>
                      <input
                        type="number"
                        value={confRange.min * 100}
                        onChange={(e) => {
                          setConfRange(prev => ({ ...prev, min: parseFloat(e.target.value || '0') / 100 }))
                          setOffset(0)
                        }}
                        style={{ width: 40, padding: 2, borderRadius: 4, border: '1px solid var(--border)' }}
                      />
                      <span>-</span>
                      <input
                        type="number"
                        value={confRange.max * 100}
                        onChange={(e) => {
                          setConfRange(prev => ({ ...prev, max: parseFloat(e.target.value || '0') / 100 }))
                          setOffset(0)
                        }}
                        style={{ width: 40, padding: 2, borderRadius: 4, border: '1px solid var(--border)' }}
                      />
                      <span>%</span>
                    </div>
                  </div>
                </div>
              </div>
              {loading && queue.length === 0 ? (
                <div className="empty">Loading queue…</div>
              ) : queue.length === 0 ? (
                <div className="empty">
                  Queue is clear — nothing is waiting on a human right now.
                </div>
              ) : (
                <>
                  {/* Desktop Table View */}
                  <div className="table-wrap queue-desktop-table">
                    <table className="queue-table">
                      <thead>
                        <tr>
                          <th>Conf.</th>
                          <th>Location</th>
                          <th>Report</th>
                          <th>Source</th>
                          <th>Flagged for</th>
                          <th className="sticky-action-col">Decision</th>
                        </tr>
                      </thead>
                      <tbody>
                        {queue.map((e) => (
                          <tr
                            key={e.id}
                            onClick={() => setSelectedId(e.id)}
                            style={{ cursor: 'pointer' }}
                            className={selectedId === e.id ? 'row-selected' : ''}
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
                            <td className="sticky-action-col">
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
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '12px',
                    borderTop: '1px solid var(--border)',
                    fontSize: 12,
                    color: 'var(--text-secondary)'
                  }}>
                    <button
                      type="button"
                      className="btn"
                      disabled={offset === 0}
                      onClick={() => setOffset(prev => prev - LIMIT)}
                      style={{ padding: '4px 8px' }}
                    >
                      ← Previous
                    </button>
                    <span>Page {Math.floor(offset / LIMIT) + 1} of {Math.ceil(totalQueue / LIMIT) || 1}</span>
                    <button
                      type="button"
                      className="btn"
                      disabled={queue.length < LIMIT}
                      onClick={() => setOffset(prev => prev + LIMIT)}
                      style={{ padding: '4px 8px' }}
                    >
                      Next →
                    </button>
                  </div>
                </>

                  {/* Mobile Cards View - zero horizontal scroll, instant touch actions */}
                  <div className="queue-mobile-list">
                    {queue.map((e) => (
                      <div
                        key={e.id}
                        className={`queue-card ${selectedId === e.id ? 'selected' : ''}`}
                        onClick={() => setSelectedId(e.id)}
                      >
                        <div className="queue-card-header">
                          <div className="queue-card-badge-group">
                            <span
                              className="queue-conf-badge"
                              style={{
                                color: statusToken('manual_review').color,
                                borderColor: statusToken('manual_review').color,
                              }}
                            >
                              {(e.confidence_score * 100).toFixed(0)}% Conf
                            </span>
                            <Tag>{sourceLabel(e.source)}</Tag>
                          </div>
                          <span className="queue-card-location">
                            <strong>{e.city}</strong>, {e.state}
                          </span>
                        </div>

                        <div className="queue-card-body">
                          <p className="queue-card-text">{e.text}</p>
                          <div className="queue-card-meta">
                            <Tag>{categoryLabel(topCategory(e.predicted_categories))}</Tag>
                            {e.verification?.reasons.length ? (
                              <span className="queue-flag-note">
                                ⚠ {e.verification.reasons.join('; ')}
                              </span>
                            ) : null}
                          </div>
                        </div>

                        <div className="queue-card-actions">
                          <button
                            type="button"
                            className="btn btn-approve queue-btn"
                            disabled={busyId === e.id}
                            onClick={(ev) => {
                              ev.stopPropagation()
                              act(e.id, 'approve')
                            }}
                          >
                            ✓ Approve
                          </button>
                          <button
                            type="button"
                            className="btn btn-reject queue-btn"
                            disabled={busyId === e.id}
                            onClick={(ev) => {
                              ev.stopPropagation()
                              act(e.id, 'reject')
                            }}
                          >
                            ✕ Reject
                          </button>
                        </div>
                      </div>
                    ))}
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '12px',
                      fontSize: 12,
                      color: 'var(--text-secondary)',
                      borderTop: '1px solid var(--border)'
                    }}>
                      <button
                        type="button"
                        className="btn"
                        disabled={offset === 0}
                        onClick={() => setOffset(prev => prev - LIMIT)}
                        style={{ padding: '4px 8px' }}
                      >
                        ← Previous
                      </button>
                      <span>Page {Math.floor(offset / LIMIT) + 1} of {Math.ceil(totalQueue / LIMIT) || 1}</span>
                      <button
                        type="button"
                        className="btn"
                        disabled={queue.length < LIMIT}
                        onClick={() => setOffset(prev => prev + LIMIT)}
                        style={{ padding: '4px 8px' }}
                      >
                        Next →
                      </button>
                    </div>
                  </div>
                </>
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
