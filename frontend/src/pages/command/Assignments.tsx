import { Check, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHead } from '../../components/command'
import { CategoryTag, ErrorState, PriorityBadge, Skeleton, StatusPill, Toast, useToast } from '../../components/ui'
import { api } from '../../lib/api'
import { OPEN } from '../../lib/format'
import type { AuthorityReport, DeptKey } from '../../lib/types'
import { useLiveQuery } from '../../store/live'

export function Assignments() {
  const reports = useLiveQuery(() => api.reports())
  const meta = useLiveQuery(() => api.meta(), [], { live: false })
  const toast = useToast()
  const [busy, setBusy] = useState<string | null>(null)

  if (reports.error) return <ErrorState error={reports.error} onRetry={reports.reload} />
  if (!reports.data || !meta.data) return <div className="cpage"><Skeleton h={480} /></div>
  const open = reports.data.filter((r) => OPEN.includes(r.status)).sort((a, b) => b.priority_score - a.priority_score)
  const unassigned = open.filter((r) => !r.department)
  const depts = Object.entries(meta.data.departments) as [DeptKey, string][]

  const quickAssign = async (r: AuthorityReport) => {
    const dept = meta.data!.category_department[r.category]
    setBusy(r.id)
    try {
      await api.assign(r.id, dept)
      toast.show(`${r.id} assigned to ${meta.data!.departments[dept]}`)
      reports.reload()
    } catch (e) { toast.show((e as Error).message) } finally { setBusy(null) }
  }

  return (
    <div className="cpage">
      <PageHead eyebrow="Act · Assignments" title="Assignments">
        Open work by department. Unassigned reports are listed by priority with the department the engine suggests — one click to accept it.
      </PageHead>

      <section className="queue">
        <h2 className="label">Unassigned · {unassigned.length}</h2>
        {unassigned.length === 0 ? <p className="muted small">Every open report has a department.</p> : (
          <ul className="queue__list">
            {unassigned.map((r) => {
              const d = meta.data!.category_department[r.category]
              return (
                <li key={r.id} className="queue__item">
                  <Link to={`/command/reports/${r.id}`} className="id link-id">{r.id}</Link>
                  <div className="queue__main">
                    <span className="queue__title">{r.headline}</span>
                    <span className="small muted"><CategoryTag category={r.category} label={r.category_label} /> · {r.location_text}</span>
                  </div>
                  <PriorityBadge level={r.priority_level} score={r.priority_score} />
                  <button className="btn btn--ghost btn--sm" disabled={busy === r.id} onClick={() => quickAssign(r)}>
                    {busy === r.id ? <Loader2 className="spin" /> : <Check />}{meta.data!.departments[d]}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <div className="board">
        {depts.map(([k, label]) => {
          const mine = open.filter((r) => r.department === k)
          const officers = meta.data!.officers[k] ?? []
          return (
            <section key={k} className="board__col">
              <header className="board__head">
                <h3>{label}</h3>
                <span className="mono">{mine.length}</span>
              </header>
              <p className="small muted">{mine.filter((r) => r.priority_level === 'critical').length} critical · {mine.filter((r) => r.status === 'in_progress').length} in progress</p>
              <ul className="board__officers">
                {officers.map((o) => <li key={o} className="small"><span>{o}</span><span className="mono">{mine.filter((r) => r.officer === o).length}</span></li>)}
              </ul>
              <ul className="board__cards">
                {mine.map((r) => (
                  <li key={r.id}>
                    <Link to={`/command/reports/${r.id}`} className={`bcard bcard--${r.priority_level}`}>
                      <span className="bcard__top"><span className="id">{r.id}</span><StatusPill status={r.status} /></span>
                      <span className="bcard__title">{r.headline}</span>
                      <span className="small muted">{r.officer ?? 'No officer yet'}</span>
                    </Link>
                  </li>
                ))}
                {mine.length === 0 && <li className="small muted">No open work.</li>}
              </ul>
            </section>
          )
        })}
      </div>
      <Toast message={toast.msg} onDone={toast.clear} />
    </div>
  )
}
