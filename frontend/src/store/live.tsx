/* Live synchronisation: one EventSource for the whole app. Any server change bumps `version`,
   and every data hook that depends on it refetches. If SSE fails, falls back to polling every 15 s. */
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'

export type LiveState = 'connecting' | 'live' | 'polling'
const POLL_MS = 15000

interface LiveCtx {
  version: number
  state: LiveState
  lastEvent: { event: string; id?: string } | null
  bump: () => void
}

const Ctx = createContext<LiveCtx>({ version: 0, state: 'connecting', lastEvent: null, bump: () => {} })

export function LiveProvider({ children }: { children: ReactNode }) {
  const [version, setVersion] = useState(0)
  const [state, setState] = useState<LiveState>('connecting')
  const [lastEvent, setLastEvent] = useState<LiveCtx['lastEvent']>(null)
  const failures = useRef(0)

  useEffect(() => {
    let es: EventSource | null = null
    let poll: number | undefined
    let retry: number | undefined
    let closed = false

    const startPolling = () => {
      if (poll) return
      setState('polling')
      poll = window.setInterval(() => setVersion((v) => v + 1), POLL_MS)
    }
    const connect = () => {
      if (closed) return
      es = new EventSource('/api/events')
      es.addEventListener('hello', () => {
        failures.current = 0
        setState('live')
        if (poll) { clearInterval(poll); poll = undefined }
        setVersion((v) => v + 1) // resync after (re)connect
      })
      es.addEventListener('change', (e) => {
        try { setLastEvent(JSON.parse((e as MessageEvent).data)) } catch { /* ignore */ }
        setVersion((v) => v + 1)
      })
      es.onerror = () => {
        es?.close()
        failures.current += 1
        startPolling()
        retry = window.setTimeout(connect, Math.min(30000, 2000 * failures.current))
      }
    }
    connect()
    return () => {
      closed = true
      es?.close()
      if (poll) clearInterval(poll)
      if (retry) clearTimeout(retry)
    }
  }, [])

  const bump = useCallback(() => setVersion((v) => v + 1), [])
  return <Ctx.Provider value={{ version, state, lastEvent, bump }}>{children}</Ctx.Provider>
}

export const useLive = () => useContext(Ctx)

/** Fetch data and refetch whenever the live version changes. Keeps old data while refreshing. */
export function useLiveQuery<T>(fn: () => Promise<T>, deps: unknown[] = [], opts: { live?: boolean } = {}) {
  const { version } = useLive()
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const [loading, setLoading] = useState(true)
  const fnRef = useRef(fn)
  fnRef.current = fn
  const [tick, setTick] = useState(0)
  const v = opts.live === false ? 0 : version

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fnRef.current()
      .then((d) => { if (!cancelled) { setData(d); setError(null) } })
      .catch((e) => { if (!cancelled) setError(e) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [v, tick, ...deps])

  return { data, error, loading, reload: () => setTick((t) => t + 1), setData }
}
