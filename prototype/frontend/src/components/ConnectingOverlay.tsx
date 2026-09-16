import { useEffect, useState } from 'react'
import type { ConnState } from '../hooks/useLiveEvents'

interface Props {
  state: ConnState
}

export function ConnectingOverlay({ state }: Props) {
  const isConnected = state === 'open'
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    if (isConnected) {
      setElapsed(0)
      return
    }

    const timer = window.setInterval(() => {
      setElapsed((prev) => prev + 1)
    }, 1000)

    return () => window.clearInterval(timer)
  }, [isConnected])

  // Progressive status messaging tailored to cold-start delays
  let title = 'Connecting to server…'
  let subtitle = 'Establishing live connection to weather intelligence platform…'
  let stageIndex = 0

  if (state === 'closed') {
    title = 'Reconnecting to server…'
    subtitle = 'Real-time stream interrupted. Re-establishing connection…'
    stageIndex = 1
  } else if (elapsed >= 12) {
    title = 'Cloud instance warming up…'
    subtitle =
      'Free cloud instances spin down after idle periods. Ingesting spatial models and neural pipelines (~30–45s)…'
    stageIndex = 2
  } else if (elapsed >= 4) {
    title = 'Waking up cloud server instance…'
    subtitle = 'Spinning up container runtime and initializing weather analytics engines…'
    stageIndex = 1
  }

  const stages = [
    'Container Boot',
    'Model Initialization',
    'Stream Ready',
  ]

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
          <h2 className="connecting-title">{title}</h2>
          <p className="connecting-sub">{subtitle}</p>

          <div className="connecting-status-bar">
            <div className="connecting-progress" />
          </div>

          <div className="connecting-stages">
            {stages.map((stage, idx) => {
              const isDone = idx < stageIndex
              const isCurrent = idx === stageIndex
              return (
                <div
                  key={stage}
                  className={`connecting-stage-item ${isDone ? 'done' : ''} ${
                    isCurrent ? 'active' : ''
                  }`}
                >
                  <span className="stage-dot" />
                  <span className="stage-label">{stage}</span>
                </div>
              )
            })}
          </div>

          {elapsed >= 6 && (
            <div className="connecting-tip">
              ⏱ {elapsed}s elapsed · Please hold on while the backend finishes cold boot
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
