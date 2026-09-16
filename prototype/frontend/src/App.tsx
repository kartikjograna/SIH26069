import { useEffect, useState } from 'react'
import { NavLink, Route, Routes } from 'react-router-dom'
import { Dashboard } from './pages/Dashboard'
import { Admin } from './pages/Admin'
import { useLiveEvents } from './hooks/useLiveEvents'
import { ConnectingOverlay } from './components/ConnectingOverlay'

type Theme = 'light' | 'dark'

function initialTheme(): Theme {
  try {
    const saved = localStorage.getItem('wx-theme')
    if (saved === 'light' || saved === 'dark') return saved
  } catch {
    /* storage can throw in private mode -- fall through */
  }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function App() {
  // The WebSocket lives at the shell level so navigating between the dashboard
  // and admin panel doesn't drop the stream.
  const { events, state, count } = useLiveEvents()
  const [theme, setTheme] = useState<Theme>(initialTheme)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    try {
      localStorage.setItem('wx-theme', theme)
    } catch {
      /* non-fatal */
    }
  }, [theme])

  return (
    <div className="app">
      <ConnectingOverlay state={state} />

      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">Weather Analytics Platform</span>
          <span className="brand-sub">MoES · IMD · SIH 2026</span>
        </div>

        <nav className="nav">
          <NavLink to="/" className={({ isActive }) => (isActive ? 'active' : '')} end>
            Dashboard
          </NavLink>
          <NavLink to="/admin" className={({ isActive }) => (isActive ? 'active' : '')}>
            Admin
          </NavLink>
        </nav>

        <div className="topbar-right">
          {state === 'open' && (
            <span className="live-dot on">
              Live
              {count > 0 && (
                <span className="muted live-count-text"> · {count.toLocaleString('en-IN')} streamed</span>
              )}
            </span>
          )}
          <button
            className="icon-btn"
            type="button"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
          >
            {theme === 'dark' ? '☀' : '☾'}
          </button>
        </div>
      </header>

      <main className="main">
        <Routes>
          <Route path="/" element={<Dashboard liveEvents={events} liveCount={count} />} />
          <Route path="/admin" element={<Admin />} />
        </Routes>
      </main>
    </div>
  )
}
