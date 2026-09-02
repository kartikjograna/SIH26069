import { compact } from '../theme'

interface TileProps {
  label: string
  value: number | string
  /** Optional secondary line, e.g. "of 1,240 total". */
  sub?: string
  /** Identity dot beside the label -- the text itself stays ink. */
  swatch?: string
  /** Exactly one hero per view. */
  hero?: boolean
}

export function StatTile({ label, value, sub, swatch, hero }: TileProps) {
  return (
    <div className="tile">
      <div className="tile-label">
        {swatch && <span className="tile-swatch" style={{ background: swatch }} aria-hidden="true" />}
        {label}
      </div>
      <div className={hero ? 'tile-value hero' : 'tile-value'}>
        {typeof value === 'number' ? compact(value) : value}
      </div>
      {sub && <div className="tile-sub">{sub}</div>}
    </div>
  )
}
