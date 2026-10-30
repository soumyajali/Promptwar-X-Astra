import { Building2, CalendarDays, CheckCircle2, MapPin, Search, Timer, UserRound } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { CityMap } from '../components/CityMap'
import { Card, StepTrack } from '../components/obs'
import { CategoryTag, ErrorState, LiveIndicator, PriorityBadge, ScoreBreakdown, Skeleton, StatusPill, Timeline } from '../components/ui'
import { ApiError, api } from '../lib/api'
import { fmtDate, fmtDay } from '../lib/format'
import type { Status, TrackView } from '../lib/types'
import { useLiveQuery } from '../store/live'

export function Track() {
  const { id } = useParams()
  const nav = useNavigate()
  const [q, setQ] = useState(id ?? '')
  const [err, setErr] = useState<string | null>(null)

  const go = (e: FormEvent) => {
    e.preventDefault()
    const v = q.trim().toUpperCase()
    if (!/^CP-[A-Z0-9]{6}$/.test(v)) { setErr('IDs look like CP-ABC123. Check the ID and try again.'); return }
    setErr(null)
    nav(`/track/${v}`)
  }

  return (
    <div className="otrack wrap">
      <header className="otrack__head">
        <h1 className="serif">Track your report</h1>
        <p>Enter your report ID to see the latest status and updates.</p>
        <form className="otrack__search" onSubmit={go} role="search">
          <label htmlFor="tid" className="sr-only">Report ID</label>
          <Search aria-hidden />
          <input id="tid" className="input mono" value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. CP-S794U7" autoComplete="off" aria-invalid={!!err} />
          <button className="btn btn--signal">Track</button>
        </form>
        {err && <p className="error">{err}</p>}
      </header>
      {id ? <TrackDetail id={id} /> : (
        <p className="muted track__empty">Enter the ID you received after reporting. Don’t have one? <Link to="/report">Report an issue</Link>.</p>
      )}
    </div>
  )
}

function TrackDetail({ id }: { id: string }) {
  const { data, error, loading, reload } = useLiveQuery(() => api.track(id), [id])
  if (error) {
    if (error instanceof ApiError && error.status === 404) {
      return <div className="state"><h4>No report found</h4><p className="muted">{error.message}</p></div>
    }
    return <ErrorState error={error} onRetry={reload} />
  }
  if (!data || (loading && data.id !== id.toUpperCase())) return <div className="stack"><Skeleton h={220} /><Skeleton h={320} /></div>
  return <TrackBody r={data} />
}

function TrackBody({ r }: { r: TrackView }) {
  // When each stage was reached, from the report's own public timeline (first entry per status).
  const reachedAt: Partial<Record<Status, string>> = {}
  for (const t of r.timeline) if (t.status && !reachedAt[t.status]) reachedAt[t.status] = t.created_at
  if (r.department && !reachedAt.assigned) {
    const a = r.timeline.find((t) => t.kind === 'assignment')
    if (a) reachedAt.assigned = a.created_at
  }
  const a = r.analysis
  return (
    <article className="otrack__body">
      <section className="tcard">
        {r.image_url
          ? <img className="tcard__img" src={r.image_url} alt="Photo attached to the report" />
          : <div className="tcard__img tcard__img--none" aria-hidden><MapPin /></div>}
        <div className="tcard__main">
          <div className="tcard__ids"><span className="id">{r.id}</span><PriorityBadge level={r.priority_level} score={r.priority_score} /><LiveIndicator /></div>
          <h2 className="tcard__title">{r.headline}</h2>
          <p className="tcard__desc">{r.description}</p>
          <CategoryTag category={r.category} label={r.category_label} />
        </div>
        <dl className="tcard__facts">
          <div className="tcard__status"><dt>Status</dt><dd><StatusPill status={r.status} /></dd></div>
          <div><dt><CalendarDays size={14} />Submitted</dt><dd className="mono">{fmtDate(r.created_at)}</dd></div>
          <div><dt><Building2 size={14} />Department</dt><dd>{r.department_label ?? <span className="muted">Not yet · suggested {a.recommendation.department_label}</span>}</dd></div>
          <div><dt><UserRound size={14} />Officer</dt><dd>{r.officer ?? <span className="muted">Not assigned yet</span>}</dd></div>
          <div><dt><MapPin size={14} />Location</dt><dd>{r.location_text}{r.ward ? `, ${r.ward}` : ''}</dd></div>
          <div><dt><Timer size={14} />Target response</dt><dd>{a.recommendation.response_target} <span className="muted">(suggested)</span></dd></div>
        </dl>
      </section>

      {r.status === 'rejected'
        ? <div className="notice notice--warn">This report was closed without action. Reason: {r.resolution_note}</div>
        : <section className="tsteps"><StepTrack status={r.status} reachedAt={reachedAt} fmt={fmtDate} /></section>}

      {r.status === 'resolved' && r.resolution_note && (
        <div className="notice notice--ok"><CheckCircle2 /> <div><strong>Resolved{r.resolved_at ? ` on ${fmtDay(r.resolved_at)}` : ''}.</strong> {r.resolution_note}</div></div>
      )}

      <div className="otrack__grid">
        <Card title="Progress updates" sub="Updates appear here automatically">
          <Timeline items={r.timeline} />
        </Card>
        <Card title="Why this priority" sub={a.priority.reasoning}>
          <ScoreBreakdown factors={a.priority.factors} />
        </Card>
        {r.lat != null ? (
          <Card title="Location" sub={<span className="mono">{r.lat.toFixed(5)}, {r.lng!.toFixed(5)}</span>} pad={false} className="otrack__map">
            <CityMap height={320} points={[{ id: r.id, lat: r.lat, lng: r.lng, level: r.priority_level, status: r.status, title: r.location_text }]} scrollZoom={false} fitKey={r.id} />
          </Card>
        ) : (
          <Card title="Location"><p className="muted">No map pin was added to this report.</p></Card>
        )}
        <Card title="Classification" sub="Deterministic text classifier">
          <div className="stack">
            <p className="small">{a.classification.resolution?.message}</p>
            <p className="muted small">{a.classification.explanation}</p>
          </div>
        </Card>
      </div>
    </article>
  )
}
