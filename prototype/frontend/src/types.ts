import type { WeatherEvent, SourceCredibility } from './types'

export type VerificationStatus = 'verified' | 'manual_review' | 'rejected' | 'pending'

export interface VerificationResult {
  fake_news_score: number
  fake_news_model: string
  event_classification: Record<string, number>
  image_forensics_score: number
  source_credibility_score: number
  final_confidence: number
  decision: string
  reasons: string[]
  verified_at: string
}

export interface WeatherEvent {
  id: number
  external_id: string
  source: string
  source_credibility: number
  text: string
  language: string
  city: string
  state: string
  latitude: number
  longitude: number
  has_image: boolean
  image_url: string | null
  has_video: boolean
  event_time: string
  ingested_at: string
  verification_status: VerificationStatus
  confidence_score: number
  predicted_categories: Record<string, number>
  is_duplicate: boolean
  verification: VerificationResult | null
}

export interface EventMarker {
  id: number
  source: string
  text: string
  city: string
  state: string
  latitude: number
  longitude: number
  event_time: string
  ingested_at: string
  verification_status: VerificationStatus
  confidence_score: number
  predicted_categories: Record<string, number>
  is_duplicate: boolean
  reasons: string[]
  isLive?: boolean
}

export interface Cluster {
  cluster_id: string
  centroid: { lat: number; lng: number }
  category: string
  event_count: number
  event_ids: number[]
  time_range: { start: string; end: string }
  city: string
  avg_confidence?: number | null
  state?: string | null
}

export interface Stats {
  total_events: number
  verified: number
  manual_review: number
  rejected: number
  duplicates_removed: number
  fake_news_detected: number
  events_last_hour: number
  events_last_24h: number
  avg_confidence: number
  by_category: Record<string, number>
  by_source: Record<string, number>
}

export interface SourceCredibility {
  source_name: string
  source_type: string
  credibility_score: number
  total_reports: number
  verified_reports: number
}

export interface CitizenReportInput {
  text: string
  city: string
  state: string
  latitude: number
  longitude: number
  has_image?: boolean
  image_url?: string | null
  event_time?: string | null
}

export interface EventFilters {
  status?: string
  category?: string
  city?: string
  state?: string
  source?: string
  min_confidence?: number
  start_date?: string
  end_date?: string
  limit?: number
  offset?: number
}

export function toMarker(
  e: WeatherEvent | EventMarker,
  isLive = false
): EventMarker {
  const reasons =
    'reasons' in e && Array.isArray(e.reasons)
      ? e.reasons
      : ((e as WeatherEvent).verification?.reasons ?? [])
  return {
    id: e.id,
    source: e.source,
    text: e.text,
    city: e.city,
    state: e.state,
    latitude: e.latitude,
    longitude: e.longitude,
    event_time: e.event_time,
    ingested_at: e.ingested_at,
    verification_status: e.verification_status,
    confidence_score: e.confidence_score,
    predicted_categories: e.predicted_categories ?? {},
    is_duplicate: e.is_duplicate,
    reasons,
    isLive,
  }
}

export function topCategory(cats: Record<string, number>) {
  const entries = Object.entries(cats ?? {})
  if (entries.length === 0) return 'general'
  return entries.reduce((best, cur) => (cur[1] > best[1] ? cur : best))[0]
}
