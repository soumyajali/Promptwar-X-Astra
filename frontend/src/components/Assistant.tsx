import { ArrowUp, Loader2, MessageSquareText, X } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import type { AssistantAnswer } from '../lib/types'
import { PriorityBadge } from './ui'

const SUGGESTIONS = [
  'Which area needs attention first?',
  'How many critical complaints are pending?',
  'What is the most common issue?',
  'Which department has the most assigned work?',
  'Show recurring drainage complaints',
  'What should authorities prioritize today?',
  'Which complaints are likely duplicates?',
]

interface Turn { q: string; a?: AssistantAnswer; error?: string }

export function Assistant({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [turns, setTurns] = useState<Turn[]>([])
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(false)
  const end = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth' }) }, [turns])
  useEffect(() => {
    if (!open) return
    input.current?.focus()
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [open, onClose])

  const ask = async (question: string) => {
    if (!question.trim() || busy) return
    setQ('')
    setBusy(true)
    setTurns((t) => [...t, { q: question }])
    try {
      const a = await api.ask(question)
      setTurns((t) => t.map((x, i) => (i === t.length - 1 ? { ...x, a } : x)))
    } catch (e) {
      setTurns((t) => t.map((x, i) => (i === t.length - 1 ? { ...x, error: (e as Error).message } : x)))
    } finally { setBusy(false) }
  }
  const submit = (e: FormEvent) => { e.preventDefault(); ask(q) }

  return (
    <div className={`drawer ${open ? 'is-open' : ''}`} aria-hidden={!open}>
      <div className="drawer__scrim" onClick={onClose} />
      <section className="drawer__panel" role="dialog" aria-label="CivicPulse assistant" aria-modal="true">
        <header className="drawer__head">
          <div>
            <h2 className="serif">Ask CivicPulse</h2>
            <p className="muted small">Answers are computed from stored reports — never generated or guessed.</p>
          </div>
          <button className="btn btn--quiet" aria-label="Close assistant" onClick={onClose}><X /></button>
        </header>
        <div className="drawer__body">
          {turns.length === 0 && (
            <div className="assist-empty">
              <MessageSquareText />
              <p className="small">Try one of these:</p>
              <div className="assist-suggest">
                {SUGGESTIONS.map((s) => <button key={s} className="chip" onClick={() => ask(s)}>{s}</button>)}
              </div>
            </div>
          )}
          {turns.map((t, i) => (
            <div key={i} className="turn">
              <p className="turn__q">{t.q}</p>
              {t.error && <p className="error">{t.error}</p>}
              {!t.a && !t.error && <p className="muted small"><Loader2 className="spin" size={14} /> Querying the database…</p>}
              {t.a && (
                <div className={`turn__a ${t.a.intent === 'unknown' ? 'is-unknown' : ''}`}>
                  <p>{t.a.answer}</p>
                  {t.a.items.length > 0 && (
                    <ul className="turn__items">
                      {t.a.items.map((it) => (
                        <li key={it.id}>
                          {it.id.startsWith('CP-') ? <Link className="id link-id" to={`/command/reports/${it.id}`} onClick={onClose}>{it.id}</Link> : <Link className="id link-id" to="/command/hotspots" onClick={onClose}>{it.id}</Link>}
                          <span className="small">{it.label} · {it.location}</span>
                          <PriorityBadge level={it.level} score={it.score} />
                        </li>
                      ))}
                    </ul>
                  )}
                  {t.a.evidence.length > 0 && <details className="turn__ev"><summary>Evidence</summary><ul>{t.a.evidence.map((e, j) => <li key={j}>{e}</li>)}</ul></details>}
                  <p className="turn__meta mono">intent: {t.a.intent} · {t.a.source}</p>
                </div>
              )}
            </div>
          ))}
          <div ref={end} />
        </div>
        <form className="drawer__form" onSubmit={submit}>
          <label htmlFor="ask" className="sr-only">Question</label>
          <input id="ask" ref={input} className="input" value={q} maxLength={500} onChange={(e) => setQ(e.target.value)} placeholder="Ask about reports, hotspots, departments…" />
          <button className="btn btn--signal" aria-label="Send" disabled={busy || !q.trim()}><ArrowUp /></button>
        </form>
      </section>
    </div>
  )
}
