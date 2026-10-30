import { Calculator, Lightbulb, Printer } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHead } from '../../components/command'
import { ErrorState, PriorityBadge, Skeleton, StatusPill } from '../../components/ui'
import { api } from '../../lib/api'
import { fmtDate } from '../../lib/format'
import { useLiveQuery } from '../../store/live'

export function Briefs() {
  const [ward, setWard] = useState('')
  const stats = useLiveQuery(() => api.stats(), [], { live: false })
  const b = useLiveQuery(() => api.brief(ward || undefined), [ward])
  if (b.error) return <ErrorState error={b.error} onRetry={b.reload} />
  const d = b.data
  const c = d?.calculated

  return (
    <div className="cpage brief">
      <PageHead eyebrow="Act · Area-level action brief" title="Action brief"
        actions={<>
          <select className="select" aria-label="Ward" value={ward} onChange={(e) => setWard(e.target.value)}>
            <option value="">All wards</option>
            {stats.data?.wards.map((w) => <option key={w} value={w}>{w}</option>)}
          </select>
          <button className="btn btn--ghost btn--sm" onClick={() => window.print()}><Printer />Print</button>
        </>}>
        Generated from stored reports on demand. <strong>Calculated</strong> sections are facts from the data; <strong>Suggested</strong> sections apply documented rules to those facts.
      </PageHead>

      {!d || !c ? <Skeleton h={600} /> : (
        <article className="brief__doc">
          <header className="brief__mast">
            <div>
              <span className="eyebrow">Ward office brief · {d.scope}</span>
              <h2 className="serif display-3">{c.metrics.open} open reports, {c.metrics.critical_open} critical, {c.hotspots.length} hotspot{c.hotspots.length === 1 ? '' : 's'}.</h2>
            </div>
            <p className="mono small muted">Generated {fmtDate(new Date().toISOString().slice(0, 19))} · {d.generated_from}</p>
          </header>

          <section className="brief__sec brief__sec--suggest">
            <h3 className="brief__label"><Lightbulb />Suggested · intervention order</h3>
            <ol className="order">
              {d.suggested.intervention_order.map((o) => (
                <li key={o.step}>
                  <span className="order__n serif">{o.step}</span>
                  <div className="order__body">
                    <p className="order__target"><span className="badge badge--outline">{o.type === 'hotspot' ? 'Hotspot' : 'Report'}</span> {o.target}</p>
                    <p className="order__action">{o.action}</p>
                    <p className="small muted">{o.department} · respond {o.respond} · score {o.score}</p>
                    <p className="small">{o.why}</p>
                    <p className="small">{o.report_ids.slice(0, 6).map((id) => <Link key={id} className="id link-id" to={`/command/reports/${id}`} style={{ marginRight: 10 }}>{id}</Link>)}</p>
                  </div>
                </li>
              ))}
              {d.suggested.intervention_order.length === 0 && <p className="muted">Nothing urgent in this scope.</p>}
            </ol>
            {d.suggested.notes.length > 0 && <ul className="brief__notes">{d.suggested.notes.map((n, i) => <li key={i}>{n}</li>)}</ul>}
            <p className="small muted">{d.suggested.disclaimer}</p>
          </section>

          <div className="brief__cols">
            <section className="brief__sec">
              <h3 className="brief__label"><Calculator />Calculated · recurring problems</h3>
              <table className="table table--plain">
                <thead><tr><th>Category</th><th>Open</th><th>Linked dup.</th><th>Where</th></tr></thead>
                <tbody>{c.recurring_problems.map((p) => <tr key={p.category}><td>{p.label}</td><td className="mono">{p.open}</td><td className="mono">{p.linked_duplicates}</td><td className="small">{p.top_locations.join('; ')}</td></tr>)}</tbody>
              </table>
            </section>
            <section className="brief__sec">
              <h3 className="brief__label"><Calculator />Calculated · most affected areas</h3>
              <table className="table table--plain">
                <thead><tr><th>Ward</th><th>Open</th><th>Critical</th></tr></thead>
                <tbody>{c.most_affected_areas.map((a) => <tr key={a.ward}><td>{a.ward}</td><td className="mono">{a.open}</td><td className="mono" style={{ color: a.critical ? 'var(--signal)' : undefined }}>{a.critical}</td></tr>)}</tbody>
              </table>
              <h3 className="brief__label" style={{ marginTop: 24 }}><Calculator />Calculated · department workload</h3>
              <table className="table table--plain">
                <thead><tr><th>Department</th><th>Open</th><th>Critical</th></tr></thead>
                <tbody>{c.department_workload.map((w) => <tr key={w.key}><td>{w.label}</td><td className="mono">{w.open}</td><td className="mono">{w.critical}</td></tr>)}</tbody>
              </table>
            </section>
          </div>

          <section className="brief__sec">
            <h3 className="brief__label"><Calculator />Calculated · high-priority reports</h3>
            <div className="table-wrap">
              <table className="table table--plain">
                <thead><tr><th>ID</th><th>Issue</th><th>Location</th><th>Priority</th><th>Status</th><th>Department</th></tr></thead>
                <tbody>{c.high_priority_reports.map((r) => (
                  <tr key={r.id}><td><Link className="id link-id" to={`/command/reports/${r.id}`}>{r.id}</Link></td><td className="small">{r.label}</td><td className="small">{r.location}</td>
                    <td><PriorityBadge level={r.level} score={r.score} /></td><td><StatusPill status={r.status} /></td><td className="small">{r.department ?? <span className="muted">Unassigned</span>}</td></tr>
                ))}</tbody>
              </table>
            </div>
          </section>

          <section className="brief__sec">
            <h3 className="brief__label"><Calculator />Calculated · geographic insights</h3>
            <div className="brief__hs">
              {c.hotspots.map((h) => (
                <div key={h.id} className="brief__h">
                  <span className="serif">{h.id}</span>
                  <div><strong>{h.location}</strong><p className="small muted">{h.reason}</p></div>
                </div>
              ))}
              {c.hotspots.length === 0 && <p className="muted small">No hotspots in this scope.</p>}
            </div>
          </section>
        </article>
      )}
    </div>
  )
}
