import { AlertTriangle, Inbox, RefreshCw } from 'lucide-react'
import { Component, useEffect, useState, type CSSProperties, type ErrorInfo, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { CATEGORY_META } from '../lib/constants'
import { LEVEL_LABEL, STATUS_LABEL } from '../lib/format'
import type { CategoryKey, Factor, Level, Status, TimelineEntry } from '../lib/types'
import { fmtDate } from '../lib/format'
import { useLive } from '../store/live'

export function Logo({ light = false, compact = false }: { light?: boolean; compact?: boolean }) {
  return (
    <span className={`logo ${light ? 'logo--light' : ''}`}>
      <svg viewBox="0 0 32 32" aria-hidden="true" className="logo__mark">
        <rect width="32" height="32" rx="7" fill={light ? '#E4E1D1' : '#2C5040'} />
        <path d="M4 18h6l2.5-7 4 13 3-9 1.5 3H28" fill="none" stroke={light ? '#2C5040' : '#ECE8DC'} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="22" cy="18" r="2.4" fill="#E2622F" />
      </svg>
      {!compact && (
        <span className="logo__word">
          CivicPulse<span className="logo__ai">AI</span>
        </span>
      )}
    </span>
  )
}

/** Photographic page banner shared by the citizen pages (same city image as the landing hero). */
export function PageBanner({ eyebrow, title, children }: { eyebrow: string; title: string; children?: ReactNode }) {
  return (
    <section className="banner">
      <img className="banner__img" src="/img/hero-city-sm.jpg" alt="" />
      <div className="banner__shade" aria-hidden />
      <div className="wrap banner__inner">
        <span className="eyebrow eyebrow--light">{eyebrow}</span>
        <h1 className="serif display-1">{title}</h1>
        {children}
      </div>
    </section>
  )
}

export const PriorityBadge = ({ level, score }: { level: Level; score?: number }) => (
  <span className={`badge badge--${level}`}>
    <span className="dot" />
    {LEVEL_LABEL[level]}
    {score != null && <span className="mono" style={{ fontWeight: 500 }}>{score}</span>}
  </span>
)

export const StatusPill = ({ status }: { status: Status }) => (
  <span className={`status status--${status}`}><i />{STATUS_LABEL[status]}</span>
)

export function CategoryTag({ category, label }: { category: CategoryKey; label?: string }) {
  const M = CATEGORY_META[category] ?? CATEGORY_META.other
  const Icon = M.icon
  return <span className="tag"><Icon aria-hidden />{label ?? M.label}</span>
}

export function ScoreBreakdown({ factors, compact = false }: { factors: Factor[]; compact?: boolean }) {
  return (
    <div className="factors">
      {factors.map((f) => (
        <div className="factor" key={f.key}>
          <div className="factor__name">{f.label}</div>
          <div className="factor__bar" aria-label={`${f.label} ${f.points} of ${f.weight} points`}>
            <span style={{ width: `${(f.points / f.weight) * 100}%`, background: f.raw >= .7 ? 'var(--signal)' : f.raw >= .4 ? 'var(--ochre)' : 'var(--ink-soft)' }} />
          </div>
          <div className="factor__pts">{f.points.toFixed(0)}<small>/{f.weight}</small></div>
          {!compact && <div className="factor__ev">{f.evidence.join(' · ')}</div>}
        </div>
      ))}
    </div>
  )
}

export function Timeline({ items }: { items: TimelineEntry[] }) {
  if (!items.length) return <p className="muted">No updates yet.</p>
  return (
    <ol className="timeline">
      {[...items].reverse().map((t) => (
        <li key={t.id} className={[
          t.kind === 'status' || t.kind === 'assignment' ? 'is-status' : '',
          t.status === 'resolved' ? 'is-resolved' : '',
          t.visibility === 'internal' ? 'is-internal' : '',
        ].join(' ')}>
          <div className="timeline__meta">
            {fmtDate(t.created_at)} · {t.actor}{t.visibility === 'internal' ? ' · internal' : ''}
          </div>
          <div className="timeline__msg">
            {t.status && <><StatusPill status={t.status} /> </>}
            {t.message}
          </div>
        </li>
      ))}
    </ol>
  )
}

export function Skeleton({ h = 20, w = '100%', style }: { h?: number; w?: number | string; style?: CSSProperties }) {
  return <div className="skeleton" style={{ height: h, width: w, ...style }} />
}

export function ErrorState({ error, onRetry }: { error: Error; onRetry?: () => void }) {
  return (
    <div className="state state--error" role="alert">
      <AlertTriangle size={22} color="#A1340F" />
      <h4>Couldn't load this</h4>
      <p className="muted">{error.message}</p>
      {onRetry && <button className="btn btn--ghost btn--sm" onClick={onRetry}><RefreshCw />Try again</button>}
    </div>
  )
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="state">
      <Inbox size={22} />
      <h4>{title}</h4>
      {children && <div className="muted">{children}</div>}
    </div>
  )
}

export function LiveIndicator({ light = false }: { light?: boolean }) {
  const { state } = useLive()
  const label = state === 'live' ? 'Live' : state === 'polling' ? 'Polling · 15s' : 'Connecting'
  return (
    <span className={`live live--${state}`} style={light ? { color: 'var(--ink)' } : undefined}
      title={state === 'live' ? 'Connected via Server-Sent Events' : state === 'polling' ? 'Live stream unavailable; refreshing every 15 seconds' : 'Connecting to live updates'}>
      <i />{label}
    </span>
  )
}

export function Toast({ message, onDone }: { message: string | null; onDone: () => void }) {
  useEffect(() => {
    if (!message) return
    const t = setTimeout(onDone, 3200)
    return () => clearTimeout(t)
  }, [message, onDone])
  if (!message) return null
  return <div className="toast" role="status">{message}</div>
}

export function useToast() {
  const [msg, setMsg] = useState<string | null>(null)
  return { msg, show: setMsg, clear: () => setMsg(null) }
}

export const ReportLink = ({ id, authority = false }: { id: string; authority?: boolean }) => (
  <Link className="id link-id" to={authority ? `/command/reports/${id}` : `/track/${id}`}>{id}</Link>
)

interface EBState { error: Error | null }
export class ErrorBoundary extends Component<{ children: ReactNode }, EBState> {
  state: EBState = { error: null }
  static getDerivedStateFromError(error: Error) { return { error } }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error('UI error', error, info) }
  render() {
    if (this.state.error) {
      return (
        <div className="wrap" style={{ padding: '64px 0' }}>
          <ErrorState error={this.state.error} onRetry={() => { this.setState({ error: null }); location.reload() }} />
        </div>
      )
    }
    return this.props.children
  }
}
