import { ArrowRight, Building2, CalendarDays, CheckCircle2, MapPin, Search } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { CityMap } from '../components/CityMap'
import { CategoryTag, ErrorState, LiveIndicator, PageBanner, PriorityBadge, ScoreBreakdown, Skeleton, StatusPill, Timeline } from '../components/ui'
import { ApiError, api } from '../lib/api'
import { fmtDate, fmtDay, STATUS_LABEL } from '../lib/format'
import type { Status, TrackView } from '../lib/types'
import { useLiveQuery } from '../store/live'

const STEPS: Status[] = ['submitted', 'under_review', 'assigned', 'in_progress', 'resolved']

export function Track() {
  const { id } = useParams()
  const nav = useNavigate()
  const [q, setQ] = useState(id ?? '')
  const [err, setErr] = useState<string | null>(null)

  const go = (e: FormEvent) => {
    e.preventDefault()
    const v = q.trim().toUpperCase()
    if (!/^CP-[A-Z0-9]{6}$/.test(v)) { setErr('IDs look like CP-ABC123 — check and try again.'); return }
    setErr(null)
    nav(`/track/${v}`)
  }

  return (
    <>
    <PageBanner eyebrow="Act · Citizen tracking" title="Track a report">
      <form className="track__search" onSubmit={go} role="search">
        <label htmlFor="tid" className="sr-only">Complaint ID</label>
        <input id="tid" className="input mono" value={q} onChange={(e) => setQ(e.target.value)} placeholder="CP-XXXXXX" autoComplete="off" aria-invalid={!!err} />
        <button className="btn btn--signal"><Search />Track</button>
      </form>
      {err && <p className="error">{err}</p>}
    </PageBanner>
    <div className="track wrap">
      {id ? <TrackDetail id={id} /> : (
        <p className="muted track__empty">Enter the ID you received after reporting. Don’t have one? <Link to="/report">Report an issue</Link>.</p>
      )}
    </div>
    </>
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
  if (!data || (loading && data.id !== id.toUpperCase())) return <div className="stack"><Skeleton h={140} /><Skeleton h={320} /></div>
  return <TrackBody r={data} />
}

function TrackBody({ r }: { r: TrackView }) {
  const rejected = r.status === 'rejected'
  const idx = STEPS.indexOf(r.status)
  return (
    <article className="tracked">
      <div className="tracked__head">
        <div>
          <div className="tracked__id"><span className="id">{r.id}</span><LiveIndicator /></div>
          <h2 className="serif display-3">{r.headline}</h2>
          <div className="tracked__tags">
            <CategoryTag category={r.category} label={r.category_label} />
            <PriorityBadge level={r.priority_level} score={r.priority_score} />
            <StatusPill status={r.status} />
          </div>
        </div>
      </div>

      {rejected ? (
        <div className="notice notice--warn">This report was closed without action. Reason: {r.resolution_note}</div>
      ) : (
        <ol className="progress" aria-label="Progress">
          {STEPS.map((s, i) => (
            <li key={s} className={i < idx ? 'is-done' : i === idx ? 'is-current' : ''} aria-current={i === idx ? 'step' : undefined}>
              <span className="progress__dot">{i < idx || (i === idx && s === 'resolved') ? <CheckCircle2 size={16} /> : null}</span>
              <span className="progress__label">{STATUS_LABEL[s]}</span>
            </li>
          ))}
        </ol>
      )}

      {r.status === 'resolved' && r.resolution_note && (
        <div className="notice notice--ok"><CheckCircle2 /> <div><strong>Resolved{r.resolved_at ? ` on ${fmtDay(r.resolved_at)}` : ''}.</strong> {r.resolution_note}</div></div>
      )}

      <div className="tracked__grid">
        <div className="stack-lg">
          <section className="panel">
            <div className="panel__head"><h3>Progress updates</h3><span className="panel__note">Updates appear here automatically</span></div>
            <div className="panel__body"><Timeline items={r.timeline} /></div>
          </section>
          <section className="panel">
            <div className="panel__head"><h3>Why this priority</h3><span className="panel__note">{r.analysis.priority.reasoning}</span></div>
            <div className="panel__body"><ScoreBreakdown factors={r.analysis.priority.factors} compact /></div>
          </section>
        </div>
        <div className="stack-lg">
          <section className="panel">
            <div className="panel__body">
              <dl className="facts">
                <div><dt><CalendarDays size={15} />Submitted</dt><dd>{fmtDate(r.created_at)}</dd></div>
                <div><dt><MapPin size={15} />Location</dt><dd>{r.location_text}{r.ward ? ` · ${r.ward}` : ''}</dd></div>
                <div><dt><Building2 size={15} />Department</dt><dd>{r.department_label ?? <span className="muted">Not assigned yet · suggested {r.analysis.recommendation.department_label}</span>}{r.officer_assigned ? ' · officer assigned' : ''}</dd></div>
                <div><dt><ArrowRight size={15} />Target response</dt><dd>{r.analysis.recommendation.response_target} <span className="muted small">(suggested)</span></dd></div>
              </dl>
            </div>
          </section>
          <section className="panel">
            <div className="panel__head"><h3>Your report</h3></div>
            <div className="panel__body stack">
              <p>{r.description}</p>
              {r.image_url && <img className="tracked__img" src={r.image_url} alt="Photo attached to the report" />}
            </div>
          </section>
          {r.lat != null && (
            <section className="panel panel--map">
              <CityMap height={240} points={[{ id: r.id, lat: r.lat, lng: r.lng, level: r.priority_level, status: r.status, title: r.location_text }]} scrollZoom={false} fitKey={r.id} />
            </section>
          )}
        </div>
      </div>
    </article>
  )
}
