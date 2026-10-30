import { ArrowRight, Bot, Cpu, Siren, Sparkles } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Card, Ring } from '../../components/obs'
import { CategoryTag, EmptyState, ErrorState, PriorityBadge, Skeleton, StatusPill } from '../../components/ui'
import { api } from '../../lib/api'
import { CATEGORY_META } from '../../lib/constants'
import { distance, pct } from '../../lib/format'
import type { Preview } from '../../lib/types'
import { useLiveQuery } from '../../store/live'

const WEIGHTS = [
  ['Safety risk', 25, 'Hazard phrases (live wire, open manhole, gas leak, assault…) each with a risk weight, or the category’s baseline risk.'],
  ['Severity', 20, 'Severity phrases (knee deep, burst, completely blocked…). A detected hazard implies severity of at least 0.6 × its risk.'],
  ['Urgency', 15, 'Urgency phrases (emergency, getting worse…) and stated duration; a week or more unresolved scores fully.'],
  ['Public impact', 15, 'Affected groups (school, hospital, bus stand, market…) and the number of people stated by the citizen (500+ = full).'],
  ['Recurring reports', 15, '0.25 per linked similar report + 0.15 per same-category report within 300 m in 60 days.'],
  ['Geographic concentration', 10, 'Open reports of any kind within 400 m in the last 14 days (5+ = full).'],
] as const

type Tab = 'analysis' | 'duplicates' | 'scoring' | 'actions' | 'brief'
const TABS: [Tab, string][] = [['analysis', 'Report analysis'], ['duplicates', 'Duplicate detection'], ['scoring', 'Priority scoring'], ['actions', 'Action recommendations'], ['brief', 'Area brief']]

const EngineTag = () => (
  <span className="engine-tag" title="Produced by documented, deterministic algorithms in backend/app/services. No language model is involved.">
    <Cpu size={13} />Local deterministic engine
  </span>
)

export function Intelligence() {
  const [params, setParams] = useSearchParams()
  const tab = (params.get('tab') as Tab) || 'analysis'
  const setTab = (t: Tab) => { const p = new URLSearchParams(params); p.set('tab', t); setParams(p, { replace: true }) }
  const reports = useLiveQuery(() => api.reports())

  return (
    <div className="cpage aiw">
      <header className="ops__head">
        <div>
          <h1 className="serif cpage__title">AI Intelligence</h1>
          <p className="cpage__lede">Every result here is computed by documented, deterministic algorithms and shows the evidence behind it. The optional language model is used only to phrase assistant answers.</p>
        </div>
        <EngineTag />
      </header>
      <nav className="aiw__tabs" role="tablist" aria-label="Intelligence views">
        {TABS.map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'is-on' : ''} onClick={() => setTab(k)}>{l}</button>)}
      </nav>
      {reports.error ? <ErrorState error={reports.error} onRetry={reports.reload} /> : !reports.data ? <Skeleton h={480} /> : (
        <>
          {tab === 'analysis' && <AnalysisTab ids={reports.data.slice().sort((a, b) => b.priority_score - a.priority_score).map((r) => ({ id: r.id, label: `${r.id} · ${r.headline}` }))} initial={params.get('id')} onPick={(id) => { const p = new URLSearchParams(params); p.set('id', id); setParams(p, { replace: true }) }} />}
          {tab === 'duplicates' && <DuplicatesTab reports={reports.data} />}
          {tab === 'scoring' && <ScoringTab reports={reports.data} />}
          {tab === 'actions' && <ActionsTab />}
          {tab === 'brief' && <BriefTab />}
        </>
      )}
    </div>
  )
}

function AnalysisTab({ ids, initial, onPick }: { ids: { id: string; label: string }[]; initial: string | null; onPick: (id: string) => void }) {
  const id = initial && ids.some((x) => x.id === initial) ? initial : ids[0]?.id
  const q = useLiveQuery(() => (id ? api.report(id) : Promise.reject(new Error('No reports yet'))), [id])
  const [text, setText] = useState('Live wire hanging near the school gate and sparking after the rain, children walk here every morning')
  const [pv, setPv] = useState<Preview | null>(null)
  useEffect(() => {
    if (text.trim().length < 12) { setPv(null); return }
    const t = setTimeout(() => api.preview(text).then(setPv).catch(() => setPv(null)), 350)
    return () => clearTimeout(t)
  }, [text])
  if (!id) return <EmptyState title="No reports yet" />
  const r = q.data && q.data.id === id ? q.data : null
  const a = r?.analysis

  return (
    <div className="aiw__grid">
      <Card title="AI analysis" className="aiw__main" action={
        <select className="select aiw__pick" aria-label="Report to analyse" value={id} onChange={(e) => onPick(e.target.value)}>
          {ids.map((x) => <option key={x.id} value={x.id}>{x.label.length > 70 ? x.label.slice(0, 70) + '…' : x.label}</option>)}
        </select>
      }>
        {q.error ? <ErrorState error={q.error} onRetry={q.reload} /> : !r || !a ? <Skeleton h={300} /> : (
          <div className="aiw__analysis">
            <div className="aiw__rhead">
              <span className="id">{r.id}</span><PriorityBadge level={r.priority_level} score={r.priority_score} /><StatusPill status={r.status} />
              <Link to={`/command/reports/${r.id}`} className="small link-id">Open report</Link>
            </div>
            <section>
              <h4>Category</h4>
              <p><CategoryTag category={r.category} label={r.category_label} /> <span className="mono muted small">({pct(a.classification.confidence)} confidence)</span></p>
              <p className="muted small">{a.classification.explanation}</p>
              {a.classification.alternative_label && <p className="small">Alternative: {a.classification.alternative_label} ({pct(a.classification.alternative_confidence ?? 0)})</p>}
            </section>
            <section>
              <h4>Summary</h4>
              <p className="aiw__summary">{a.summary.text}</p>
              <div className="signals">
                {a.signals.hazards.map((h) => <span key={h} className="badge badge--critical">{h}</span>)}
                {a.signals.affected.map((h) => <span key={h} className="badge badge--outline">{h}</span>)}
              </div>
            </section>
          </div>
        )}
      </Card>

      <Card title="Duplicate detection" sub="0.40 text + 0.20 category + 0.30 distance + 0.10 time">
        {!r || !a ? <Skeleton h={200} /> : (() => {
          const top = r.links[0]
          return (
            <div className="stack">
              <div className="aiw__dupbig"><b className="mono">{top ? pct(top.score) : '0%'}</b><span>{top ? 'highest similarity' : 'no similar reports'}</span></div>
              <p className="small muted">{r.links.length} similar report{r.links.length === 1 ? '' : 's'} linked within 500 m and 14 days. Reports are linked, never deleted.</p>
              <ul className="aiw__dups">
                {r.links.slice(0, 4).map((l) => (
                  <li key={l.id}><Link to={`/command/reports/${l.id}`} className="id link-id">{l.id}</Link><span className="mono">{pct(l.score)}</span><span className="muted small">{distance(l.distance_m)}</span></li>
                ))}
              </ul>
            </div>
          )
        })()}
      </Card>

      <Card title="Priority score" sub="Six weighted factors">
        {!r || !a ? <Skeleton h={200} /> : (
          <div className="aiw__prio">
            <Ring value={r.priority_score} size={120} stroke={11} color={r.priority_level === 'critical' ? 'var(--signal)' : r.priority_level === 'high' ? 'var(--orange)' : r.priority_level === 'medium' ? 'var(--amber)' : 'var(--civic)'}>
              <b className="mono aiw__score">{r.priority_score}<small>/100</small></b>
            </Ring>
            <span className={`lvl lvl--${r.priority_level}`}>{r.priority_level[0].toUpperCase() + r.priority_level.slice(1)} priority</span>
            <ul className="aiw__factors">
              {a.priority.factors.map((f) => <li key={f.key}><span>{f.label}</span><b className="mono">{Math.round(f.points)}<small>/{f.weight}</small></b></li>)}
            </ul>
          </div>
        )}
      </Card>

      <Card title="Recommended action" className="aiw__rec">
        {!r || !a ? <Skeleton h={80} /> : (
          <div className="aiw__recrow">
            <Siren aria-hidden />
            <div>
              <p><b>{a.recommendation.primary.action}</b></p>
              <p className="muted small">{a.recommendation.primary.why} Suggested department: {a.recommendation.department_label} · respond {a.recommendation.response_target}.</p>
            </div>
            <Link to={`/command/reports/${r.id}`} className="btn btn--ghost btn--sm">View full analysis <ArrowRight /></Link>
          </div>
        )}
      </Card>

      <Card title="Try the classifier" sub="Uses the same endpoint as the citizen form · nothing is saved" className="aiw__try">
        <textarea className="textarea" aria-label="Test complaint text" value={text} onChange={(e) => setText(e.target.value)} />
        {pv?.ready && (
          <div className="ai-hint" style={{ marginTop: 12 }}>
            <Sparkles aria-hidden />
            <div>
              <strong>{pv.label}</strong> <span className="mono">{pct(pv.confidence ?? 0)}</span>{pv.needs_review && <span className="badge badge--high" style={{ marginLeft: 8 }}>below review threshold</span>}
              <div className="small muted">Evidence: {pv.evidence?.join(', ') || 'none'}</div>
              {!!pv.hazards?.length && <div className="small">Hazards: {pv.hazards.join(', ')}</div>}
              {!!pv.affected?.length && <div className="small">Affected: {pv.affected.join(', ')}</div>}
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}

function DuplicatesTab({ reports }: { reports: import('../../lib/types').AuthorityReport[] }) {
  const groups = useMemo(() => {
    const g = new Map<string, string[]>()
    for (const r of reports) if (r.primary_report_id) g.set(r.primary_report_id, [...(g.get(r.primary_report_id) ?? []), r.id])
    return [...g.entries()].sort((a, b) => b[1].length - a[1].length)
  }, [reports])
  const byId = new Map(reports.map((r) => [r.id, r]))
  return (
    <div className="aiw__cards">
      <Card title="How duplicates are found">
        <ol className="pipeline">
          <li><b>Text</b>: TF-IDF of words and word pairs, cosine similarity (40%).</li>
          <li><b>Category</b>: same 1.0, related 0.5 (e.g. waterlogging and drainage) (20%).</li>
          <li><b>Distance</b>: 1 − metres / 500 (30%).</li>
          <li><b>Time</b>: 1 − days / 14 (10%).</li>
          <li>Likely ≥ 0.70, or ≥ 0.60 when same category, within 150 m and with some shared wording.</li>
        </ol>
      </Card>
      {groups.length === 0 ? <EmptyState title="No linked duplicates yet" /> : groups.map(([primary, ids]) => {
        const p = byId.get(primary)
        return (
          <Card key={primary} title={<>Group <Link to={`/command/reports/${primary}`} className="id link-id">{primary}</Link></>} sub={p ? `${CATEGORY_META[p.category].label} · ${p.location_text}` : undefined}>
            <ul className="aiw__dups">
              {ids.map((id) => { const r = byId.get(id); return r ? <li key={id}><Link to={`/command/reports/${id}`} className="id link-id">{id}</Link><span className="small aiw__trunc">{r.headline}</span><StatusPill status={r.status} /></li> : null })}
            </ul>
          </Card>
        )
      })}
    </div>
  )
}

function ScoringTab({ reports }: { reports: import('../../lib/types').AuthorityReport[] }) {
  const open = reports.filter((r) => !['resolved', 'rejected'].includes(r.status))
  const bands = [['Critical', 70, 100], ['High', 50, 69], ['Medium', 30, 49], ['Low', 0, 29]] as const
  return (
    <div className="aiw__cards aiw__cards--2">
      <Card title="Documented weights" sub="backend/app/services/priority.py">
        <table className="table table--plain">
          <thead><tr><th>Factor</th><th>Max</th><th>How it is measured</th></tr></thead>
          <tbody>{WEIGHTS.map(([n, w, d]) => <tr key={n}><td><strong>{n}</strong></td><td className="mono">{w}</td><td className="small">{d}</td></tr>)}</tbody>
        </table>
      </Card>
      <Card title="Score bands" sub={`${open.length} open reports`}>
        <ul className="aiw__bands">
          {bands.map(([name, lo, hi]) => {
            const n = open.filter((r) => r.priority_score >= lo && r.priority_score <= hi).length
            return <li key={name}><span className={`lvl lvl--${name.toLowerCase()}`}>{name}</span><span className="mono muted">{lo}–{hi}</span><span className="aiw__bandbar"><i style={{ width: `${(n / Math.max(1, open.length)) * 100}%` }} className={`b--${name.toLowerCase()}`} /></span><b className="mono">{n}</b></li>
          })}
        </ul>
        <p className="muted small" style={{ marginTop: 12 }}>Weights are a documented policy choice, not learned from outcomes. Officers can override a priority with a logged reason.</p>
      </Card>
    </div>
  )
}

function ActionsTab() {
  const b = useLiveQuery(() => api.brief())
  if (b.error) return <ErrorState error={b.error} onRetry={b.reload} />
  if (!b.data) return <Skeleton h={300} />
  return (
    <Card title="Suggested intervention order" sub={b.data.suggested.disclaimer}>
      <ol className="order">
        {b.data.suggested.intervention_order.map((o) => (
          <li key={o.step}>
            <span className="order__n serif">{o.step}</span>
            <div className="order__body">
              <p className="order__target"><span className="badge badge--outline">{o.type === 'hotspot' ? 'Hotspot' : 'Report'}</span> {o.target}</p>
              <p className="order__action">{o.action}</p>
              <p className="small muted">{o.department} · respond {o.respond} · score {o.score}</p>
              <p className="small">{o.why}</p>
            </div>
          </li>
        ))}
      </ol>
    </Card>
  )
}

function BriefTab() {
  const b = useLiveQuery(() => api.brief())
  if (b.error) return <ErrorState error={b.error} onRetry={b.reload} />
  if (!b.data) return <Skeleton h={300} />
  const c = b.data.calculated
  return (
    <div className="aiw__cards aiw__cards--2">
      <Card title="Recurring problems" sub="Calculated from stored reports">
        <table className="table table--plain"><thead><tr><th>Category</th><th>Open</th><th>Linked</th><th>Where</th></tr></thead>
          <tbody>{c.recurring_problems.map((p) => <tr key={p.category}><td>{p.label}</td><td className="mono">{p.open}</td><td className="mono">{p.linked_duplicates}</td><td className="small">{p.top_locations.join('; ')}</td></tr>)}</tbody></table>
      </Card>
      <Card title="Most affected areas" sub="Calculated" action={<Link to="/command/briefs" className="small link-id">Full action brief</Link>}>
        <table className="table table--plain"><thead><tr><th>Ward</th><th>Open</th><th>Critical</th></tr></thead>
          <tbody>{c.most_affected_areas.map((a) => <tr key={a.ward}><td>{a.ward}</td><td className="mono">{a.open}</td><td className="mono">{a.critical}</td></tr>)}</tbody></table>
        <p className="muted small" style={{ marginTop: 12 }}><Bot size={13} style={{ verticalAlign: -2 }} /> Need it in words? Ask CivicPulse “Which area needs attention first?”</p>
      </Card>
    </div>
  )
}
