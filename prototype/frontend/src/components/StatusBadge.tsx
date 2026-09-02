import type { ReactNode } from 'react'
import { statusToken } from '../theme'

/** Verification status: colored glyph + text label, never hue alone. */
export function StatusBadge({ status }: { status: string }) {
  const t = statusToken(status)
  return (
    <span className="badge">
      <span className="badge-glyph" style={{ color: t.color }} aria-hidden="true">
        {t.icon}
      </span>
      {t.label}
    </span>
  )
}

export function Tag({ children }: { children: ReactNode }) {
  return <span className="badge-plain">{children}</span>
}
