import { Link } from 'react-router-dom'
import { CityMap } from '../../components/CityMap'
import { PageHead } from '../../components/command'
import { EmptyState, ErrorState, PriorityBadge, Skeleton, StatusPill } from '../../components/ui'
import { api } from '../../lib/api'
import { CATEGORY_META } from '../../lib/constants'
import type { CategoryKey } from '../../lib/types'
import { useLiveQuery } from '../../store/live'

export function Hotspots() {
  const hs = useLiveQuery(() => api.hotspots())
  const reports = useLiveQuery(() => api.reports())
  const byId = new Map((reports.data ?? []).map((r) => [r.id, r]))
  if (hs.error) return <ErrorState error={hs.error} onRetry={hs.reload} />

  return (
    <div className="cpage">
      <PageHead eyebrow="Reveal · Geographic clustering" title="Hotspots">
        DBSCAN over haversine distance: open reports within 350 m of each other, at least 3 per cluster. Ranked by a hotspot score
        (½ × average priority + 8 per critical + 4 per high + 3 per report, max 100). The same calculation feeds the map, dashboard, brief and assistant.
      </PageHead>
      {!hs.data ? <Skeleton h={400} /> : hs.data.length === 0 ? <EmptyState title="No hotspots right now">No group of 3+ open reports lies within 350 m.</EmptyState> : (
        <div className="hotspots">
          {hs.data.map((h) => (
            <article key={h.id} className="hotspot">
              <header className="hotspot__head">
                <span className="serif hotspot__id">{h.id}</span>
                <div>
                  <h2 className="serif hotspot__title">{h.location}</h2>
                  <p className="muted small">{h.ward} · <span className="mono">{h.lat.toFixed(5)}, {h.lng.toFixed(5)}</span> · radius ~{h.radius_m} m · {h.kind === 'recurring' ? 'Recurring problem' : 'Multi-issue block'}</p>
                </div>
                <div className="hotspot__score"><span className="mono small muted">Hotspot score</span><b className="serif">{h.score}</b></div>
              </header>
              <div className="hotspot__body">
                <div className="hotspot__map">
                  <CityMap height={260} scrollZoom={false} hotspots={[h]} fitKey={h.id}
                    points={h.report_ids.map((id) => byId.get(id)).filter(Boolean).map((r) => ({ id: r!.id, lat: r!.lat, lng: r!.lng, level: r!.priority_level, status: r!.status, title: r!.headline, score: r!.priority_score }))} />
                </div>
                <div className="stack">
                  <dl className="hotspot__nums">
                    <div><dt>Reports</dt><dd>{h.count}</dd></div>
                    <div><dt>Critical</dt><dd className={h.critical_count ? 'is-signal' : ''}>{h.critical_count}</dd></div>
                    <div><dt>High</dt><dd>{h.high_count}</dd></div>
                    <div><dt>Avg priority</dt><dd>{h.avg_priority}</dd></div>
                  </dl>
                  <p className="small"><strong>Why flagged:</strong> {h.reason}</p>
                  <p className="small"><strong>Mix:</strong> {Object.entries(h.categories).map(([k, n]) => `${CATEGORY_META[k as CategoryKey].short} ${n}`).join(' · ')}</p>
                  <div className="suggest">
                    <span className="eyebrow">Suggested intervention</span>
                    <p><strong>{h.intervention}</strong></p>
                    <p className="small muted">Lead department: {h.department}</p>
                  </div>
                </div>
                <ul className="hotspot__reports">
                  {h.report_ids.map((id) => {
                    const r = byId.get(id)
                    if (!r) return null
                    return (
                      <li key={id}>
                        <Link to={`/command/reports/${id}`} className="id link-id">{id}</Link>
                        <span className="small hotspot__rh">{r.headline}</span>
                        <PriorityBadge level={r.priority_level} score={r.priority_score} />
                        <StatusPill status={r.status} />
                      </li>
                    )
                  })}
                </ul>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
