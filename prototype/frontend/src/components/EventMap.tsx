import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet'
import { useEffect } from 'react'
import type { EventMarker } from '../types'
import { topCategory } from '../types'
import { statusToken, categoryLabel, sourceLabel, STATUS } from '../theme'

/** Centre of India, zoomed to fit the mainland + islands reasonably. */
const INDIA_CENTER: [number, number] = [22.5, 79.5]
const INDIA_ZOOM = 4.5
/** Recentres when the caller asks to focus a specific event. */
function FocusOn({ target }: { target: EventMarker | null }) {
  const map = useMap()
  useEffect(() => {
    if (target) {
      map.flyTo([target.latitude, target.longitude], 7, { duration: 0.6 })
    }
  }, [target, map])
  return null
}

interface Props {
  events: EventMarker[]
  focused: EventMarker | null
  onSelect: (e: EventMarker) => void
}

export function EventMap({ events, focused, onSelect }: Props) {
  return (
    <div>
      <div className="map-wrap">
        <MapContainer
          center={INDIA_CENTER}
          zoom={INDIA_ZOOM}
          /* Fractional zoom needs an explicit snap/delta, otherwise Leaflet
             rounds INDIA_ZOOM and India sits awkwardly in the frame. */
          zoomSnap={0.5}
          zoomDelta={0.5}
          minZoom={3}
          scrollWheelZoom
          worldCopyJump={false}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <FocusOn target={focused} />

          {events.map((e) => {
            const token = statusToken(e.verification_status)
            const isFocused = focused?.id === e.id
            return (
              <CircleMarker
                key={e.id}
                center={[e.latitude, e.longitude]}
                // Confidence drives size; status drives color.
                radius={isFocused ? 11 : 5 + e.confidence_score * 5}
                pathOptions={{
                  color: '#fcfcfb', // 2px surface ring keeps overlaps legible
                  weight: 2,
                  fillColor: token.color,
                  fillOpacity: 0.85,
                }}
                eventHandlers={{ click: () => onSelect(e) }}
              >
                <Popup>
                  <div className="popup-body">
                    <div className="popup-title">
                      {e.city}, {e.state}
                    </div>
                    <div className="popup-text">{e.text}</div>
                    <div>
                      <strong>{token.icon} {token.label}</strong>
                      {' · '}
                      {(e.confidence_score * 100).toFixed(0)}% confidence
                    </div>
                    <div style={{ color: '#666', marginTop: 4 }}>
                      {categoryLabel(topCategory(e.predicted_categories))} ·{' '}
                      {sourceLabel(e.source)}
                    </div>
                  </div>
                </Popup>
              </CircleMarker>
            )
          })}
        </MapContainer>
      </div>

      <div className="map-legend">
        {[STATUS.verified, STATUS.manual_review, STATUS.rejected].map((s) => (
          <span className="legend-item" key={s.label}>
            <span className="legend-swatch" style={{ background: s.color }} aria-hidden="true" />
            {s.icon} {s.label}
          </span>
        ))}
        <span className="muted">Marker size = confidence</span>
      </div>
    </div>
  )
}
