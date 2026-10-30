import { ArrowUp, Loader2, MessageSquareText, RotateCcw, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ApiError, api } from '../lib/api'
import type { AssistantAnswer } from '../lib/types'
import { PriorityBadge } from './ui'

const STARTERS = [
  'Which area needs attention first?',
  'How many critical complaints are pending?',
  'Show all hotspots',
  'List unassigned reports',
  'How many reports came in today?',
  'Which department has the most assigned work?',
  'Which complaints are likely duplicates?',
]

type Turn =
  | { id: number; q: string; state: 'queued' | 'sending' }
  | { id: number; q: string; state: 'done'; a: AssistantAnswer }
  | { id: number; q: string; state: 'error'; error: string }

let seq = 0

export function Assistant({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [turns, setTurns] = useState<Turn[]>([])
  const [q, setQ] = useState('')
  const end = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const running = useRef(false)
  const context = useRef<Record<string, string> | undefined>(undefined)

  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }) }, [turns])
  useEffect(() => {
    // `inert` keeps the closed drawer out of the tab order and away from screen readers.
    if (panel.current) panel.current.inert = !open
    if (!open) return
    input.current?.focus()
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [open, onClose])

  /* Messages are processed one at a time, in order. Nothing typed while an answer is loading is dropped. */
  const queue = useRef<{ id: number; q: string }[]>([])
  const setTurn = (id: number, next: Turn) => setTurns((ts) => ts.map((t) => (t.id === id ? next : t)))
  const pump = useCallback(async () => {
    if (running.current) return
    running.current = true
    try {
      while (queue.current.length) {
        const cur = queue.current.shift()!
        setTurn(cur.id, { id: cur.id, q: cur.q, state: 'sending' })
        try {
          const a = await api.ask(cur.q, context.current)
          context.current = a.slots
          setTurn(cur.id, { id: cur.id, q: cur.q, state: 'done', a })
        } catch (e) {
          const msg = e instanceof ApiError
            ? (e.status === 0 ? 'Could not reach the CivicPulse server. Check that the backend is running, then retry.' : `The server answered with an error (${e.status}): ${e.message}`)
            : 'Something went wrong while sending. Please retry.'
          setTurn(cur.id, { id: cur.id, q: cur.q, state: 'error', error: msg })
        }
      }
    } finally {
      running.current = false
    }
  }, [])

  const enqueue = (id: number, text: string) => { queue.current.push({ id, q: text }); void pump() }
  const ask = (question: string) => {
    const text = question.trim()
    if (!text) return
    setQ('')
    const id = ++seq
    setTurns((ts) => [...ts, { id, q: text, state: 'queued' }])
    enqueue(id, text)
  }
  const retry = (id: number) => {
    const t = turns.find((x) => x.id === id)
    if (!t) return
    setTurn(id, { id, q: t.q, state: 'queued' })
    enqueue(id, t.q)
  }
  const submit = (e: FormEvent) => { e.preventDefault(); ask(q) }
  const busy = turns.some((t) => t.state === 'queued' || t.state === 'sending')
  const last = [...turns].reverse().find((t) => t.state === 'done') as Extract<Turn, { state: 'done' }> | undefined
  const followUps = (last?.a.suggestions?.length ? last.a.suggestions : STARTERS.slice(0, 3)).slice(0, 3)

  return (
    <div className={`drawer ${open ? 'is-open' : ''}`} aria-hidden={!open}>
      <div className="drawer__scrim" onClick={onClose} />
      <section className="drawer__panel" ref={panel} role="dialog" aria-label="CivicPulse assistant" aria-modal="true">
        <header className="drawer__head">
          <div>
            <h2 className="serif">Ask CivicPulse</h2>
            <p className="muted small">Answers are computed from the stored reports. Figures are never guessed.</p>
          </div>
          <div className="drawer__headbtns">
            {turns.length > 0 && <button className="btn btn--quiet btn--sm" onClick={() => { setTurns([]); queue.current = []; context.current = undefined }}>Clear</button>}
            <button className="btn btn--quiet" aria-label="Close assistant" onClick={onClose}><X /></button>
          </div>
        </header>
        <div className="drawer__body" aria-live="polite">
          {turns.length === 0 && (
            <div className="assist-empty">
              <MessageSquareText />
              <p className="small">Ask in your own words, or start with one of these:</p>
              <div className="assist-suggest">
                {STARTERS.map((s) => <button key={s} className="chip" onClick={() => ask(s)}>{s}</button>)}
              </div>
            </div>
          )}
          {turns.map((t) => (
            <div key={t.id} className="turn">
              <p className="turn__q">{t.q}</p>
              {(t.state === 'queued' || t.state === 'sending') && (
                <p className="turn__wait"><Loader2 className="spin" size={14} />{t.state === 'sending' ? 'Looking it up in the report database…' : 'Waiting for the previous answer…'}</p>
              )}
              {t.state === 'error' && (
                <div className="turn__err" role="alert">
                  <p>{t.error}</p>
                  <button className="btn btn--ghost btn--sm" onClick={() => retry(t.id)}><RotateCcw />Retry</button>
                </div>
              )}
              {t.state === 'done' && (
                <div className={`turn__a ${t.a.intent === 'unknown' ? 'is-unknown' : ''}`}>
                  <p>{t.a.answer}</p>
                  {t.a.items.length > 0 && (
                    <ul className="turn__items">
                      {t.a.items.map((it, i) => (
                        <li key={`${it.id}-${i}`}>
                          <Link className="id link-id" to={it.id.startsWith('CP-') ? `/command/reports/${it.id}` : '/command/hotspots'} onClick={onClose}>{it.id}</Link>
                          <span className="small">{it.label} · {it.location}</span>
                          <PriorityBadge level={it.level} score={it.score} />
                        </li>
                      ))}
                    </ul>
                  )}
                  {t.a.evidence.length > 0 && <details className="turn__ev"><summary>How this was worked out</summary><ul>{t.a.evidence.map((e, j) => <li key={j}>{e}</li>)}</ul></details>}
                  <p className="turn__meta">
                    {t.a.engine === 'claude' ? `Phrased by ${t.a.model ?? 'a language model'} from stored data` : 'Local engine · stored data'}
                    {t.a.source ? ` · ${t.a.source}` : ''}
                    {t.a.fallback_reason ? ` · language model not used: ${t.a.fallback_reason}` : ''}
                  </p>
                </div>
              )}
            </div>
          ))}
          <div ref={end} />
        </div>
        {turns.length > 0 && (
          <div className="assist-follow" aria-label="Suggested questions">
            {followUps.map((s) => <button key={s} className="chip chip--sm" onClick={() => ask(s)}>{s}</button>)}
          </div>
        )}
        <form className="drawer__form" onSubmit={submit}>
          <label htmlFor="ask" className="sr-only">Question</label>
          <input id="ask" ref={input} className="input" value={q} maxLength={500} onChange={(e) => setQ(e.target.value)}
            placeholder="Ask about reports, hotspots, departments…" autoComplete="off" />
          <button className="btn btn--signal" aria-label={busy ? 'Send (queued after current answer)' : 'Send'} disabled={!q.trim()}>
            {busy ? <Loader2 className="spin" /> : <ArrowUp />}
          </button>
        </form>
      </section>
    </div>
  )
}
