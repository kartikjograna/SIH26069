/**
 * Chart + status color tokens.
 *
 * Verification state is a *status* encoding, not a series encoding, so it uses
 * the reserved status palette and always ships with an icon + text label -- hue
 * never carries the meaning alone.
 *
 * Magnitude charts (counts by category / source) are a *sequential* encoding:
 * one hue, light -> dark, more-is-darker. Never a rainbow.
 */
import type { VerificationStatus } from './types'

export interface StatusToken {
  label: string
  color: string
  /** Text glyph so status is never color-alone. */
  icon: string
}

export const STATUS: Record<VerificationStatus, StatusToken> = {
  verified: { label: 'Verified', color: '#0ca30c', icon: '✓' },
  manual_review: { label: 'Manual review', color: '#fab219', icon: '◐' },
  rejected: { label: 'Rejected', color: '#d03b3b', icon: '✕' },
  pending: { label: 'Pending', color: '#898781', icon: '·' },
}

export function statusToken(s: string): StatusToken {
  return STATUS[s as VerificationStatus] ?? STATUS.pending
}

/**
 * Sequential blue ramp (steps 250 -> 650). Index 0 is the lightest.
 * Starts at step 250 so even the lightest bar clears 2:1 on the light surface.
 */
export const SEQUENTIAL_BLUE = [
  '#86b6ef', // 250
  '#6da7ec', // 300
  '#5598e7', // 350
  '#3987e5', // 400
  '#2a78d6', // 450
  '#256abf', // 500
  '#1c5cab', // 550
  '#184f95', // 600
  '#104281', // 650
]

/**
 * Map a value to a sequential step: bigger value -> darker step.
 * `max` is the largest value in the series (0 or negative falls back to mid).
 */
export function sequentialStep(value: number, max: number): string {
  if (!(max > 0)) return SEQUENTIAL_BLUE[4]
  const ratio = Math.min(1, Math.max(0, value / max))
  // Bias upward so the largest bars land in the dark end of the ramp.
  const idx = Math.round(ratio * (SEQUENTIAL_BLUE.length - 1))
  return SEQUENTIAL_BLUE[idx]
}

/** Human-readable labels for the backend's snake_case category keys. */
export const CATEGORY_LABELS: Record<string, string> = {
  rainfall: 'Rainfall',
  thunderstorm: 'Thunderstorm',
  flooding: 'Flooding',
  heatwave: 'Heatwave',
  fog: 'Fog',
  dust_storm: 'Dust storm',
  strong_wind: 'Strong wind',
  snowfall: 'Snowfall',
  hailstorm: 'Hailstorm',
  cyclone: 'Cyclone',
  general: 'General',
}

export function categoryLabel(key: string): string {
  return CATEGORY_LABELS[key] ?? key.replace(/_/g, ' ')
}

/** Human-readable labels for source keys. */
export const SOURCE_LABELS: Record<string, string> = {
  imd_official: 'IMD (official)',
  ndma: 'NDMA',
  news_reuters: 'Reuters',
  news_toi: 'Times of India',
  news_hindustan: 'Hindustan Times',
  twitter_verified: 'X — verified',
  twitter_citizen: 'X — citizen',
  facebook_citizen: 'Facebook — citizen',
  citizen_report: 'Citizen report',
}

export function sourceLabel(key: string): string {
  return SOURCE_LABELS[key] ?? key.replace(/_/g, ' ')
}

/** Compact number formatting for stat tiles: 1,284 / 12.9K / 3.4M */
export function compact(n: number): string {
  if (n < 1000) return String(n)
  if (n < 10_000) return n.toLocaleString('en-IN')
  if (n < 1_000_000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}K`
  return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
}
