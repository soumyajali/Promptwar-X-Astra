import { ArrowUpRight, Lightbulb } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { CityMap } from '../../components/CityMap'
import { Metric, PageHead, Panel, ReportRows } from '../../components/command'
import { ErrorState, Skeleton } from '../../components/ui'
import { api } from '../../lib/api'
import { CHART, LEVEL_COLOR } from '../../lib/constants'
import { fmtHours } from '../../lib/format'
import { useLiveQuery } from '../../store/live'

export const tooltipStyle = { background: '#FAF8F3', border: '1px solid #D6CEBD', borderRadius: 8, fontSize: 13 }

export function Overview() {
  const dash = useLiveQuery(() => api.dashboard())
  const reports = useLiveQuery(() => api.reports())
  if (dash.error) return <ErrorState error={dash.error} onRetry={dash.reload} />
  const d = dash.data
  const rs = reports.data ?? []
  const byId = new Map(rs.map((r) => [r.id, r]))
  const m = d?.metrics

  return (
    <div className="cpage">
      <PageHead eyebrow="Reveal · Overview" title="Today in Demo City"
        actions={<Link to="/command/briefs" className="btn btn--civic btn--sm">Open action brief <ArrowUpRight /></Link>}>
        Every figure below is calculated from the database on each change. Nothing is pre-filled.
      </PageHead>

      <dl className="metrics">
        {m ? (
          <>
            <Metric label="Total reports" value={m.total} />
            <Metric label="Open" value={m.open} note={`${m.unassigned_open} unassigned`} />
            <Metric label="Critical · open" value={m.critical_open} tone="signal" />
            <Metric label="High · open" value={m.high_open} tone="ochre" />
            <Metric label="Resolved" value={m.resolved} tone="sage" />
            <Metric label="Resolution rate" value={`${m.resolution_rate}%`} note="resolved ÷ (resolved + open)" />
            <Metric label="Avg. resolution" value={fmtHours(m.avg_resolution_hours)} note={m.avg_resolution_note ?? `${m.resolved} resolved reports`} />
            <Metric label="Linked duplicates" value={m.linked_duplicates} />
          </>
        ) : Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} h={86} />)}
      </dl>

      <div className="grid-12">
        <Panel title="Reports received vs resolved" note="Last 21 days" className="span-8">
          {d ? (
            <div className="chart" style={{ height: 240 }}>
              <ResponsiveContainer>
                <AreaChart data={d.trend} margin={{ top: 8, right: 20, left: -24, bottom: 0 }}>
                  <CartesianGrid stroke={CHART.rule} strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: CHART.muted }} interval={3} tickLine={false} axisLine={{ stroke: CHART.rule }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: CHART.muted }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Area type="monotone" dataKey="received" name="Received" stroke={CHART.signal} fill={CHART.signal} fillOpacity={.12} strokeWidth={2} />
                  <Area type="monotone" dataKey="resolved" name="Resolved" stroke={CHART.civic} fill={CHART.civic} fillOpacity={.12} strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : <Skeleton h={240} />}
        </Panel>

        <Panel title="Open by priority" className="span-4">
          {d ? (
            <div className="prio-stack">
              <div className="prio-bar" role="img" aria-label="Open reports by priority">
                {d.distributions.priority.map((p) => p.count > 0 && (
                  <span key={p.key} style={{ flex: p.count, background: LEVEL_COLOR[p.key] }} title={`${p.label}: ${p.count}`} />
                ))}
              </div>
              <ul className="prio-legend">
                {d.distributions.priority.map((p) => (
                  <li key={p.key}><i style={{ background: LEVEL_COLOR[p.key] }} />{p.label}<b className="mono">{p.count}</b></li>
                ))}
              </ul>
            </div>
          ) : <Skeleton h={160} />}
        </Panel>

        <Panel title="Critical issues" note="Open · highest score first" className="span-5">
          <ReportRows reports={(d?.critical_ids ?? []).map((id) => byId.get(id)!).filter(Boolean).slice(0, 5)} empty="No open critical reports." />
        </Panel>

        <Panel title="Geographic hotspots" className="span-7" action={<Link to="/command/hotspots" className="small link-id">All hotspots</Link>}>
          <div className="hs-overview">
            <div className="hs-overview__map">
              {d && <CityMap height={280} scrollZoom={false} hotspots={d.hotspots}
                points={rs.filter((r) => r.status !== 'resolved' && r.status !== 'rejected').map((r) => ({ id: r.id, lat: r.lat, lng: r.lng, level: r.priority_level, status: r.status, title: r.headline, score: r.priority_score }))} />}
            </div>
            <ol className="hs-mini">
              {d?.hotspots.slice(0, 4).map((h) => (
                <li key={h.id}>
                  <span className="serif hs-mini__id">{h.id}</span>
                  <div><strong>{h.location}</strong><p className="muted small">{h.count} reports · {h.critical_count} critical · {h.dominant_label}</p></div>
                </li>
              ))}
            </ol>
          </div>
        </Panel>

        <Panel title="Category distribution" note="Total · open (dark)" className="span-6">
          {d ? (
            <div className="chart" style={{ height: 260 }}>
              <ResponsiveContainer>
                <BarChart data={d.distributions.category} layout="vertical" margin={{ top: 0, right: 16, left: 8, bottom: 0 }} barGap={-14}>
                  <XAxis type="number" hide allowDecimals={false} />
                  <YAxis type="category" dataKey="label" width={150} tick={{ fontSize: 12, fill: CHART.ink }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(0,0,0,.03)' }} />
                  <Bar dataKey="total" name="Total" fill={CHART.rule} barSize={14} radius={2} />
                  <Bar dataKey="open" name="Open" fill={CHART.ink} barSize={14} radius={2} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : <Skeleton h={260} />}
        </Panel>

        <Panel title="Department workload" note="Open assigned reports" className="span-6">
          {d ? (
            <div className="chart" style={{ height: 260 }}>
              <ResponsiveContainer>
                <BarChart data={d.workload} layout="vertical" margin={{ top: 0, right: 16, left: 8, bottom: 0 }}>
                  <XAxis type="number" hide allowDecimals={false} />
                  <YAxis type="category" dataKey="label" width={170} tick={{ fontSize: 12, fill: CHART.ink }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(0,0,0,.03)' }} />
                  <Bar dataKey="open" name="Open" barSize={14} radius={2}>
                    {d.workload.map((w) => <Cell key={w.key} fill={w.critical ? CHART.signal : CHART.civic} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : <Skeleton h={260} />}
          <p className="panel__note">Bars in vermilion hold at least one critical report.</p>
        </Panel>

        <Panel title="Insights" note="Derived from the figures above" className="span-5">
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
        </Panel>

        <Panel title="Recent reports" className="span-7" action={<Link to="/command/reports" className="small link-id">All reports</Link>}>
          <ReportRows reports={rs.slice(0, 5)} />
        </Panel>
      </div>
    </div>
  )
}
