import { useCallback, useEffect, useRef, useState } from 'react'
import type { LiveEvent } from '../types'

export type ConnState = 'connecting' | 'open' | 'closed'

/** Same-origin WS URL so the Vite proxy handles it in dev. */
function wsUrl(): string {
  const scheme = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${scheme}//${window.location.host}/ws/stream`
}

/**
 * Subscribes to /ws/stream and keeps a rolling buffer of the newest events.
 *
 * Reconnects with exponential backoff. The buffer is capped so a long-running
 * demo cannot grow it without bound.
 *
 * Every socket is tagged with the generation that created it. StrictMode mounts
 * the hook twice in dev, and a socket's `onclose` fires *after* the remount has
 * already begun -- without the generation check that stale handler would
 * schedule its own reconnect, leaving two live sockets that both push events
 * (visibly double-counting in the "streamed" total).
 */
export function useLiveEvents(maxBuffer = 300) {
  const [events, setEvents] = useState<LiveEvent[]>([])
  const [state, setState] = useState<ConnState>('connecting')
  const [count, setCount] = useState(0)

  const genRef = useRef(0)
  const socketRef = useRef<WebSocket | null>(null)
  const retryRef = useRef(0)
  const timersRef = useRef<{ reconnect?: number; ping?: number }>({})

  const connect = useCallback(
    (gen: number) => {
      if (gen !== genRef.current) return

      setState('connecting')
      let socket: WebSocket
      try {
        socket = new WebSocket(wsUrl())
      } catch {
        setState('closed')
        return
      }
      socketRef.current = socket

      socket.onopen = () => {
        if (gen !== genRef.current) {
          socket.close()
          return
        }
        retryRef.current = 0
        setState('open')
        // The backend answers "ping" with "pong"; keeps proxies from idling the
        // connection out during a long demo.
        timersRef.current.ping = window.setInterval(() => {
          if (socket.readyState === WebSocket.OPEN) socket.send('ping')
        }, 20_000)
      }

      socket.onmessage = (ev) => {
        if (gen !== genRef.current) return
        if (ev.data === 'pong') return
        let payload: LiveEvent
        try {
          payload = JSON.parse(ev.data)
        } catch {
          return // ignore malformed frames
        }
        if (typeof payload?.id !== 'number') return
        setEvents((prev) => {
          if (prev.some((p) => p.id === payload.id)) return prev
          return [payload, ...prev].slice(0, maxBuffer)
        })
        setCount((c) => c + 1)
      }

      socket.onclose = () => {
        window.clearInterval(timersRef.current.ping)
        // A socket from a superseded generation must not reconnect.
        if (gen !== genRef.current) return
        setState('closed')
        const delay = Math.min(15_000, 1000 * 2 ** retryRef.current)
        retryRef.current += 1
        timersRef.current.reconnect = window.setTimeout(() => connect(gen), delay)
      }
    },
    [maxBuffer],
  )

  useEffect(() => {
    const gen = genRef.current + 1
    genRef.current = gen
    connect(gen)

    return () => {
      // Invalidate this generation so no stale handler reconnects.
      genRef.current += 1
      window.clearInterval(timersRef.current.ping)
      window.clearTimeout(timersRef.current.reconnect)
      socketRef.current?.close()
      socketRef.current = null
    }
  }, [connect])

  const clear = useCallback(() => setEvents([]), [])

  return { events, state, count, clear }
}
