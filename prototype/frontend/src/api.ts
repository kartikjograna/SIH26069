/** Typed wrappers around the FastAPI backend. Paths go through the Vite proxy. */
import type {
  WeatherEvent,
  Stats,
  SourceCredibility,
  CitizenReportInput,
  EventFilters,
} from './types'

const BASE = import.meta.env.VITE_API_BASE ?? ''

class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
  if (!res.ok) {
    // FastAPI reports errors as {detail: ...}; fall back to the status text.
    let detail = res.statusText
    try {
      const body = await res.json()
      if (body?.detail) {
        detail = typeof body.detail === 'string' ? body.detail : JSON.stringify(body.detail)
      }
    } catch {
      /* non-JSON body -- keep statusText */
    }
    throw new ApiError(detail, res.status)
  }
  return res.json() as Promise<T>
}

function query(filters: EventFilters): string {
  const p = new URLSearchParams()
  for (const [k, v] of Object.entries(filters)) {
    if (v !== undefined && v !== null && v !== '') p.set(k, String(v))
  }
  const s = p.toString()
  return s ? `?${s}` : ''
}

export const api = {
  listEvents: (filters: EventFilters = {}) =>
    request<WeatherEvent[]>(`/api/events${query(filters)}`),

  getEvent: (id: number) => request<WeatherEvent>(`/api/events/${id}`),

  stats: () => request<Stats>('/api/events/stats/overview'),

  submitCitizenReport: (report: CitizenReportInput) =>
    request<WeatherEvent>('/api/events/citizen-report', {
      method: 'POST',
      body: JSON.stringify(report),
    }),

  reviewQueue: (limit = 50) =>
    request<WeatherEvent[]>(`/api/admin/review-queue?limit=${limit}`),

  reviewAction: (event_id: number, action: 'approve' | 'reject', notes?: string) =>
    request<{ event_id: number; new_status: string; notes: string | null }>(
      '/api/admin/review-action',
      { method: 'POST', body: JSON.stringify({ event_id, action, notes: notes ?? null }) },
    ),

  sources: () => request<SourceCredibility[]>('/api/admin/sources'),

  recentEvents: (limit = 50) =>
    request<WeatherEvent[]>(`/api/admin/events/recent?limit=${limit}`),
}

export { ApiError }
