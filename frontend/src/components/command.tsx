/* Shared Command Center building blocks. */
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { CategoryTag, PriorityBadge, StatusPill } from './ui'
import type { AuthorityReport } from '../lib/types'
import { timeAgo } from '../lib/format'

export function PageHead({ eyebrow, title, children, actions }: { eyebrow: string; title: string; children?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="cpage__head">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1 className="serif cpage__title">{title}</h1>
        {children && <p className="cpage__lede">{children}</p>}
      </div>
      {actions && <div className="cpage__actions">{actions}</div>}
    </header>
  )
}

export function Metric({ label, value, note, tone }: { label: string; value: ReactNode; note?: ReactNode; tone?: 'signal' | 'ochre' | 'sage' }) {
  return (
    <div className={`metric ${tone ? `metric--${tone}` : ''}`}>
      <dt>{label}</dt>
      <dd>{value}</dd>
      {note && <p className="metric__note">{note}</p>}
    </div>
  )
}

export function ReportRows({ reports, empty = 'Nothing here.' }: { reports: AuthorityReport[]; empty?: string }) {
  if (!reports.length) return <p className="muted small">{empty}</p>
  return (
    <ul className="rrows">
      {reports.map((r) => (
        <li key={r.id}>
          <Link to={`/command/reports/${r.id}`} className="rrow">
            <span className="rrow__top">
              <span className="id">{r.id}</span>
              <PriorityBadge level={r.priority_level} score={r.priority_score} />
            </span>
            <span className="rrow__headline">{r.headline}</span>
            <span className="rrow__meta">
              <CategoryTag category={r.category} label={r.category_label} />
              <span className="muted small">{r.location_text}</span>
            </span>
            <span className="rrow__foot">
              <StatusPill status={r.status} />
              <span className="muted small">{r.department_label ?? 'Unassigned'} · {timeAgo(r.created_at)}</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  )
}

export function Panel({ title, note, children, className = '', action }: { title: string; note?: ReactNode; children: ReactNode; className?: string; action?: ReactNode }) {
  return (
    <section className={`panel ${className}`}>
      <div className="panel__head"><h3>{title}</h3>{action ?? (note && <span className="panel__note">{note}</span>)}</div>
      <div className="panel__body">{children}</div>
    </section>
  )
}
