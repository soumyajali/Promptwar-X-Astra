import { AlertTriangle, Copy, Search, SlidersHorizontal } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { PageHead } from '../../components/command'
import { CategoryTag, EmptyState, ErrorState, PriorityBadge, Skeleton, StatusPill } from '../../components/ui'
import { api } from '../../lib/api'
import { CATEGORY_KEYS, CATEGORY_META } from '../../lib/constants'
import { LEVEL_ORDER, OPEN, STATUS_LABEL, timeAgo } from '../../lib/format'
import type { AuthorityReport, Status } from '../../lib/types'
import { useLiveQuery } from '../../store/live'

const DEPTS: Record<string, string> = { roads: 'Roads and Infrastructure', sanitation: 'Sanitation', water: 'Water and Drainage', electricity: 'Electricity', safety: 'Public Safety', admin: 'General Administration' }
type Sort = 'priority' | 'newest' | 'oldest' | 'updated'

export function Reports() {
  const { data, error, reload } = useLiveQuery(() => api.reports())
  const [params, setParams] = useSearchParams()
  const [q, setQ] = useState(params.get('q') ?? '')
  const cat = params.get('category') ?? ''
  const pri = params.get('priority') ?? ''
  const st = params.get('status') ?? 'open'
  const dept = params.get('department') ?? ''
  const sort = (params.get('sort') ?? 'priority') as Sort
  const review = params.get('review') === '1'

  const set = (k: string, v: string) => {
    const p = new URLSearchParams(params)
    if (v) p.set(k, v); else p.delete(k)
    setParams(p, { replace: true })
  }

  const rows = useMemo(() => {
    let r = data ?? []
    const term = q.trim().toLowerCase()
    if (term) r = r.filter((x) => [x.id, x.description, x.location_text, x.ward ?? '', x.category_label, x.officer ?? ''].join(' ').toLowerCase().includes(term))
    if (cat) r = r.filter((x) => x.category === cat)
    if (pri) r = r.filter((x) => x.priority_level === pri)
    if (st === 'open') r = r.filter((x) => OPEN.includes(x.status))
    else if (st) r = r.filter((x) => x.status === st)
    if (dept === 'none') r = r.filter((x) => !x.department)
    else if (dept) r = r.filter((x) => x.department === dept)
    if (review) r = r.filter((x) => x.needs_review)
    const cmp: Record<Sort, (a: AuthorityReport, b: AuthorityReport) => number> = {
      priority: (a, b) => b.priority_score - a.priority_score,
      newest: (a, b) => b.created_at.localeCompare(a.created_at),
      oldest: (a, b) => a.created_at.localeCompare(b.created_at),
      updated: (a, b) => b.updated_at.localeCompare(a.updated_at),
    }
    return [...r].sort(cmp[sort])
  }, [data, q, cat, pri, st, dept, sort, review])

  return (
    <div className="cpage">
      <PageHead eyebrow="Act · Report management" title="All reports">
        Search, filter and open any report to review its analysis and take action.
      </PageHead>

      <div className="filters" role="search">
        <div className="filters__search">
          <Search aria-hidden />
          <input className="input" placeholder="Search ID, text, location, officer…" value={q} aria-label="Search reports"
            onChange={(e) => { setQ(e.target.value); set('q', e.target.value) }} />
        </div>
        <select className="select" aria-label="Status" value={st} onChange={(e) => set('status', e.target.value)}>
          <option value="open">Open (all active)</option>
          <option value="all">All statuses</option>
          {(Object.keys(STATUS_LABEL) as Status[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
        </select>
        <select className="select" aria-label="Category" value={cat} onChange={(e) => set('category', e.target.value)}>
          <option value="">All categories</option>
          {CATEGORY_KEYS.map((k) => <option key={k} value={k}>{CATEGORY_META[k].label}</option>)}
        </select>
        <select className="select" aria-label="Priority" value={pri} onChange={(e) => set('priority', e.target.value)}>
          <option value="">All priorities</option>
          {LEVEL_ORDER.map((l) => <option key={l} value={l}>{l[0].toUpperCase() + l.slice(1)}</option>)}
        </select>
        <select className="select" aria-label="Department" value={dept} onChange={(e) => set('department', e.target.value)}>
          <option value="">All departments</option>
          <option value="none">Unassigned</option>
          {Object.entries(DEPTS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select className="select" aria-label="Sort" value={sort} onChange={(e) => set('sort', e.target.value)}>
          <option value="priority">Sort: priority</option>
          <option value="newest">Sort: newest</option>
          <option value="oldest">Sort: oldest</option>
          <option value="updated">Sort: recently updated</option>
        </select>
        <label className="toggle"><input type="checkbox" checked={review} onChange={(e) => set('review', e.target.checked ? '1' : '')} />Needs category review</label>
      </div>

      <p className="muted small results-count"><SlidersHorizontal size={14} /> {data ? `${rows.length} of ${data.length} reports` : 'Loading…'}</p>

      {error ? <ErrorState error={error} onRetry={reload} /> : !data ? <Skeleton h={400} /> : rows.length === 0 ? (
        <EmptyState title="No reports match these filters">Try clearing a filter or the search.</EmptyState>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><th>ID</th><th>Report</th><th>Priority</th><th>Status</th><th>Department</th><th>Flags</th><th>Received</th></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td><Link to={`/command/reports/${r.id}`} className="id link-id">{r.id}</Link></td>
                  <td className="table__main">
                    <Link to={`/command/reports/${r.id}`} className="table__headline">{r.headline}</Link>
                    <span className="table__sub"><CategoryTag category={r.category} label={r.category_label} /> <span className="muted">· {r.location_text}</span></span>
                  </td>
                  <td><PriorityBadge level={r.priority_level} score={r.priority_score} /></td>
                  <td><StatusPill status={r.status} /></td>
                  <td className="small">{r.department_label ?? <span className="muted">Unassigned</span>}{r.officer && <div className="muted">{r.officer}</div>}</td>
                  <td className="table__flags">
                    {r.duplicate_likelihood === 'likely' && <span className="flag" title="Likely duplicate of a nearby report"><Copy size={13} />Dup</span>}
                    {r.needs_review && <span className="flag flag--warn" title="Citizen category and AI prediction disagree"><AlertTriangle size={13} />Review</span>}
                    {r.priority_overridden && <span className="flag" title={r.priority_override_reason ?? ''}>Override</span>}
                  </td>
                  <td className="small muted mono">{timeAgo(r.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
