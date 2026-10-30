import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Metric, PageHead, Panel } from '../../components/command'
import { ErrorState, Skeleton } from '../../components/ui'
import { api } from '../../lib/api'
import { CHART, LEVEL_COLOR } from '../../lib/constants'
import { fmtHours, STATUS_LABEL } from '../../lib/format'
import { useLiveQuery } from '../../store/live'
import { tooltipStyle } from './Overview'

const STATUS_COLOR: Record<string, string> = {
  submitted: CHART.muted, under_review: CHART.slate, assigned: CHART.ochre, in_progress: CHART.civic, resolved: CHART.sage, rejected: CHART.rule,
}

export function Analytics() {
  const dash = useLiveQuery(() => api.dashboard())
  if (dash.error) return <ErrorState error={dash.error} onRetry={dash.reload} />
  const d = dash.data
  if (!d) return <div className="cpage"><Skeleton h={500} /></div>
  const m = d.metrics
  let cum = 0
  const backlog = d.trend.map((t) => { cum += t.received - t.resolved; return { ...t, net: cum } })
  const status = d.distributions.status.map((s) => ({ ...s, label: STATUS_LABEL[s.key] }))

  return (
    <div className="cpage">
      <PageHead eyebrow="Reveal · Analytics" title="Analytics">Computed live from {m.total} stored reports.</PageHead>
      <dl className="metrics metrics--5">
        <Metric label="Resolution rate" value={`${m.resolution_rate}%`} note="Rejected reports excluded" />
        <Metric label="Avg. time to resolve" value={fmtHours(m.avg_resolution_hours)} note={m.avg_resolution_note ?? `across ${m.resolved} resolved`} />
        <Metric label="Open backlog" value={m.open} />
        <Metric label="Rejected" value={m.rejected} />
        <Metric label="Unassigned open" value={m.unassigned_open} tone={m.unassigned_open ? 'ochre' : undefined} />
      </dl>
      <div className="grid-12">
        <Panel title="Daily reports received" note="Last 21 days" className="span-6">
          <div className="chart" style={{ height: 240 }}>
            <ResponsiveContainer>
              <BarChart data={d.trend} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
                <CartesianGrid stroke={CHART.rule} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: CHART.muted }} interval={3} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: CHART.muted }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(0,0,0,.03)' }} />
                <Bar dataKey="received" name="Received" fill={CHART.signal} radius={[2, 2, 0, 0]} />
                <Bar dataKey="resolved" name="Resolved" fill={CHART.civic} radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel title="Net backlog change" note="Cumulative received − resolved over the window" className="span-6">
          <div className="chart" style={{ height: 240 }}>
            <ResponsiveContainer>
              <LineChart data={backlog} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
                <CartesianGrid stroke={CHART.rule} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: CHART.muted }} interval={3} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: CHART.muted }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Line type="stepAfter" dataKey="net" name="Net change" stroke={CHART.ink} strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel title="Status of all reports" className="span-4">
          <div className="chart" style={{ height: 240 }}>
            <ResponsiveContainer>
              <BarChart data={status} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
                <XAxis type="number" hide allowDecimals={false} />
                <YAxis type="category" dataKey="label" width={100} tick={{ fontSize: 12, fill: CHART.ink }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(0,0,0,.03)' }} />
                <Bar dataKey="count" name="Reports" barSize={14} radius={2}>{status.map((s) => <Cell key={s.key} fill={STATUS_COLOR[s.key]} />)}</Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel title="Open reports by ward" className="span-4">
          <div className="chart" style={{ height: 240 }}>
            <ResponsiveContainer>
              <BarChart data={d.distributions.ward} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
                <XAxis type="number" hide allowDecimals={false} />
                <YAxis type="category" dataKey="ward" width={110} tick={{ fontSize: 12, fill: CHART.ink }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(0,0,0,.03)' }} />
                <Bar dataKey="open" name="Open" fill={CHART.civic} barSize={14} radius={2} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel title="Open by priority" className="span-4">
          <div className="chart" style={{ height: 240 }}>
            <ResponsiveContainer>
              <BarChart data={d.distributions.priority} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
                <XAxis dataKey="label" tick={{ fontSize: 12, fill: CHART.ink }} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: CHART.muted }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(0,0,0,.03)' }} />
                <Bar dataKey="count" name="Open" radius={[2, 2, 0, 0]}>{d.distributions.priority.map((p) => <Cell key={p.key} fill={LEVEL_COLOR[p.key]} />)}</Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel title="Department performance" className="span-12">
          <div className="table-wrap">
            <table className="table table--plain">
              <thead><tr><th>Department</th><th>Open</th><th>In progress</th><th>Critical open</th><th>Resolved</th><th>Officers on open work</th></tr></thead>
              <tbody>{d.workload.map((w) => (
                <tr key={w.key}><td><strong>{w.label}</strong></td><td className="mono">{w.open}</td><td className="mono">{w.in_progress}</td>
                  <td className="mono" style={{ color: w.critical ? 'var(--signal)' : undefined }}>{w.critical}</td><td className="mono">{w.resolved}</td>
                  <td className="small">{w.officers.join(', ') || '—'}</td></tr>
              ))}</tbody>
            </table>
          </div>
        </Panel>
      </div>
    </div>
  )
}
