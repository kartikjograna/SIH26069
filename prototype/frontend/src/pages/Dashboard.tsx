import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../api'
import type { EventFilters, EventMarker, LiveEvent, Stats, WeatherEvent } from '../types'
import { toMarker } from '../types'
import { STATUS, categoryLabel, sourceLabel } from '../theme'
import { StatTile } from '../components/StatTile'
import { BarChart, type BarDatum } from '../components/BarChart'
import { VerificationSplit } from '../components/VerificationSplit'
import { EventMap } from '../components/EventMap'
import { EventList } from '../components/EventList'
import { VerificationPanel } from '../components/VerificationPanel'
import { FilterSidebar } from '../components/FilterSidebar'
import { CitizenReportForm } from '../components/CitizenReportForm'

const DEFAULT_FILTERS: EventFilters = { limit: 200 }

/** Does a live event satisfy the currently-applied filters? */
function matchesFilters(e: LiveEvent, f: EventFilters): boolean {
  if (f.status && e.verification_status !== f.status) return false
  if (f.source && e.source !== f.source) return false
  if (f.state && e.state !== f.state) return false
  if (f.city && e.city.toLowerCase() !== f.city.toLowerCase()) return false
  if (f.min_confidence !== undefined && e.confidence_score < f.min_confidence) return false
  if (f.category && !(f.category in (e.predicted_categories ?? {}))) return false
  return true
}

interface Props {
  liveEvents: LiveEvent[]
  liveCount: number
}

export function Dashboard({ liveEvents, liveCount }: Props) {
  const [filters, setFilters] = useState<EventFilters>(DEFAULT_FILTERS)
  const [fetched, setFetched] = useState<WeatherEvent[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [selected, setSelected] = useState<EventMarker | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const [events, s] = await Promise.all([api.listEvents(filters), api.stats()])
      setFetched(events)
      setStats(s)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reach the backend')
    } finally {
      setLoading(false)
    }
  }, [filters])

  // Refetch when filters change.
  useEffect(() => {
    setLoading(true)
    load()
  }, [load])

  // Refresh the aggregate stats periodically so the KPI row tracks ingestion.
  useEffect(() => {
    const id = window.setInterval(() => {
      api.stats().then(setStats).catch(() => {})
    }, 5000)
    return () => window.clearInterval(id)
  }, [])

  /**
   * Merge live events into the fetched set: live ones first, de-duplicated by
   * id, and only those passing the active filters (the server already filtered
   * the fetched page, but live arrivals bypass it).
   */
  const markers: EventMarker[] = useMemo(() => {
    const passing = liveEvents.filter((e) => matchesFilters(e, filters))
    const seen = new Set<number>()
    const out: EventMarker[] = []
    for (const e of passing) {
      if (seen.has(e.id)) continue
      seen.add(e.id)
      out.push(toMarker(e, true))
    }
    for (const e of fetched) {
      if (seen.has(e.id)) continue
      seen.add(e.id)
      out.push(toMarker(e, false))
    }
    return out.slice(0, filters.limit ?? 200)
  }, [liveEvents, fetched, filters])

  const states = useMemo(
    () => Object.keys(stats?.by_state ?? {}).sort(),
    [stats],
  )

  const categoryData: BarDatum[] = useMemo(() => {
    const src = stats?.by_category ?? {}
    return Object.entries(src).map(([k, v]) => ({
      key: k,
      label: categoryLabel(k),
      value: v,
    }))
  }, [stats])

  const sourceData: BarDatum[] = useMemo(() => {
    const src = stats?.by_source ?? {}
    return Object.entries(src).map(([k, v]) => ({
      key: k,
      label: sourceLabel(k),
      value: v,
    }))
  }, [stats])

  const stateData: BarDatum[] = useMemo(() => {
    const src = stats?.by_state ?? {}
    return Object.entries(src).map(([k, v]) => ({ key: k, label: k, value: v }))
  }, [stats])

  return (
    <div>
      <div className="row-between" style={{ marginBottom: 16 }}>
        <div>
          <h1 className="section-title">Real-time weather intelligence</h1>
          <p className="section-sub" style={{ marginBottom: 0 }}>
            Multi-source ingestion, verified by five ML models before it reaches the map.
            {liveCount > 0 && (
              <>
                {' '}
                <strong>{liveCount.toLocaleString('en-IN')}</strong> events streamed this
                session.
              </>
            )}
          </p>
        </div>
      </div>

      {error && (
        <div className="error-box">
          {error} — is the backend running on <code>:8000</code>?
        </div>
      )}

      {/* KPI row. Total events is the single hero figure for this view. */}
      <div className="kpi-row">
        <StatTile label="Total events" value={stats?.total_events ?? 0} hero />
        <StatTile
          label="Verified"
          value={stats?.verified ?? 0}
          swatch={STATUS.verified.color}
          sub={
            stats && stats.total_events > 0
              ? `${((stats.verified / stats.total_events) * 100).toFixed(0)}% of all events`
              : undefined
          }
        />
        <StatTile
          label="Manual review"
          value={stats?.manual_review ?? 0}
          swatch={STATUS.manual_review.color}
          sub="awaiting an expert"
        />
        <StatTile
          label="Rejected"
          value={stats?.rejected ?? 0}
          swatch={STATUS.rejected.color}
          sub="below confidence floor"
        />
        <StatTile
          label="Fake news caught"
          value={stats?.fake_news_detected ?? 0}
          sub="fake-news score > 0.5"
        />
        <StatTile label="Duplicates removed" value={stats?.duplicates_removed ?? 0} />
        <StatTile label="Events last hour" value={stats?.events_last_hour ?? 0} />
        <StatTile
          label="Mean confidence"
          value={`${((stats?.avg_confidence ?? 0) * 100).toFixed(1)}%`}
        />
      </div>

      <div className="dash-grid">
        {/* Left: filters + citizen report */}
        <div className="stack">
          <FilterSidebar
            filters={filters}
            onChange={setFilters}
            states={states}
            onReset={() => setFilters(DEFAULT_FILTERS)}
          />
          <CitizenReportForm onSubmitted={load} />
        </div>

        {/* Centre: map + charts */}
        <div className="stack">
          <div className="card">
            <div className="card-head">
              <span className="card-title">Event map — India</span>
              <span className="card-note">
                {loading ? 'loading…' : `${markers.length} events plotted`}
              </span>
            </div>
            <EventMap events={markers} focused={selected} onSelect={setSelected} />
          </div>

          <div className="card">
            <div className="card-head">
              <span className="card-title">Verification outcomes</span>
              <span className="card-note">share of all processed events</span>
            </div>
            <VerificationSplit
              verified={stats?.verified ?? 0}
              manualReview={stats?.manual_review ?? 0}
              rejected={stats?.rejected ?? 0}
            />
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: 16,
            }}
          >
            <div className="card">
              <div className="card-head">
                <span className="card-title">Events by category</span>
              </div>
              <BarChart data={categoryData} />
            </div>

            <div className="card">
              <div className="card-head">
                <span className="card-title">Events by source</span>
              </div>
              <BarChart data={sourceData} />
            </div>

            <div className="card">
              <div className="card-head">
                <span className="card-title">Top states</span>
              </div>
              <BarChart data={stateData} limit={8} />
            </div>
          </div>
        </div>

        {/* Right: live feed + selected-event breakdown */}
        <div className="stack dash-side-right">
          <div className="card">
            <div className="card-head">
              <span className="card-title">Live feed</span>
              <span className="card-note">newest first</span>
            </div>
            <EventList
              events={markers}
              selectedId={selected?.id}
              onSelect={setSelected}
              emptyNote={loading ? 'Loading events…' : 'No events match these filters'}
            />
          </div>

          <VerificationPanel event={selected} />
        </div>
      </div>
    </div>
  )
}
