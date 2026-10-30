/* Observatory component kit: reusable building blocks shared by the citizen and authority screens. */
import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { STATUS_LABEL } from '../lib/format'
import type { Status } from '../lib/types'

/** Metric tile: label, large mono figure, optional icon and a short note line. */
export function StatTile({ label, value, note, icon: Icon, tone, children }: {
  label: string; value: ReactNode; note?: ReactNode; icon?: LucideIcon; tone?: 'critical' | 'amber' | 'ok'; children?: ReactNode
}) {
  return (
    <div className={`stat ${tone ? `stat--${tone}` : ''}`}>
      {Icon && <span className="stat__icon"><Icon aria-hidden /></span>}
      <div className="stat__body">
        <span className="stat__label">{label}</span>
        <span className="stat__value">{value}</span>
        {note && <span className="stat__note">{note}</span>}
        {children}
      </div>
    </div>
  )
}

/** Card with a title row. `pad=false` lets tables and maps run edge to edge. */
export function Card({ title, sub, action, children, className = '', pad = true }: {
  title?: ReactNode; sub?: ReactNode; action?: ReactNode; children: ReactNode; className?: string; pad?: boolean
}) {
  return (
    <section className={`card ${className}`}>
      {(title || action) && (
        <header className="card__head">
          <div>{title && <h3 className="card__title">{title}</h3>}{sub && <p className="card__sub">{sub}</p>}</div>
          {action}
        </header>
      )}
      <div className={pad ? 'card__body' : 'card__flush'}>{children}</div>
    </section>
  )
}

/** Donut chart drawn in SVG. Segments are proportional; the centre shows the total. */
export function Donut({ data, size = 168, thickness = 22, centre, label = 'Total' }: {
  data: { key: string; label: string; value: number; color: string }[]; size?: number; thickness?: number; centre?: ReactNode; label?: string
}) {
  const total = data.reduce((a, d) => a + d.value, 0)
  const r = (size - thickness) / 2
  const c = 2 * Math.PI * r
  let offset = 0
  const gap = data.filter((d) => d.value > 0).length > 1 ? 2 : 0
  return (
    <div className="donut">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${label}: ${total}. ` + data.map((d) => `${d.label} ${d.value}`).join(', ')}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#172D24" strokeWidth={thickness} />
        {total > 0 && data.map((d) => {
          if (!d.value) return null
          const len = (d.value / total) * c
          const seg = (
            <circle key={d.key} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={d.color} strokeWidth={thickness}
              strokeDasharray={`${Math.max(0, len - gap)} ${c - Math.max(0, len - gap)}`} strokeDashoffset={-offset}
              transform={`rotate(-90 ${size / 2} ${size / 2})`} />
          )
          offset += len
          return seg
        })}
      </svg>
      <div className="donut__centre"><b>{centre ?? total}</b><span>{label}</span></div>
    </div>
  )
}

/** Legend rows for a donut: dot, label, value and percentage. */
export function DonutLegend({ data }: { data: { key: string; label: string; value: number; color: string }[] }) {
  const total = data.reduce((a, d) => a + d.value, 0) || 1
  return (
    <ul className="dlegend">
      {data.map((d) => (
        <li key={d.key}><i style={{ background: d.color }} /><span>{d.label}</span><b className="mono">{d.value}</b><em className="mono">{Math.round((d.value / total) * 100)}%</em></li>
      ))}
    </ul>
  )
}

/** Circular progress ring (resolution rate, priority score). */
export function Ring({ value, max = 100, size = 64, stroke = 7, color = 'var(--civic)', children }: {
  value: number; max?: number; size?: number; stroke?: number; color?: string; children?: ReactNode
}) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const f = Math.max(0, Math.min(1, value / max))
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#172D24" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={`${c * f} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      </svg>
      <div className="ring__in">{children}</div>
    </div>
  )
}

const FLOW: Status[] = ['submitted', 'under_review', 'assigned', 'in_progress', 'resolved']

/** Horizontal status timeline: each step shows the time it was reached (from the report's real timeline). */
export function StepTrack({ status, reachedAt, fmt }: { status: Status; reachedAt: Partial<Record<Status, string>>; fmt: (iso: string) => string }) {
  const idx = FLOW.indexOf(status)
  return (
    <ol className="steptrack" aria-label="Progress">
      {FLOW.map((s, i) => {
        const st = i < idx || (i === idx && s === 'resolved') ? 'done' : i === idx ? 'now' : 'todo'
        return (
          <li key={s} className={`steptrack__s is-${st}`} aria-current={st === 'now' ? 'step' : undefined}>
            <span className="steptrack__dot" />
            <b>{STATUS_LABEL[s]}</b>
            <span className="mono">{reachedAt[s] ? fmt(reachedAt[s]!) : st === 'todo' ? 'Pending' : '—'}</span>
          </li>
        )
      })}
    </ol>
  )
}
