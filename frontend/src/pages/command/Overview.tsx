import { ArrowUpRight, CircleCheck, ClipboardList, FileText, Inbox, Lightbulb, TriangleAlert } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Card, Donut, DonutLegend, Ring, StatTile } from '../../components/obs'
import { ErrorState, Skeleton, StatusPill } from '../../components/ui'
import { api } from '../../lib/api'
import { CATEGORY_COLOR, CATEGORY_META, CHART, LEVEL_COLOR } from '../../lib/constants'
import { fmtHours, timeAgo } from '../../lib/format'
import { useLiveQuery } from '../../store/live'

export const tooltipStyle = { background: '#172D24', border: '1px solid #294238', borderRadius: 8, fontSize: 13, color: '#F0EBDD' }

/** Week-over-week change, shown only when the previous week has data to compare against. */
function Delta({ now, prev, label = 'vs previous 7 days', invert = false }: { now: number; prev: number; label?: string; invert?: boolean }) {
  if (!prev) return <span className="delta">{now} in the last 7 days</span>
  const pct = Math.round(((now - prev) / prev) * 100)
  const up = pct >= 0
  const good = invert ? !up : up
  return <span className={`delta ${good ? 'delta--good' : 'delta--bad'}`}>{up ? '▲' : '▼'} {Math.abs(pct)}% <span>{label}</span></span>
}

export function Overview() {
  const dash = useLiveQuery(() => api.dashboard())
  const reports = useLiveQuery(() => api.reports())
  const nav = useNavigate()
  if (dash.error) return <ErrorState error={dash.error} onRetry={dash.reload} />
  const d = dash.data
  const rs = reports.data ?? []
  const byId = new Map(rs.map((r) => [r.id, r]))
  const m = d?.metrics
  const catData = (d?.distributions.category ?? []).filter((c) => c.open).sort((a, b) => b.open - a.open)
    .map((c) => ({ key: c.key, label: CATEGORY_META[c.key].label, value: c.open, color: CATEGORY_COLOR[c.key] }))
  const priData = (d?.distributions.priority ?? []).map((p) => ({ key: p.key, label: p.label, value: p.count, color: LEVEL_COLOR[p.key] }))
  const wl = (d?.workload ?? []).filter((w) => w.open || w.resolved)
  const wlMax = Math.max(1, ...wl.map((w) => w.open))
  const wlTotal = wl.reduce((a, w) => a + w.open, 0) || 1

  return (
    <div className="cpage ops">
      <header className="ops__head">
        <div>
          <h1 className="serif cpage__title">City Operations Center</h1>
          <p className="cpage__lede">Live figures calculated from the report database on every change.</p>
        </div>
        <Link to="/command/briefs" className="btn btn--signal btn--sm"><FileText />Open action brief</Link>
      </header>

      <section className="ops__stats">
        {m && d ? (
          <>
            <StatTile icon={ClipboardList} label="Total reports" value={m.total}><Delta now={d.week.received[0]} prev={d.week.received[1]} label="received vs prior week" /></StatTile>
            <StatTile icon={Inbox} label="Open reports" value={m.open} note={`${m.unassigned_open} unassigned`} />
            <StatTile icon={TriangleAlert} label="Critical reports" value={m.critical_open} tone="critical"><Delta now={d.week.critical[0]} prev={d.week.critical[1]} label="new critical vs prior week" invert /></StatTile>
            <StatTile icon={CircleCheck} label="Resolved reports" value={m.resolved} tone="ok" note={`Avg. ${fmtHours(m.avg_resolution_hours)} to resolve`} />
            <div className="stat stat--ring">
              <Ring value={m.resolution_rate} size={62}><b className="mono ring__v">{Math.round(m.resolution_rate)}%</b></Ring>
              <div className="stat__body"><span className="stat__label">Resolution rate</span><span className="stat__value">{m.resolved} / {m.resolved + m.open}</span><span className="stat__note">resolved of resolved + open</span></div>
            </div>
          </>
        ) : Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} h={92} />)}
      </section>

      <section className="ops__row3">
        <Card title="Reports trend" sub="Received and resolved per day · last 21 days" action={<span className="legend-inline"><i style={{ background: CHART.amber }} />Received <i style={{ background: CHART.civic }} />Resolved</span>}>
          {d ? (
            <div className="chart" style={{ height: 230 }}>
              <ResponsiveContainer>
                <AreaChart data={d.trend} margin={{ top: 8, right: 12, left: -26, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gRec" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={CHART.amber} stopOpacity={.35} /><stop offset="100%" stopColor={CHART.amber} stopOpacity={0} /></linearGradient>
                    <linearGradient id="gRes" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={CHART.civic} stopOpacity={.3} /><stop offset="100%" stopColor={CHART.civic} stopOpacity={0} /></linearGradient>
                  </defs>
                  <CartesianGrid stroke={CHART.rule} vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: CHART.muted }} interval={3} tickLine={false} axisLine={{ stroke: CHART.rule }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: CHART.muted }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Area type="monotone" dataKey="received" name="Received" stroke={CHART.amber} fill="url(#gRec)" strokeWidth={2} />
                  <Area type="monotone" dataKey="resolved" name="Resolved" stroke={CHART.civic} fill="url(#gRes)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : <Skeleton h={230} />}
        </Card>
        <Card title="Category distribution" sub="Open reports">
          {d ? <div className="donut-row"><Donut data={catData} label="Open" /><DonutLegend data={catData} /></div> : <Skeleton h={180} />}
        </Card>
        <Card title="Priority distribution" sub="Open reports">
          {d ? <div className="donut-row"><Donut data={priData} label="Open" /><DonutLegend data={priData} /></div> : <Skeleton h={180} />}
        </Card>
      </section>

      <section className="ops__row3 ops__row3--b">
        <Card title="Recent reports" action={<Link to="/command/reports" className="small link-id">View all</Link>} pad={false}>
          <div className="table-wrap table-wrap--flat">
            <table className="table table--ops">
              <thead><tr><th>ID</th><th>Issue</th><th className="hide-md hide-lg">Location</th><th>Priority</th><th>Status</th><th className="hide-md">Time</th></tr></thead>
              <tbody>
                {rs.slice(0, 6).map((r) => {
                  const Icon = CATEGORY_META[r.category].icon
                  return (
                    <tr key={r.id} onClick={() => nav(`/command/reports/${r.id}`)} className="is-click">
                      <td><Link to={`/command/reports/${r.id}`} className="id link-id" onClick={(e) => e.stopPropagation()}>{r.id}</Link></td>
                      <td><span className="cell-cat"><span className={`sev sev--${r.priority_level}`}><Icon aria-hidden /></span>{CATEGORY_META[r.category].short}</span></td>
                      <td className="hide-md hide-lg muted small cell-trunc">{r.location_text}</td>
                      <td><span className={`lvl lvl--${r.priority_level}`}>{r.priority_level[0].toUpperCase() + r.priority_level.slice(1)}</span></td>
                      <td><StatusPill status={r.status} /></td>
                      <td className="hide-md mono small muted nowrap">{timeAgo(r.created_at)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
        <Card title="Critical issues" sub="Open · highest score first">
          <ul className="crit-list">
            {(d?.critical_ids ?? []).map((id) => byId.get(id)).filter(Boolean).slice(0, 5).map((r) => {
              const Icon = CATEGORY_META[r!.category].icon
              return (
                <li key={r!.id}>
                  <Link to={`/command/reports/${r!.id}`} className="crit-item">
                    <span className="sev sev--critical"><Icon aria-hidden /></span>
                    <span className="crit-item__main"><b>{CATEGORY_META[r!.category].short} · {r!.location_text}</b><span className="muted small">{r!.department_label ?? 'Unassigned'} · score {r!.priority_score}</span></span>
                    <span className="mono small muted nowrap">{timeAgo(r!.created_at)}</span>
                  </Link>
                </li>
              )
            })}
            {d && d.critical_ids.length === 0 && <li className="muted small">No open critical reports.</li>}
          </ul>
        </Card>
        <Card title="Department workload" sub="Open assigned reports">
          <ul className="wl-list">
            {wl.map((w) => (
              <li key={w.key}>
                <span className="wl-list__name">{w.label}</span>
                <span className="wl-list__bar"><i style={{ width: `${(w.open / wlMax) * 100}%`, background: w.critical ? CHART.signal : CHART.amber }} /></span>
                <b className="mono">{w.open}</b>
                <em className="mono">{Math.round((w.open / wlTotal) * 100)}%</em>
              </li>
            ))}
          </ul>
          {m && <p className="card__foot muted small">{m.unassigned_open} open reports have no department yet. Red bars hold a critical report.</p>}
        </Card>
      </section>

      <section className="ops__row2">
        <Card title="Geographic hotspots" sub="DBSCAN · 350 m · ≥ 3 open reports" action={<Link to="/command/map" className="small link-id">Open map <ArrowUpRight size={13} /></Link>}>
          <ol className="hs-rank">
            {d?.hotspots.map((h) => (
              <li key={h.id}>
                <span className="hs-rank__id serif">{h.id}</span>
                <div className="hs-rank__main"><b>{h.location}</b><span className="muted small">{h.ward} · mostly {h.dominant_label.toLowerCase()}</span></div>
                <span className="hs-rank__nums mono"><b>{h.count}</b> reports · <b className={h.critical_count ? 'is-crit' : ''}>{h.critical_count}</b> critical</span>
                <span className="hs-rank__bar"><i style={{ width: `${h.score}%` }} /></span>
              </li>
            ))}
          </ol>
        </Card>
        <Card title="AI-generated insights" sub="Rules applied to the figures above">
          <ul className="insights">
            {d?.insights.map((i, k) => (
              <li key={k}>
                <Lightbulb aria-hidden />
                <div>
                  <strong>{i.title}</strong>
                  <p className="small muted">{i.detail}</p>
                  {i.evidence.length > 0 && <p className="small">{i.evidence.map((id) => id.startsWith('CP-') ? <Link key={id} to={`/command/reports/${id}`} className="id link-id" style={{ marginRight: 8 }}>{id}</Link> : null)}</p>}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </section>
    </div>
  )
}
