import { useState } from 'react'
import type { FormEvent } from 'react'
import { api } from '../api'
import type { WeatherEvent } from '../types'
import { statusToken } from '../theme'

/** A few cities with real coordinates, so the demo needs no geocoder. */
const CITY_PRESETS: Record<string, { state: string; lat: number; lon: number }> = {
  Mumbai: { state: 'Maharashtra', lat: 19.076, lon: 72.8777 },
  Delhi: { state: 'Delhi', lat: 28.6139, lon: 77.209 },
  Chennai: { state: 'Tamil Nadu', lat: 13.0827, lon: 80.2707 },
  Kolkata: { state: 'West Bengal', lat: 22.5726, lon: 88.3639 },
  Bengaluru: { state: 'Karnataka', lat: 12.9716, lon: 77.5946 },
  Guwahati: { state: 'Assam', lat: 26.1445, lon: 91.7362 },
  Jaipur: { state: 'Rajasthan', lat: 26.9124, lon: 75.7873 },
  Leh: { state: 'Ladakh', lat: 34.1526, lon: 77.5771 },
}

export function CitizenReportForm({ onSubmitted }: { onSubmitted?: () => void }) {
  const [city, setCity] = useState('Mumbai')
  const [text, setText] = useState('')
  const [hasImage, setHasImage] = useState(false)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<WeatherEvent | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!text.trim()) return
    const preset = CITY_PRESETS[city]
    setBusy(true)
    setError(null)
    setResult(null)
    try {
      const created = await api.submitCitizenReport({
        text: text.trim(),
        city,
        state: preset.state,
        latitude: preset.lat,
        longitude: preset.lon,
        has_image: hasImage,
        image_url: hasImage ? `https://example.org/citizen/${Date.now()}.jpg` : null,
      })
      setResult(created)
      setText('')
      setHasImage(false)
      onSubmitted?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submission failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card">
      <div className="card-head">
        <span className="card-title">Submit a citizen report</span>
        <span className="card-note">runs the full 5-model check</span>
      </div>

      {error && <div className="error-box">{error}</div>}

      {result && (
        <div className="ok-box">
          Verified in real time →{' '}
          <strong style={{ color: statusToken(result.verification_status).color }}>
            {statusToken(result.verification_status).icon}{' '}
            {statusToken(result.verification_status).label}
          </strong>{' '}
          at {(result.confidence_score * 100).toFixed(1)}% confidence.
          {result.verification?.reasons.length ? (
            <ul className="reasons">
              {result.verification.reasons.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          ) : null}
        </div>
      )}

      <form onSubmit={submit}>
        <label className="field">
          <span className="field-label">City</span>
          <select value={city} onChange={(e) => setCity(e.target.value)}>
            {Object.keys(CITY_PRESETS).map((c) => (
              <option key={c} value={c}>
                {c}, {CITY_PRESETS[c].state}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span className="field-label">What are you seeing?</span>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Heavy waterlogging near Andheri station, knee-deep water since 6:30 am"
            maxLength={2000}
          />
        </label>

        <label
          className="field"
          style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
        >
          <input
            type="checkbox"
            checked={hasImage}
            onChange={(e) => setHasImage(e.target.checked)}
            style={{ width: 'auto' }}
          />
          <span className="field-label" style={{ margin: 0 }}>
            Attach a photo (runs image forensics)
          </span>
        </label>

        <button className="btn btn-primary" type="submit" disabled={busy || !text.trim()}>
          {busy ? 'Verifying…' : 'Submit report'}
        </button>
      </form>
    </div>
  )
}
