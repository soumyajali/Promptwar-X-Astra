/* CONCEPT 2 — WAYFINDER · Modern civic technology.
   Borrowed from road and transit signage: Overpass (a Highway Gothic descendant), sign green,
   sign yellow, departments as coloured transit lines, hotspots as interchanges, a departure board. */
import '@fontsource/overpass/latin-400.css'
import '@fontsource/overpass/latin-600.css'
import '@fontsource/overpass/latin-700.css'
import '@fontsource/overpass/latin-800.css'
import '@fontsource/overpass/latin-900.css'
import '@fontsource/overpass-mono/latin-400.css'
import '@fontsource/overpass-mono/latin-600.css'
import { ArrowRight, ArrowUpRight, Camera, CircleHelp, Construction, Droplets, Lightbulb, MapPin, ShieldAlert, Trash2, Waves, Workflow } from 'lucide-react'
import { useMemo, useState } from 'react'
import { byScore, CATS, D, project, STATUS, STEPS, type ConceptProps, type Screen } from '../data'
import './wayfinder.css'

const ICON: Record<string, typeof Waves> = { roads: Construction, waterlogging: Waves, garbage: Trash2, streetlights: Lightbulb, drainage: Workflow, public_safety: ShieldAlert, water_supply: Droplets, other: CircleHelp }
const LINE: Record<string, { c: string; code: string }> = {
  'Roads and Infrastructure': { c: '#E87722', code: 'R' }, 'Sanitation': { c: '#7A5230', code: 'S' }, 'Water and Drainage': { c: '#1B5FA8', code: 'W' },
  'Electricity': { c: '#E0A800', code: 'E' }, 'Public Safety': { c: '#C8102E', code: 'P' }, 'General Administration': { c: '#6D6E71', code: 'A' },
}
const CAT_DEPT: Record<string, string> = { roads: 'Roads and Infrastructure', waterlogging: 'Water and Drainage', drainage: 'Water and Drainage', water_supply: 'Water and Drainage', garbage: 'Sanitation', streetlights: 'Electricity', public_safety: 'Public Safety', other: 'General Administration' }
const Shield = ({ dept }: { dept: string }) => { const l = LINE[dept] ?? LINE['General Administration']; return <span className="w-shield" style={{ background: l.c }} title={dept}>{l.code}</span> }

function Top({ screen, go }: ConceptProps) {
  const items: [Screen, string][] = [['landing', 'Home'], ['report', 'Report'], ['track', 'Track'], ['map', 'City map'], ['command', 'Ward control']]
  return (
    <header className="w-top">
      <button className="w-brand" onClick={() => go('landing')}><span className="w-mark"><ArrowUpRight /></span>CivicPulse</button>
      <nav className="w-nav">{items.map(([k, l]) => <button key={k} className={screen === k ? 'is-on' : ''} onClick={() => go(k)}>{l}</button>)}</nav>
    </header>
  )
}

/* Schematic, transit-style map: hotspots become interchanges joined by octilinear department lines. */
function Schematic({ w = 900, h = 520, detail = false, names = true }: { w?: number; h?: number; detail?: boolean; names?: boolean }) {
  const snap = (v: number) => Math.round(v / 20) * 20
  // Schematic like a transit map: keep rough geography, but push interchanges apart so nothing collides.
  const pts = useMemo(() => {
    const ps = D.hotspots.map((hs) => { const p = project(hs.lat, hs.lng, w, h, 90); return { ...hs, x: p.x, y: p.y } })
    for (let it = 0; it < 60; it++) for (const a of ps) for (const b of ps) {
      if (a === b) continue
      const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1, min = Math.min(w, h) * .3
      if (d < min) { const k = (min - d) / 2 / d; a.x -= dx * k; a.y -= dy * k; b.x += dx * k; b.y += dy * k }
    }
    return ps.map((q) => ({ ...q, x: snap(Math.min(w - 90, Math.max(90, q.x))), y: snap(Math.min(h - 110, Math.max(70, q.y))) }))
  }, [w, h])
  const route = (a: { x: number; y: number }, b: { x: number; y: number }) => {
    const dx = b.x - a.x, dy = b.y - a.y
    const d = Math.min(Math.abs(dx), Math.abs(dy))
    const mx = a.x + Math.sign(dx) * (Math.abs(dx) - d)
    return `M${a.x} ${a.y} L${mx} ${a.y} L${b.x} ${b.y}`
  }
  const lines: [string, number[]][] = [['Water and Drainage', [4, 0, 2]], ['Roads and Infrastructure', [3, 0, 1]], ['Electricity', [0, 2]], ['Sanitation', [3, 4]], ['Public Safety', [2, 1]]]
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-schem" role="img" aria-label="Schematic map of hotspots and department lines">
      <rect width={w} height={h} fill="#F2F4F3" />
      <path d={`M0 ${h - 70} C ${w * .3} ${h - 40}, ${w * .6} ${h - 90}, ${w} ${h - 60} L${w} ${h} L0 ${h} Z`} fill="#DCE8F2" />
      <text x="16" y={h - 16} className="w-schem__water">River</text>
      {lines.map(([dept, idx], li) => (
        <g key={dept}>
          {idx.slice(1).map((j, k) => {
            const a = pts[idx[k]], b = pts[j]
            if (!a || !b) return null
            const off = (li - 2) * 7
            return <path key={k} d={route({ x: a.x + off, y: a.y + off }, { x: b.x + off, y: b.y + off })} fill="none" stroke={LINE[dept].c} strokeWidth="7" strokeLinejoin="round" strokeLinecap="round" />
          })}
        </g>
      ))}
      {D.reports.filter((r) => r.status !== 'resolved' && r.status !== 'rejected').map((r) => {
        const p = project(r.lat, r.lng, w, h, 70)
        return <circle key={r.id} cx={p.x} cy={p.y} r={r.level === 'critical' ? 4.5 : 3} fill={r.level === 'critical' ? '#C8102E' : '#1A1A1A'} opacity={r.level === 'critical' ? 1 : .45} />
      })}
      {pts.map((p) => (
        <g key={p.id}>
          <rect x={p.x - 16} y={p.y - 16} width="32" height="32" rx="16" fill="#fff" stroke="#1A1A1A" strokeWidth="4" />
          <text x={p.x} y={p.y + 5} textAnchor="middle" className="w-schem__id">{p.id.slice(1)}</text>
          {names && (() => { const right = p.x < w * .62; const up = p.y > h * .3; return (
            <g transform={`translate(${right ? p.x + 26 : p.x - 26} ${up ? p.y - 30 : p.y + 40})`} textAnchor={right ? 'start' : 'end'}>
              <text className="w-schem__name">{p.location.split(',')[0]}</text>
              {detail && <text y="17" className="w-schem__sub">{p.count} reports · {p.critical_count} critical</text>}
            </g>) })()}
        </g>
      ))}
    </svg>
  )
}

function Landing({ go }: { go: (s: Screen) => void }) {
  const m = D.metrics
  return (
    <>
      <section className="w-hero">
        <div className="w-sign w-sign--green">
          <div className="w-sign__inner">
            <p className="w-sign__small">Demo City · civic issue reporting</p>
            <h1 className="w-h1">Report it.<br />Route it.<br />Resolve it.</h1>
            <div className="w-hero__exits">
              <button className="w-exit" onClick={() => go('report')}><span>Report an issue</span><ArrowRight /></button>
              <button className="w-exit w-exit--ghost" onClick={() => go('track')}><span>Track a report</span><ArrowRight /></button>
            </div>
          </div>
        </div>
        <div className="w-dist">
          <p className="w-eyebrow">City status — live</p>
          {[['Open reports', m.open], ['Critical', m.critical_open], ['Assigned to a team', m.open - m.unassigned_open], ['Resolved', m.resolved], ['Resolution rate', `${Math.round(m.resolution_rate)}%`]].map(([l, v]) => (
            <div key={String(l)} className="w-dist__row"><span>{l}</span><i /><b>{v}</b></div>
          ))}
        </div>
      </section>
      <section className="w-sec">
        <p className="w-eyebrow">Where is your problem headed?</p>
        <h2 className="w-h2">Every report is routed to the right line.</h2>
        <div className="w-routes">
          {Object.entries(LINE).map(([dept, l]) => {
            const cats = Object.entries(CAT_DEPT).filter(([, d]) => d === dept).map(([c]) => CATS.find((x) => x[0] === c)?.[1])
            const open = D.workload.find((x) => x.label === dept)?.open ?? 0
            return (
              <div key={dept} className="w-route" style={{ ['--l' as string]: l.c }}>
                <span className="w-shield w-shield--lg" style={{ background: l.c }}>{l.code}</span>
                <div><b>{dept}</b><p>{cats.join(' · ') || 'Everything else'}</p></div>
                <span className="w-route__n">{open}<small>open</small></span>
              </div>
            )
          })}
        </div>
      </section>
      <section className="w-sec w-sec--tint">
        <div className="w-journey">
          {[['1', 'Capture', 'Describe it, drop a pin, add a photo.'], ['2', 'Understand', 'Category, summary, duplicates and a 0–100 priority — with reasons.'], ['3', 'Reveal', 'Clusters become hotspots on the city map.'], ['4', 'Act', 'A team is assigned. You see every stop.']].map(([n, t, d]) => (
            <div key={n} className="w-stop"><span className="w-stop__dot">{n}</span><b>{t}</b><p>{d}</p></div>
          ))}
        </div>
      </section>
      <section className="w-sec">
        <div className="w-sec__head"><h2 className="w-h2">Hotspots now</h2><button className="w-textbtn" onClick={() => go('map')}>Open city map <ArrowRight /></button></div>
        <Schematic h={420} />
      </section>
    </>
  )
}

function Report() {
  const [cat, setCat] = useState('waterlogging')
  const f = D.featured
  return (
    <section className="w-sec w-form">
      <p className="w-eyebrow">Report an issue · 4 stops · about 2 minutes</p>
      <h1 className="w-h2 w-h2--xl">What needs fixing?</h1>
      <div className="w-form__grid">
        <ol className="w-steps">
          <li className="is-on">
            <span className="w-steps__dot">1</span>
            <div className="w-steps__body">
              <h3>Choose a sign</h3>
              <div className="w-picto">
                {CATS.map(([k, l]) => { const I = ICON[k]; return <button key={k} className={cat === k ? 'is-on' : ''} onClick={() => setCat(k)}><span><I /></span>{l}</button> })}
              </div>
            </div>
          </li>
          <li className="is-on">
            <span className="w-steps__dot">2</span>
            <div className="w-steps__body">
              <h3>Describe it</h3>
              <textarea className="w-input" rows={4} defaultValue={f.description} aria-label="Description" />
              <div className="w-detect"><span className="w-detect__tag">Detected</span>{f.label} · {Math.round(f.confidence * 100)}% <span className="w-detect__arrow"><ArrowRight size={14} /></span><Shield dept={f.dept} /> {f.dept}</div>
            </div>
          </li>
          <li className="is-on">
            <span className="w-steps__dot">3</span>
            <div className="w-steps__body">
              <h3>Mark the spot</h3>
              <div className="w-inrow"><input className="w-input" defaultValue={f.location} aria-label="Location" /><button className="w-btn w-btn--ghost"><MapPin size={18} />Use my location</button></div>
              <div className="w-mini"><Schematic h={260} names={false} /><span className="w-pin"><MapPin /></span></div>
            </div>
          </li>
          <li>
            <span className="w-steps__dot">4</span>
            <div className="w-steps__body">
              <h3>Add a photo <small>optional</small></h3>
              <div className="w-drop"><Camera /><span>Take or upload a photo · JPEG, PNG, WebP up to 5 MB</span></div>
            </div>
          </li>
        </ol>
        <aside className="w-sign w-sign--blue w-form__aside">
          <div className="w-sign__inner">
            <p className="w-sign__small">What happens next</p>
            <ul><li>Instant analysis and a tracking number</li><li>Linked with nearby reports of the same problem</li><li>Routed to the right department</li></ul>
            <button className="w-btn w-btn--yellow">Submit report <ArrowRight /></button>
          </div>
        </aside>
      </div>
    </section>
  )
}

function Command() {
  const m = D.metrics
  return (
    <section className="w-sec w-ctl">
      <div className="w-sec__head"><div><p className="w-eyebrow">Ward control · Demo City</p><h1 className="w-h2 w-h2--xl">Operations</h1></div><span className="w-live"><i />Live</span></div>
      <div className="w-kpis">
        {[['Open', m.open, ''], ['Critical', m.critical_open, 'red'], ['High', m.high_open, 'amber'], ['Unassigned', m.unassigned_open, ''], ['Resolved', m.resolved, 'green']].map(([l, v, t]) => (
          <div key={String(l)} className={`w-kpi w-kpi--${t}`}><span>{l}</span><b>{v}</b></div>
        ))}
      </div>
      <div className="w-ctl__grid">
        <div className="w-board">
          <div className="w-board__head"><span>Next actions</span><span>by priority</span></div>
          <div className="w-board__cols"><span>Score</span><span>Report</span><span>Line</span><span>Status</span></div>
          {byScore.slice(0, 9).map((r) => (
            <div key={r.id} className="w-board__row">
              <span className={`w-board__score w-board__score--${r.level}`}>{r.score}</span>
              <span className="w-board__what"><b>{r.headline}</b><small>{r.id} · {r.location}</small></span>
              <span><Shield dept={r.dept ?? CAT_DEPT[r.category]} /></span>
              <span className="w-board__st">{r.dept ? STATUS[r.status] : <em>Unassigned</em>}</span>
            </div>
          ))}
        </div>
        <div className="w-lines">
          <p className="w-eyebrow">Line status</p>
          {D.workload.map((w) => (
            <div key={w.label} className="w-line">
              <Shield dept={w.label} />
              <b>{w.label}</b>
              <span className={`w-line__st ${w.critical ? 'is-bad' : w.open > 3 ? 'is-warn' : ''}`}>{w.critical ? 'Critical work' : w.open > 3 ? 'Busy' : w.open ? 'Normal' : 'Clear'}</span>
              <small>{w.open} open · {w.in_progress} in progress</small>
            </div>
          ))}
          <p className="w-eyebrow" style={{ marginTop: 22 }}>Received vs resolved · 21 days</p>
          <svg viewBox="0 0 420 90" className="w-trend" role="img" aria-label="Trend">
            <polyline fill="none" stroke="#C8102E" strokeWidth="3" points={D.trend.map((t, i) => `${i * 21},${84 - t.received * 13}`).join(' ')} />
            <polyline fill="none" stroke="#0F5132" strokeWidth="3" points={D.trend.map((t, i) => `${i * 21},${84 - t.resolved * 13}`).join(' ')} />
          </svg>
        </div>
      </div>
    </section>
  )
}

function MapScreen() {
  return (
    <section className="w-sec">
      <div className="w-sec__head"><div><p className="w-eyebrow">City map · schematic view</p><h1 className="w-h2 w-h2--xl">Hotspots & lines</h1></div>
        <div className="w-legend">{Object.entries(LINE).slice(0, 5).map(([d]) => <span key={d}><Shield dept={d} />{d.split(' ')[0]}</span>)}</div></div>
      <Schematic h={560} detail />
      <div className="w-hslist">
        {D.hotspots.map((h) => (
          <div key={h.id} className="w-hs">
            <span className="w-hs__id">{h.id}</span>
            <div><b>{h.location}</b><p>{h.reason}</p><p className="w-hs__do"><ArrowRight size={14} /> {h.intervention}</p></div>
            <div className="w-hs__n"><b>{h.count}</b><small>reports</small></div>
          </div>
        ))}
      </div>
    </section>
  )
}

function Track() {
  const f = D.featured
  const cur = 3
  return (
    <section className="w-sec w-track">
      <div className="w-sign w-sign--green w-track__sign">
        <div className="w-sign__inner">
          <p className="w-sign__small">Your report · {f.id}</p>
          <h1 className="w-h1 w-h1--s">Waterlogging at Central Bus Stand</h1>
          <div className="w-track__meta"><span className="w-crit">Critical · {f.score}</span><span><Shield dept={f.dept} /> {f.dept}</span><span>Respond {f.respond}</span></div>
        </div>
      </div>
      <div className="w-rail">
        {STEPS.map((s, i) => (
          <div key={s} className={`w-rail__stop ${i < cur ? 'done' : i === cur ? 'now' : ''}`}>
            <span className="w-rail__dot" />
            <b>{s}</b>
            {i === cur && <span className="w-here">You are here</span>}
          </div>
        ))}
      </div>
      <div className="w-track__grid">
        <div>
          <h2 className="w-h3">Updates</h2>
          <ul className="w-updates">
            {[...f.timeline].reverse().map((t, i) => <li key={i}><span className="w-mono">{t.at}</span><p>{t.status && <b>{t.status} — </b>}{t.msg}</p><small>{t.who}</small></li>)}
          </ul>
        </div>
        <div>
          <h2 className="w-h3">Why it’s critical</h2>
          {f.factors.map((x) => (
            <div key={x.label} className="w-fac"><span>{x.label}</span><span className="w-fac__bar"><i style={{ width: `${(x.points / x.weight) * 100}%` }} /></span><b>{Math.round(x.points)}</b></div>
          ))}
          <p className="w-small">{f.reasoning}</p>
        </div>
      </div>
    </section>
  )
}

export function Wayfinder({ screen, go }: ConceptProps) {
  return (
    <div className="c-way">
      <Top screen={screen} go={go} />
      {screen === 'landing' && <Landing go={go} />}
      {screen === 'report' && <Report />}
      {screen === 'command' && <Command />}
      {screen === 'map' && <MapScreen />}
      {screen === 'track' && <Track />}
      <footer className="w-foot"><span>CivicPulse · Demo City</span><span>Synthetic data · explainable, rule-based analysis</span></footer>
    </div>
  )
}
