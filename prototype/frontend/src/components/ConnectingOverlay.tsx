import type { ConnState } from '../hooks/useLiveEvents'

interface Props {
  state: ConnState
}

export function ConnectingOverlay({ state }: Props) {
  const isConnected = state === 'open'

  return (
    <div
      className={`connecting-overlay ${isConnected ? 'hidden' : ''}`}
      aria-hidden={isConnected}
      role="dialog"
      aria-label="Server connection status"
    >
      <div className="connecting-card">
        <div className="connecting-radar">
          <div className="radar-ring radar-ring-1" />
          <div className="radar-ring radar-ring-2" />
          <div className="radar-core">
            <span className="radar-dot" />
          </div>
        </div>

        <div className="connecting-content">
          <h2 className="connecting-title">
            {state === 'closed' ? 'Reconnecting to server…' : 'Connecting to server…'}
          </h2>
          <p className="connecting-sub">
            {state === 'closed'
              ? 'Real-time stream interrupted. Re-establishing connection…'
              : 'Establishing live connection to weather intelligence platform…'}
          </p>
          <div className="connecting-status-bar">
            <div className="connecting-progress" />
          </div>
        </div>
      </div>
    </div>
  )
}
