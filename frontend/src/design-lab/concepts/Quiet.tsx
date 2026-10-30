/* CONCEPT 4 — QUIET · Minimal & functional.
   Calm, fast, information-dense. Geist + Geist Mono, greyscale with a single red reserved for
   critical. The landing page *is* the input. Keyboard hints, tight tables, a dot-matrix map. */
import '@fontsource-variable/geist'
import '@fontsource-variable/geist-mono'
import { ArrowRight, Command as Cmd, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { byScore, CATS, D, openReports, project, STATUS, STEPS, type ConceptProps, type Screen } from '../data'
import './quiet.css'

function Nav({ screen, go }: ConceptProps) {
  const items: [Screen, string][] = [['landing', 'Overview'], ['report', 'Report'], ['track', 'Track'], ['map', 'Map'], ['command', 'Console']]
  return (
    <header className="q-nav">
      <button className="q-brand" onClick={() => go('landing')}><span className="q-dot" />civicpulse</button>
      <nav>{items.map(([k, l]) => <button key={k} className={screen === k ? 'is-on' : ''} onClick={() => go(k)}>{l}</button>)}</nav>
      <span className="q-kbd q-hide-s"><Cmd size={12} />K</span>
    </header>
  )
}

function DotMap({ w = 640, h = 420, step = 14, hot = true }: { w?: number; h?: number; step?: number; hot?: boolean }) {
  const pts = useMemo(() => openReports.map((r) => ({ ...project(r.lat, r.lng, w, h, 30), crit: r.level === 'critical' })), [w, h])
  const dots: { x: number; y: number; v: number; c: boolean }[] = []
  for (let y = step / 2; y < h; y += step) for (let x = step / 2; x < w; x += step) {
    let v = 0, c = false
    for (const p of pts) { const d = Math.hypot(p.x - x, p.y - y); if (d < 46) { v += 1 - d / 46; if (p.crit && d < 16) c = true } }
    dots.push({ x, y, v, c })
  }
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="q-map" role="img" aria-label="Dot-density map of open reports">
      {dots.map((d, i) => <circle key={i} cx={d.x} cy={d.y} r={d.v > 0 ? Math.min(5.2, 1.4 + d.v * 2.2) : 1.1} fill={d.c ? '#D92D20' : d.v > 0 ? '#18181B' : '#D4D4D8'} />)}
      {hot && D.hotspots.map((hs) => { const p = project(hs.lat, hs.lng, w, h, 30); return (
        <g key={hs.id}><line x1={p.x} y1={p.y - 30} x2={p.x} y2={p.y - 52} stroke="#18181B" /><text x={p.x > w * .65 ? p.x - 4 : p.x + 4} y={p.y - 46} textAnchor={p.x > w * .65 ? 'end' : 'start'} className="q-map__l">{hs.id} {hs.location.split(',')[0]}</text></g>
      ) })}
    </svg>
  )
}

const Lv = ({ l, s }: { l: string; s?: number }) => <span className={`q-lv q-lv--${l}`}>{l === 'critical' ? '●' : '○'} {l}{s != null && <span className="q-mono"> {s}</span>}</span>

function Landing({ go }: { go: (s: Screen) => void }) {
  const m = D.metrics
  return (
    <div className="q-wrap">
      <section className="q-hero">
        <h1 className="q-h1">Report a civic problem.<br /><span>We’ll route it, rank it and keep you posted.</span></h1>
        <button className="q-omni" onClick={() => go('report')}>
          <Search size={18} /><span>Describe what’s wrong — “knee-deep water at the bus stand…”</span><span className="q-kbd">↵</span>
        </button>
        <p className="q-sub">No account. Or <button className="q-a" onClick={() => go('track')}>track an existing report</button>.</p>
      </section>
      <section className="q-stats">
        {[['Reports', m.total], ['Open', m.open], ['Critical', m.critical_open], ['Resolved', `${Math.round(m.resolution_rate)}%`], ['Avg. time to fix', `${(m.avg_resolution_hours / 24).toFixed(1)}d`]].map(([l, v]) => (
          <div key={String(l)}><span>{l}</span><b className={l === 'Critical' ? 'is-crit' : ''}>{v}</b></div>
        ))}
      </section>
      <section className="q-two">
        <div>
          <h2 className="q-h2">How it works</h2>
          <dl className="q-dl">
            <dt>Capture</dt><dd>Text, location and an optional photo. You get an ID.</dd>
            <dt>Understand</dt><dd>Category, summary, duplicate check and a 0–100 priority with every reason listed.</dd>
            <dt>Reveal</dt><dd>Open reports are clustered into hotspots.</dd>
            <dt>Act</dt><dd>The ward office assigns a department. Updates appear on your tracking page.</dd>
          </dl>
        </div>
        <div>
          <h2 className="q-h2">Open reports, by density</h2>
          <DotMap w={560} h={360} />
        </div>
      </section>
      <section>
        <h2 className="q-h2">Recent</h2>
        <table className="q-table">
          <tbody>{D.reports.slice(0, 6).map((r) => <tr key={r.id}><td className="q-mono q-m">{r.id}</td><td>{r.headline}</td><td className="q-m q-hide-s">{r.label}</td><td><Lv l={r.level} /></td><td className="q-m q-r">{r.ago}</td></tr>)}</tbody>
        </table>
      </section>
    </div>
  )
}

function Report() {
  const [cat, setCat] = useState('waterlogging')
  const f = D.featured
  return (
    <div className="q-wrap q-narrow">
      <h1 className="q-h1 q-h1--s">New report</h1>
      <form className="q-form" onSubmit={(e) => e.preventDefault()}>
        <label className="q-field"><span>Description</span><textarea rows={4} defaultValue={f.description} /></label>
        <div className="q-hint"><span className="q-mono">auto</span> {f.label} · {Math.round(f.confidence * 100)}% · from {f.evidence.slice(0, 3).map((e) => `“${e}”`).join(', ')}</div>
        <div className="q-field"><span>Category</span>
          <div className="q-seg">{CATS.map(([k, l]) => <button type="button" key={k} className={cat === k ? 'is-on' : ''} onClick={() => setCat(k)}>{l}</button>)}</div>
        </div>
        <label className="q-field"><span>Location</span><input defaultValue={f.location} /></label>
        <div className="q-mapbox"><DotMap w={560} h={220} step={12} hot={false} /><span className="q-cross" /><span className="q-coords q-mono">{f.lat.toFixed(5)}, {f.lng.toFixed(5)}</span></div>
        <div className="q-row">
          <label className="q-field"><span>Photo <i>optional</i></span><div className="q-file">Choose file… <span className="q-mono">≤ 5 MB</span></div></label>
          <label className="q-field"><span>Contact <i>optional, private</i></span><input placeholder="Phone or email" /></label>
        </div>
        <div className="q-actions"><button className="q-btn">Submit report <span className="q-kbd q-kbd--inv">⌘ ↵</span></button><span className="q-m">Similar reports nearby are linked automatically.</span></div>
      </form>
    </div>
  )
}

function Command() {
  const m = D.metrics
  const [q, setQ] = useState('')
  const rows = byScore.filter((r) => !q || `${r.id} ${r.headline} ${r.location}`.toLowerCase().includes(q.toLowerCase()))
  return (
    <div className="q-console">
      <aside className="q-side">
        <p className="q-m">Views</p>
        {[['Needs attention', m.critical_open + m.high_open], ['Unassigned', m.unassigned_open], ['In progress', D.reports.filter((r) => r.status === 'in_progress').length], ['All open', m.open], ['Resolved', m.resolved]].map(([l, n], i) => (
          <button key={String(l)} className={i === 0 ? 'is-on' : ''}><span>{l}</span><span className="q-mono">{n}</span></button>
        ))}
        <p className="q-m" style={{ marginTop: 18 }}>Departments</p>
        {D.workload.map((w) => <button key={w.label}><span>{w.label}</span><span className="q-mono">{w.open}</span></button>)}
      </aside>
      <div className="q-console__main">
        <div className="q-console__bar">
          <div className="q-search"><Search size={15} /><input placeholder="Filter reports…" value={q} onChange={(e) => setQ(e.target.value)} /><span className="q-kbd">/</span></div>
          <span className="q-m">{rows.length} open · sorted by priority</span>
        </div>
        <div className="q-strip">
          {[['Open', m.open], ['Critical', m.critical_open], ['High', m.high_open], ['Unassigned', m.unassigned_open], ['Linked dup.', m.linked_duplicates]].map(([l, v]) => <div key={String(l)}><span>{l}</span><b className={l === 'Critical' ? 'is-crit' : ''}>{v}</b></div>)}
          <div className="q-strip__spark"><span>Received · 21d</span>
            <svg viewBox="0 0 210 30"><polyline fill="none" stroke="#18181B" strokeWidth="1.5" points={D.trend.map((t, i) => `${i * 10.5},${28 - t.received * 4.5}`).join(' ')} /></svg>
          </div>
        </div>
        <table className="q-table q-table--dense">
          <thead><tr><th>Score</th><th>Report</th><th className="q-hide-s">Location</th><th>Status</th><th className="q-hide-s">Department</th><th className="q-hide-s">Age</th></tr></thead>
          <tbody>
            {rows.slice(0, 14).map((r) => (
              <tr key={r.id}>
                <td><Lv l={r.level} s={r.score} /></td>
                <td><span className="q-mono q-m">{r.id}</span> {r.headline}</td>
                <td className="q-m q-hide-s">{r.location}</td>
                <td>{STATUS[r.status]}</td>
                <td className="q-m q-hide-s">{r.dept ?? '—'}</td>
                <td className="q-m q-hide-s q-mono">{r.ago}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function MapScreen() {
  return (
    <div className="q-wrap">
      <div className="q-head"><h1 className="q-h1 q-h1--s">Map</h1><span className="q-m">Dot size = report density within ~400 m · red = critical · DBSCAN hotspots labelled</span></div>
      <div className="q-maplayout">
        <DotMap w={820} h={560} step={13} />
        <ol className="q-hs">
          {D.hotspots.map((h) => (
            <li key={h.id}>
              <div className="q-hs__top"><span className="q-mono">{h.id}</span><b>{h.location}</b></div>
              <div className="q-hs__nums q-m"><span>{h.count} reports</span><span className={h.critical_count ? 'is-crit' : ''}>{h.critical_count} critical</span><span>avg {Math.round(h.avg_priority)}</span></div>
              <p>{h.intervention}.</p>
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}

function Track() {
  const f = D.featured
  const cur = 3
  return (
    <div className="q-wrap q-narrow">
      <p className="q-mono q-m">{f.id}</p>
      <h1 className="q-h1 q-h1--s">Waterlogging at Central Bus Stand</h1>
      <div className="q-steps">{STEPS.map((s, i) => <span key={s} className={i < cur ? 'done' : i === cur ? 'now' : ''}>{s}</span>)}</div>
      <dl className="q-kv">
        <dt>Status</dt><dd>In progress</dd>
        <dt>Priority</dt><dd><Lv l={f.level} s={f.score} /></dd>
        <dt>Department</dt><dd>{f.dept}</dd>
        <dt>Target</dt><dd>Respond {f.respond} <span className="q-m">(suggested)</span></dd>
        <dt>Location</dt><dd>{f.location}, {f.ward}</dd>
        <dt>Similar</dt><dd>{f.matches.length} linked reports within 70 m</dd>
      </dl>
      <h2 className="q-h2">Activity</h2>
      <ol className="q-log">{[...f.timeline].reverse().map((t, i) => <li key={i}><span className="q-mono q-m">{t.at}</span><span>{t.status && <b>{t.status} · </b>}{t.msg}</span></li>)}</ol>
      <h2 className="q-h2">Priority breakdown</h2>
      <table className="q-table q-table--dense">
        <tbody>{f.factors.map((x) => <tr key={x.label}><td>{x.label}</td><td className="q-barcell"><span><i style={{ width: `${(x.points / x.weight) * 100}%` }} /></span></td><td className="q-mono q-r">{Math.round(x.points)}/{x.weight}</td></tr>)}</tbody>
      </table>
      <button className="q-a q-more">Open full analysis <ArrowRight size={14} /></button>
    </div>
  )
}

export function Quiet({ screen, go }: ConceptProps) {
  return (
    <div className="c-quiet">
      <Nav screen={screen} go={go} />
      {screen === 'landing' && <Landing go={go} />}
      {screen === 'report' && <Report />}
      {screen === 'command' && <Command />}
      {screen === 'map' && <MapScreen />}
      {screen === 'track' && <Track />}
      <footer className="q-foot"><span>civicpulse</span><span>Synthetic demo data · deterministic, explainable analysis</span></footer>
    </div>
  )
}
