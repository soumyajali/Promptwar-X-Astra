/* CONCEPT 5 — CYANOTYPE · Infrastructure blueprint (own concept).
   CivicPulse as an engineer's drawing set: Prussian-blue paper with a drafting grid, white
   linework, title blocks, revision clouds around hotspots, work-order forms and a revision log
   for tracking. Barlow Condensed + Barlow + JetBrains Mono. Safety orange marks critical only. */
import '@fontsource/barlow/latin-400.css'
import '@fontsource/barlow/latin-500.css'
import '@fontsource/barlow/latin-600.css'
import '@fontsource/barlow-condensed/latin-500.css'
import '@fontsource/barlow-condensed/latin-600.css'
import '@fontsource/barlow-condensed/latin-700.css'
import '@fontsource/jetbrains-mono/latin-400.css'
import { useState, type ReactNode } from 'react'
import { byScore, CATS, D, metresPerUnit, project, STATUS, type ConceptProps, type Screen } from '../data'
import './cyanotype.css'

const SHEETS: [Screen, string, string][] = [['landing', 'A-01', 'General'], ['report', 'A-02', 'Work order'], ['track', 'A-03', 'Status'], ['map', 'C-01', 'Site plan'], ['command', 'C-02', 'Control']]

function TitleBlock({ screen, go }: ConceptProps) {
  const cur = SHEETS.find((s) => s[0] === screen)!
  return (
    <header className="y-tb">
      <button className="y-tb__proj" onClick={() => go('landing')}><small>Project</small><b>CIVICPULSE</b><span>Civic issue intelligence · Demo City</span></button>
      <nav className="y-tb__sheets">
        {SHEETS.map(([k, n, l]) => <button key={k} className={screen === k ? 'is-on' : ''} onClick={() => go(k)}><small>{n}</small>{l}</button>)}
      </nav>
      <div className="y-tb__rev y-hide-s"><small>Sheet</small><b>{cur[1]}</b><span>Rev. {D.metrics.total} · live</span></div>
    </header>
  )
}

function cloud(cx: number, cy: number, r: number) {
  const n = Math.max(10, Math.round(r / 6))
  let d = ''
  for (let i = 0; i < n; i++) {
    const a1 = (i / n) * Math.PI * 2, a2 = ((i + 1) / n) * Math.PI * 2
    const x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1), x2 = cx + r * Math.cos(a2), y2 = cy + r * Math.sin(a2)
    d += `${i === 0 ? `M${x1} ${y1}` : ''} A ${(r * Math.PI) / n} ${(r * Math.PI) / n} 0 0 1 ${x2} ${y2} `
  }
  return d + 'Z'
}

function Plan({ w = 760, h = 520, callouts = true, pin }: { w?: number; h?: number; callouts?: boolean; pin?: [number, number] }) {
  const sc = 500 / metresPerUnit(w)
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="y-plan" role="img" aria-label="Blueprint site plan of reports and hotspots">
      <rect x="6" y="6" width={w - 12} height={h - 12} fill="none" stroke="#EAF2F8" strokeWidth="1.5" />
      <path d={`M6 ${h * .14} C ${w * .07} ${h * .35}, ${w * .03} ${h * .66}, ${w * .08} ${h - 6}`} fill="none" stroke="#EAF2F8" strokeDasharray="10 4 2 4" />
      <text x="18" y={h * .5} className="y-plan__lbl" transform={`rotate(-90 18 ${h * .5})`}>COASTLINE</text>
      {[[.1, .62, 1, .4], [.46, 0, .62, 1], [.14, .2, 1, .26], [.1, .86, 1, .82]].map(([x1, y1, x2, y2], i) => (
        <g key={i}>
          <line x1={w * x1} y1={h * y1} x2={w * x2} y2={h * y2} stroke="#EAF2F8" strokeWidth={i < 2 ? 9 : 5} opacity=".85" />
          <line x1={w * x1} y1={h * y1} x2={w * x2} y2={h * y2} stroke="#123A63" strokeWidth={i < 2 ? 6 : 3} />
          {i < 2 && <line x1={w * x1} y1={h * y1} x2={w * x2} y2={h * y2} stroke="#7FB2D9" strokeWidth=".8" strokeDasharray="8 8" />}
        </g>
      ))}
      {D.reports.map((r) => {
        const p = project(r.lat, r.lng, w, h, 40)
        const closed = r.status === 'resolved' || r.status === 'rejected'
        if (closed) return <path key={r.id} d={`M${p.x - 3} ${p.y - 3} L${p.x + 3} ${p.y + 3} M${p.x + 3} ${p.y - 3} L${p.x - 3} ${p.y + 3}`} stroke="#7FB2D9" strokeWidth="1.2" />
        return <circle key={r.id} cx={p.x} cy={p.y} r={r.level === 'critical' ? 5 : 3.5} fill={r.level === 'critical' ? '#F26B1D' : '#EAF2F8'} />
      })}
      {callouts && D.hotspots.map((hs, i) => {
        const p = project(hs.lat, hs.lng, w, h, 40)
        const r = 22 + hs.count * 4
        const dir = p.x > w * .6 ? -1 : 1
        const ex = p.x + dir * (r + 46), ey = p.y - r - 14
        return (
          <g key={hs.id}>
            <path d={cloud(p.x, p.y, r)} fill="none" stroke={hs.critical_count ? '#F26B1D' : '#EAF2F8'} strokeWidth="1.4" />
            <polyline points={`${p.x + dir * r * .7},${p.y - r * .7} ${ex},${ey}`} fill="none" stroke="#EAF2F8" strokeWidth="1" />
            <circle cx={ex + dir * 16} cy={ey} r="16" fill="#123A63" stroke="#EAF2F8" strokeWidth="1.4" />
            <line x1={ex + dir * 16 - 16} y1={ey} x2={ex + dir * 16 + 16} y2={ey} stroke="#EAF2F8" />
            <text x={ex + dir * 16} y={ey - 4} textAnchor="middle" className="y-plan__c">{i + 1}</text>
            <text x={ex + dir * 16} y={ey + 11} textAnchor="middle" className="y-plan__c y-plan__c--s">C-01</text>
          </g>
        )
      })}
      {pin && (() => { const p = project(pin[0], pin[1], w, h, 40); return <g><line x1={p.x - 24} y1={p.y} x2={p.x + 24} y2={p.y} stroke="#F26B1D" /><line x1={p.x} y1={p.y - 24} x2={p.x} y2={p.y + 24} stroke="#F26B1D" /><circle cx={p.x} cy={p.y} r="10" fill="none" stroke="#F26B1D" strokeWidth="1.5" /></g> })()}
      <g transform={`translate(${w - 40 - sc} ${h - 30})`}>
        <line x2={sc} stroke="#EAF2F8" strokeWidth="1.5" /><line y1="-6" y2="6" stroke="#EAF2F8" /><line x1={sc} x2={sc} y1="-6" y2="6" stroke="#EAF2F8" />
        <text x={sc / 2} y="-9" textAnchor="middle" className="y-plan__lbl">500 M</text>
      </g>
      <g transform={`translate(${w - 46} 52)`}><circle r="18" fill="none" stroke="#EAF2F8" /><path d="M0 -14 L5 4 L0 0 L-5 4 Z" fill="#EAF2F8" /><text y="34" textAnchor="middle" className="y-plan__lbl">N</text></g>
    </svg>
  )
}

const Cell = ({ k, v, accent }: { k: string; v: ReactNode; accent?: boolean }) => <div className={`y-cell ${accent ? 'is-acc' : ''}`}><small>{k}</small><b>{v}</b></div>

function Landing({ go }: { go: (s: Screen) => void }) {
  const m = D.metrics
  return (
    <div className="y-sheet">
      <section className="y-hero">
        <div>
          <p className="y-note">General notes · 01</p>
          <h1 className="y-h1">Every complaint,<br />drafted into action.</h1>
          <p className="y-lede">CivicPulse measures each citizen report like an engineer would: what it is, where it is, how dangerous, how often it recurs — and issues a work order to the right department.</p>
          <div className="y-ctas"><button className="y-btn" onClick={() => go('report')}>Open a work order →</button><button className="y-btn y-btn--line" onClick={() => go('track')}>Check status</button></div>
        </div>
        <figure className="y-fig"><Plan /><figcaption><span>Detail 1</span> Open reports · revision clouds mark hotspots (DBSCAN, 350 m) · ✕ = closed</figcaption></figure>
      </section>
      <section className="y-cells">
        <Cell k="Reports logged" v={m.total} /><Cell k="Open" v={m.open} /><Cell k="Critical" v={m.critical_open} accent /><Cell k="Resolved" v={`${Math.round(m.resolution_rate)}%`} /><Cell k="Avg. to resolve" v={`${(m.avg_resolution_hours / 24).toFixed(1)} d`} /><Cell k="Linked duplicates" v={m.linked_duplicates} />
      </section>
      <section className="y-proc">
        {[['01', 'Capture', 'Citizen work-order request with location and photo.'], ['02', 'Understand', 'Classification, summary, duplicate check and a 0–100 priority with listed factors.'], ['03', 'Reveal', 'Clustered into hotspots on the site plan.'], ['04', 'Act', 'Assigned, executed and closed with a resolution note.']].map(([n, t, d], i) => (
          <div key={n} className="y-proc__step"><span className="y-bubble">{n}</span><b>{t}</b><p>{d}</p>{i < 3 && <span className="y-arrow" aria-hidden>→</span>}</div>
        ))}
      </section>
    </div>
  )
}

function Report() {
  const [cat, setCat] = useState('waterlogging')
  const f = D.featured
  return (
    <div className="y-sheet">
      <div className="y-wo">
        <div className="y-wo__head"><h1 className="y-h2">Work order request</h1><span className="y-mono">WO-NEW · {new Date(2026, 9, 30).toLocaleDateString('en-GB')}</span></div>
        <div className="y-wo__grid">
          <fieldset className="y-box y-span2"><legend>1 · Classification</legend>
            <div className="y-checks">{CATS.map(([k, l]) => <button type="button" key={k} className={cat === k ? 'is-on' : ''} onClick={() => setCat(k)}><span className="y-chk">{cat === k ? '✕' : ''}</span>{l}</button>)}</div>
          </fieldset>
          <fieldset className="y-box y-span2"><legend>2 · Description of defect</legend>
            <textarea className="y-in" rows={4} defaultValue={f.description} aria-label="Description" />
            <p className="y-auto"><span>AUTO-CHECK</span> {f.label} · conf. {Math.round(f.confidence * 100)}% · evidence: {f.evidence.join(', ')}</p>
          </fieldset>
          <fieldset className="y-box"><legend>3 · Location</legend>
            <input className="y-in" defaultValue={f.location} aria-label="Location" />
            <p className="y-mono y-dim">N {f.lat.toFixed(5)} · E {f.lng.toFixed(5)}</p>
            <div className="y-mini"><Plan w={460} h={240} callouts={false} pin={[f.lat, f.lng]} /></div>
          </fieldset>
          <fieldset className="y-box"><legend>4 · Attachments &amp; contact</legend>
            <div className="y-attach">ATTACH PHOTO<br /><small>JPEG / PNG / WEBP · ≤ 5 MB</small></div>
            <input className="y-in" placeholder="Name (optional, private)" aria-label="Name" />
            <input className="y-in" placeholder="Phone or email (optional, private)" aria-label="Contact" />
          </fieldset>
        </div>
        <div className="y-wo__foot"><p className="y-dim">Duplicates within 500 m / 14 days are linked, never deleted. A tracking number is issued on submission.</p><button className="y-btn">Issue work order →</button></div>
      </div>
    </div>
  )
}

function Command() {
  const m = D.metrics
  const max = Math.max(...D.workload.map((w) => w.open), 1)
  return (
    <div className="y-sheet">
      <div className="y-wo__head"><h1 className="y-h2">Site control</h1><span className="y-mono">LIVE · SSE</span></div>
      <section className="y-cells y-cells--5">
        <Cell k="Open" v={m.open} /><Cell k="Critical" v={m.critical_open} accent /><Cell k="High" v={m.high_open} /><Cell k="Unassigned" v={m.unassigned_open} /><Cell k="Resolved" v={m.resolved} />
      </section>
      <div className="y-ctl">
        <div className="y-box y-box--flush">
          <div className="y-sched__head"><span>Schedule of works — by priority</span><span className="y-mono">{byScore.length} items</span></div>
          <table className="y-table">
            <thead><tr><th>No.</th><th>Score</th><th>Item</th><th className="y-hide-s">Location</th><th>Dept.</th><th className="y-hide-s">Status</th></tr></thead>
            <tbody>{byScore.slice(0, 10).map((r, i) => (
              <tr key={r.id} className={r.level === 'critical' ? 'is-crit' : ''}>
                <td className="y-mono">{String(i + 1).padStart(2, '0')}</td><td className="y-mono y-score">{r.score}</td>
                <td>{r.headline}<small className="y-mono">{r.id}</small></td><td className="y-hide-s">{r.location}</td>
                <td>{r.dept ? r.dept.split(' ')[0] : <span className="y-tbd">TBD</span>}</td><td className="y-hide-s">{STATUS[r.status]}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
        <div className="y-ctl__side">
          <div className="y-box"><legend className="y-leg">Departmental load</legend>
            {D.workload.map((w) => <div key={w.label} className="y-hbar"><span>{w.label}</span><i><em style={{ width: `${(w.open / max) * 100}%` }} className={w.critical ? 'is-acc' : ''} /></i><b className="y-mono">{w.open}</b></div>)}
          </div>
          <div className="y-box"><legend className="y-leg">Intake, 21 days</legend>
            <svg viewBox="0 0 420 100" className="y-chart">
              {[25, 50, 75].map((y) => <line key={y} x1="0" x2="420" y1={y} y2={y} stroke="#7FB2D9" strokeDasharray="2 4" />)}
              <polyline fill="none" stroke="#EAF2F8" strokeWidth="2" points={D.trend.map((t, i) => `${i * 21},${96 - t.received * 15}`).join(' ')} />
              <polyline fill="none" stroke="#F26B1D" strokeWidth="2" strokeDasharray="6 3" points={D.trend.map((t, i) => `${i * 21},${96 - t.resolved * 15}`).join(' ')} />
            </svg>
            <p className="y-mono y-dim">— received  - - resolved</p>
          </div>
        </div>
      </div>
    </div>
  )
}

function MapScreen() {
  return (
    <div className="y-sheet">
      <div className="y-wo__head"><h1 className="y-h2">Site plan — hotspots</h1><span className="y-mono">C-01 · scale bar 500 m</span></div>
      <div className="y-mapgrid">
        <Plan w={820} h={580} />
        <ol className="y-legend">
          {D.hotspots.map((h, i) => (
            <li key={h.id}>
              <span className="y-bubble y-bubble--s">{i + 1}</span>
              <div><b>{h.location}</b><p className="y-mono y-dim">{h.count} reports · {h.critical_count} crit · avg {Math.round(h.avg_priority)} · {h.ward}</p><p>{h.intervention}.</p></div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}

function Track() {
  const f = D.featured
  return (
    <div className="y-sheet">
      <div className="y-track">
        <div className="y-track__main">
          <div className="y-wo__head"><h1 className="y-h2">Work order {f.id}</h1><span className="y-stamp">In progress</span></div>
          <section className="y-cells y-cells--4">
            <Cell k="Item" v="Waterlogging" /><Cell k="Priority" v={`${f.score} / 100`} accent /><Cell k="Assigned" v={f.dept} /><Cell k="Respond" v={f.respond} />
          </section>
          <div className="y-box y-box--flush">
            <div className="y-sched__head"><span>Revision log</span><span className="y-mono">public entries</span></div>
            <table className="y-table">
              <thead><tr><th>Rev</th><th>Date</th><th>Description</th><th className="y-hide-s">By</th></tr></thead>
              <tbody>{f.timeline.map((t, i) => <tr key={i}><td className="y-mono">{String.fromCharCode(65 + i)}</td><td className="y-mono">{t.at}</td><td>{t.status && <b>{t.status.toUpperCase()} · </b>}{t.msg}</td><td className="y-hide-s">{t.who}</td></tr>)}</tbody>
            </table>
          </div>
        </div>
        <div className="y-track__side">
          <div className="y-box"><legend className="y-leg">Priority calculation</legend>
            <table className="y-table y-table--calc"><tbody>
              {f.factors.map((x) => <tr key={x.label}><td>{x.label}</td><td className="y-mono y-r">{x.points.toFixed(1)}</td><td className="y-mono y-dim">/ {x.weight}</td></tr>)}
              <tr className="y-sum"><td>Total</td><td className="y-mono y-r">{f.score}</td><td className="y-mono y-dim">/ 100</td></tr>
            </tbody></table>
          </div>
          <div className="y-mini"><Plan w={460} h={260} callouts={false} pin={[f.lat, f.lng]} /></div>
        </div>
      </div>
    </div>
  )
}

export function Cyanotype({ screen, go }: ConceptProps) {
  return (
    <div className="c-cyan">
      <TitleBlock screen={screen} go={go} />
      {screen === 'landing' && <Landing go={go} />}
      {screen === 'report' && <Report />}
      {screen === 'command' && <Command />}
      {screen === 'map' && <MapScreen />}
      {screen === 'track' && <Track />}
      <footer className="y-foot"><span>CIVICPULSE · DRAWN FROM SYNTHETIC DATA</span><span>Analysis: deterministic, documented rules · not for construction</span></footer>
    </div>
  )
}
