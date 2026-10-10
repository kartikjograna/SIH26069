import { useState, useEffect } from 'react'
import type { FormEvent } from 'react'
import { api } from '../api'
import type { WeatherEvent } from '../types'
import { statusToken, CATEGORY_LABELS } from '../theme'
import { MapContainer, TileLayer, CircleMarker, useMap } from 'react-leaflet'

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

function MapView({ center }: { center: [number, number] }) {
  const map = useMap()
  useEffect(() => {
    map.flyTo(center, 10, { duration: 0.6 })
  }, [center, map])
  return null
}

export function CitizenReportForm({ onSubmitted }: { onSubmitted?: () => void }) {
  const [step, setStep] = useState(1)
  const [city, setCity] = useState('Mumbai')
  const [cityOpen, setCityOpen] = useState(false)
  const [category, setCategory] = useState('general')
  const [text, setText] = useState('')
  const [hasImage, setHasImage] = useState(false)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<WeatherEvent | null>(null)
  const [error, setError] = useState<string | null>(null)

  const preset = CITY_PRESETS[city]

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!text.trim()) return
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
      }, imageFile ?? undefined)
      setResult(created)
      setText('')
      setHasImage(false)
      setImageFile(null)
      onSubmitted?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submission failed')
    } finally {
      setBusy(false)
    }
  }

  const nextStep = () => setStep(s => s + 1)
  const prevStep = () => setStep(s => s - 1)

  return (
    <div className="card">
      {/* Step Indicator */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        marginBottom: '32px',
        position: 'relative',
        padding: '0 10px'
      }}>
        {[1, 2, 3].map(s => (
          <div key={s} style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '8px',
            zIndex: 1,
            flex: 1
          }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              background: step >= s ? 'var(--accent)' : 'var(--border)',
              color: step >= s ? 'white' : 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 'bold',
              transition: 'all 0.3s ease',
              border: `2px solid ${step >= s ? 'var(--accent)' : 'var(--border)'}`
            }}>
              {s}
            </div>
            <span style={{
              fontSize: '11px',
              fontWeight: step === s ? '600' : 'normal',
              color: step === s ? 'var(--text-primary)' : 'var(--text-muted)'
            }}>
              {s === 1 ? 'Location' : s === 2 ? 'Details' : 'Review'}
            </span>
          </div>
        ))}
        {/* Background track */}
        <div style={{
          position: 'absolute',
          top: '16px',
          left: '32px',
          right: '32px',
          height: '2px',
          background: 'var(--border)',
          zIndex: 0
        }} />
        {/* Progress line: expands from left to right */}
        <div style={{
          position: 'absolute',
          top: '16px',
          left: '32px',
          width: `${((step - 1) / 2) * (100 - 64)}%`,
          height: '2px',
          background: 'var(--accent)',
          zIndex: 0,
          transition: 'width 0.3s ease'
        }} />
      </div>

      {error && <div className="error-box">{error}</div>}

      {result && (
        <div className="ok-box">
          Verified in real time →{' '}
          <strong style={{ color: statusToken(result.verification_status).color }}>
            {statusToken(result.verification_status).icon} {statusToken(result.verification_status).label}
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

      {step === 1 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <label className="field">
            <span className="field-label">Your City</span>
            <div style={{ position: 'relative' }}>
              <button
                type="button"
                onClick={() => setCityOpen(!cityOpen)}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: '8px',
                  fontSize: '14px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border)',
                  background: 'var(--bg-primary)',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                {city}, {preset.state}
                <span style={{ fontSize: '10px', opacity: 0.7 }}>▾</span>
              </button>
              {cityOpen && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  zIndex: 2000,
                  background: 'var(--surface-1)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                  marginTop: 4,
                  maxHeight: '200px',
                  overflowY: 'auto',
                  opacity: 1
                }}>
                  {Object.keys(CITY_PRESETS).map((c) => (
                    <div
                      key={c}
                      onClick={() => {
                        setCity(c)
                        setCityOpen(false)
                      }}
                      style={{
                        padding: '8px',
                        fontSize: '14px',
                        cursor: 'pointer',
                        color: 'var(--text-primary)',
                        background: city === c ? 'var(--hover-wash)' : 'transparent',
                        borderBottom: '1px solid var(--border)'
                      }}
                    >
                      {c}, {CITY_PRESETS[c].state}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </label>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
            <div>
              <span className="field-label" style={{ marginBottom: '8px', display: 'block' }}>Event Category</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setCategory(key)}
                    style={{
                      padding: '6px 12px',
                      fontSize: '12px',
                      borderRadius: '20px',
                      border: `1px solid ${category === key ? 'var(--accent)' : 'var(--border)'}`,
                      background: category === key ? 'var(--accent)' : 'var(--bg-primary)',
                      color: category === key ? 'white' : 'var(--text-primary)',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ height: '200px', borderRadius: 'var(--radius)', overflow: 'hidden', border: '1px solid var(--border)' }}>
              <MapContainer center={[preset.lat, preset.lon]} zoom={10} style={{ height: '100%', width: '100%' }} dragging={false} scrollWheelZoom={false}>
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                <MapView center={[preset.lat, preset.lon]} />
                <CircleMarker center={[preset.lat, preset.lon]} radius={8} pathOptions={{ color: 'var(--accent)', fillColor: 'var(--accent)', fillOpacity: 0.6 }} />
              </MapContainer>
            </div>
          </div>
          <button className="btn btn-primary" onClick={nextStep} style={{ alignSelf: 'flex-end' }}>Continue →</button>
        </div>
      )}

      {step === 2 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <label className="field">
            <span className="field-label">What are you seeing?</span>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Example: Heavy waterlogging near the main station, water is knee-deep..."
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
              onChange={(e) => {
                setHasImage(e.target.checked)
                if (!e.target.checked) setImageFile(null)
              }}
              style={{ width: 'auto' }}
            />
            <span className="field-label" style={{ margin: 0 }}>
              Attach a photo (helps our forensic models)
            </span>
          </label>

          {hasImage && (
            <label className="field">
              <span className="field-label">Select Image</span>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) setImageFile(file)
                }}
              />
              {imageFile && (
                <div style={{ fontSize: '0.8rem', color: '#666', marginTop: 4 }}>
                  Selected: {imageFile.name}
                </div>
              )}
            </label>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <button className="btn" onClick={prevStep}>← Back</button>
            <button className="btn btn-primary" onClick={nextStep} disabled={!text.trim()}>Continue →</button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div style={{ background: 'var(--hover-wash)', padding: '16px', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '12px', color: 'var(--text-primary)' }}>Review your report:</div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Location:</span> <strong>{city}, {preset.state}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Category:</span> <strong>{CATEGORY_LABELS[category] || category}</strong>
              </div>
              <div style={{ marginTop: '8px', padding: '8px', background: 'var(--bg-primary)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                {text}
              </div>
              {hasImage && <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ color: 'var(--accent)' }}>✓</span> Image attached: {imageFile?.name}
              </div>}
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <button className="btn" onClick={prevStep}>← Edit Details</button>
            <button className="btn btn-primary" onClick={submit} disabled={busy}>
              {busy ? 'Verifying…' : 'Submit Citizen Report'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
