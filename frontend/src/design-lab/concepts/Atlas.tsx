/* CONCEPT 1 — ATLAS · Editorial & premium.
   The city as a magazine: Fraunces high-contrast serif, Manrope text, white paper, black rules,
   one oxblood ink. Maps are drawn as editorial infographics with numbered callouts. */
import '@fontsource-variable/fraunces/opsz.css'
import '@fontsource-variable/fraunces/opsz-italic.css'
import '@fontsource-variable/manrope'
import { useState } from 'react'
import { byScore, CATS, D, metresPerUnit, project, STATUS, STEPS, type ConceptProps, type Screen } from '../data'
import './atlas.css'

const ROMAN = ['I', 'II', 'III', 'IV', 'V']
const LV: Record<string, string> = { critical: 'Critical', high: 'High', medium: 'Medium', low: 'Low' }

function Masthead({ screen, go }: ConceptProps) {
  const links: [Screen, string][] = [['landing', 'The City'], ['report', 'Report'], ['track', 'Track'], ['map', 'Atlas'], ['command', 'Ward Desk']]
  return (
    <header className="a-mast">
      <div className="a-mast__strip">
        <span>Vol. I · No. {D.metrics.total}</span><span className="a-hide-s">Demo City · Thursday, 30 October 2026</span><span>Updated live</span>
      </div>
      <div className="a-mast__row">
        <button className="a-word" onClick={() => go('landing')}>CivicPulse<em>.</em></button>
        <nav className="a-nav">
          {links.map(([k, l]) => <button key={k} className={screen === k ? 'is-on' : ''} onClick={() => go(k)}>{l}</button>)}
        </nav>
      </div>
    </header>
  )
}

function CityMap({ w = 640, h = 520, numbered = true, focus }: { w?: number; h?: number; numbered?: boolean; focus?: [number, number] }) {
  const scale = 500 / metresPerUnit(w)
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="a-map" role="img" aria-label="Map of Demo City reports and hotspots">
      <rect width={w} height={h} fill="#F6F3EE" />
      <path d={`M0 ${h * .1} C ${w * .06} ${h * .3}, ${w * .02} ${h * .6}, ${w * .07} ${h}`} fill="none" stroke="#111" strokeWidth=".8" />
      <path d={`M0 0 L0 ${h} L${w * .07} ${h} C ${w * .02} ${h * .6}, ${w * .06} ${h * .3}, 0 ${h * .1}`} fill="#E9E4DA" />
      {[.18, .34, .52, .7, .86].map((t, i) => <line key={i} x1={w * .07} x2={w} y1={h * t} y2={h * t + (i % 2 ? 14 : -10)} stroke="#D8D2C6" strokeWidth=".8" />)}
      {[.25, .45, .62, .8].map((t, i) => <line key={i} y1={0} y2={h} x1={w * t} x2={w * t + (i % 2 ? -18 : 12)} stroke="#D8D2C6" strokeWidth=".8" />)}
      <path d={`M${w * .1} ${h * .62} C ${w * .4} ${h * .58}, ${w * .55} ${h * .44}, ${w} ${h * .4}`} fill="none" stroke="#111" strokeWidth="2.2" />
      <path d={`M${w * .46} 0 C ${w * .5} ${h * .3}, ${w * .56} ${h * .6}, ${w * .62} ${h}`} fill="none" stroke="#111" strokeWidth="2.2" />
      {D.reports.map((r) => {
        const p = project(r.lat, r.lng, w, h, 30)
        const closed = r.status === 'resolved' || r.status === 'rejected'
        return <circle key={r.id} cx={p.x} cy={p.y} r={closed ? 2.4 : r.level === 'critical' ? 5 : 3.4}
          fill={closed ? 'none' : r.level === 'critical' ? '#6E1423' : '#111'} stroke={closed ? '#999' : 'none'} />
      })}
      {numbered && D.hotspots.map((hs, i) => {
        const p = project(hs.lat, hs.lng, w, h, 30)
        const r = 18 + hs.count * 4
        const left = p.x > w * .62
        const lx = left ? p.x - r - 40 : p.x + r + 40
        return (
          <g key={hs.id}>
            <circle cx={p.x} cy={p.y} r={r} fill="none" stroke="#6E1423" strokeWidth="1" />
            <line x1={left ? p.x - r : p.x + r} y1={p.y} x2={lx} y2={p.y} stroke="#6E1423" strokeWidth=".8" />
            <circle cx={lx} cy={p.y} r="11" fill="#6E1423" />
            <text x={lx} y={p.y + 4} textAnchor="middle" className="a-map__n">{i + 1}</text>
          </g>
        )
      })}
      {focus && (() => { const p = project(focus[0], focus[1], w, h, 30); return <g><circle cx={p.x} cy={p.y} r="16" fill="none" stroke="#6E1423" strokeWidth="1.5" /><circle cx={p.x} cy={p.y} r="6" fill="#6E1423" /></g> })()}
      <g transform={`translate(${w - 30 - scale} ${h - 22})`}>
        <line x2={scale} stroke="#111" strokeWidth="1.5" /><text y="-6" className="a-map__s">500 m</text>
      </g>
    </svg>
  )
}

function Landing({ go }: { go: (s: Screen) => void }) {
  const m = D.metrics
  const lead = D.hotspots[0]
  return (
    <>
      <section className="a-cover">
        <div className="a-cover__text">
          <p className="a-kicker">Cover story · Civic intelligence</p>
          <h1 className="a-h1">The city speaks in complaints. <em>We listen for the signal.</em></h1>
          <p className="a-dek">CivicPulse reads every report, links the ones that describe the same problem, scores what is dangerous and shows the ward office — and you — where to act first.</p>
          <div className="a-ctas">
            <button className="a-btn" onClick={() => go('report')}>File a report</button>
            <button className="a-link" onClick={() => go('map')}>Read the city atlas →</button>
          </div>
        </div>
        <figure className="a-cover__fig">
          <CityMap />
          <figcaption><b>Fig. 1</b> — {m.open} open reports in Demo City. Numbered rings mark hotspots found by clustering; oxblood marks critical.</figcaption>
        </figure>
      </section>
      <section className="a-numbers">
        {[[m.total, 'reports filed', 'all channels'], [m.open, 'still open', `${m.unassigned_open} not yet assigned`], [m.critical_open, 'critical', 'safety first'], [`${Math.round(m.resolution_rate)}%`, 'resolved', `avg ${(m.avg_resolution_hours / 24).toFixed(1)} days`]].map(([n, l, s]) => (
          <div key={String(l)}><b>{n}</b><span>{l}</span><small>{s}</small></div>
        ))}
      </section>
      <section className="a-lead">
        <div className="a-lead__label"><span>The lead</span><b>{lead.id}</b></div>
        <div className="a-lead__body">
          <h2 className="a-h2">{lead.location}: {lead.count} reports, one drain.</h2>
          <p className="a-drop">{lead.reason} The engine’s suggested intervention: {lead.intervention.toLowerCase()}. Lead department — {lead.department}.</p>
        </div>
        <ol className="a-contents">
          <li><span>01</span><div><b>Capture</b><p>Report in two minutes — words, a pin, a photo.</p></div></li>
          <li><span>02</span><div><b>Understand</b><p>Category, summary, duplicates and a 0–100 score, each with its reasons.</p></div></li>
          <li><span>03</span><div><b>Reveal</b><p>Clusters become hotspots on the city atlas.</p></div></li>
          <li><span>04</span><div><b>Act</b><p>The ward desk assigns and updates; you follow every step.</p></div></li>
        </ol>
      </section>
      <section className="a-wire">
        <h3 className="a-label">The wire — latest filings</h3>
        {D.reports.slice(0, 5).map((r) => (
          <article key={r.id}><span className="a-mono">{r.id}</span><p><b>{r.label}.</b> {r.headline}</p><span className="a-meta">{r.location} · {r.ago}</span></article>
        ))}
      </section>
    </>
  )
}

function Report() {
  const [cat, setCat] = useState('waterlogging')
  const f = D.featured
  return (
    <section className="a-form">
      <div className="a-form__head">
        <p className="a-kicker">Letters to the ward · No account needed</p>
        <h1 className="a-h1 a-h1--s">Tell us what you saw.</h1>
      </div>
      <div className="a-form__grid">
        <form className="a-form__main" onSubmit={(e) => e.preventDefault()}>
          <fieldset>
            <legend><span>I.</span> What kind of problem?</legend>
            <ol className="a-cats">
              {CATS.map(([k, l], i) => <li key={k}><button type="button" className={cat === k ? 'is-on' : ''} onClick={() => setCat(k)}><span>{String(i + 1).padStart(2, '0')}</span>{l}</button></li>)}
            </ol>
          </fieldset>
          <fieldset>
            <legend><span>II.</span> In your words</legend>
            <textarea className="a-area" defaultValue={f.description} rows={4} aria-label="Description" />
            <p className="a-aside-inline">Reading as <b>{f.label}</b> — {Math.round(f.confidence * 100)}% sure, from “{f.evidence.slice(0, 2).join('”, “')}”.</p>
          </fieldset>
          <fieldset>
            <legend><span>III.</span> Where</legend>
            <input className="a-line" defaultValue={f.location} aria-label="Location" />
            <div className="a-form__map"><CityMap w={560} h={260} numbered={false} focus={[f.lat, f.lng]} /><span className="a-mono">{f.lat.toFixed(5)}, {f.lng.toFixed(5)} · tap to move the pin</span></div>
          </fieldset>
          <fieldset>
            <legend><span>IV.</span> A photograph <i>(optional)</i></legend>
            <div className="a-photo"><span>Drop a photo, or take one</span><small>JPEG · PNG · WebP — up to 5 MB</small></div>
          </fieldset>
          <button className="a-btn a-btn--lg">Submit the report</button>
        </form>
        <aside className="a-margin">
          <p className="a-label">In the margin</p>
          <p>Your name and number are seen only by the ward office.</p>
          <p>If a neighbour has reported the same thing, the two reports are <em>linked</em> — never deleted — and the priority rises.</p>
          <p>You’ll receive a filing number like <span className="a-mono">{f.id}</span> to follow progress.</p>
        </aside>
      </div>
    </section>
  )
}

function Command() {
  const m = D.metrics
  const top = byScore[0]
  const max = Math.max(...D.trend.map((t) => t.received))
  return (
    <section className="a-desk">
      <div className="a-desk__head">
        <p className="a-kicker">The Ward Desk · Morning edition</p>
        <h1 className="a-h1 a-h1--s">{m.critical_open} critical reports lead today’s agenda.</h1>
      </div>
      <div className="a-desk__grid">
        <article className="a-desk__story">
          <p className="a-label">Page one</p>
          <h2 className="a-h2">{top.headline}</h2>
          <p className="a-meta">{top.id} · {top.label} · {top.location} · score {top.score}</p>
          <ol className="a-agenda">
            {byScore.slice(1, 7).map((r, i) => (
              <li key={r.id}><span className="a-num">{i + 2}</span><div><b>{r.headline}</b><p className="a-meta">{r.location} · {r.dept ?? 'Unassigned'} · {STATUS[r.status]}</p></div><span className={`a-score a-score--${r.level}`}>{r.score}</span></li>
            ))}
          </ol>
        </article>
        <div className="a-desk__side">
          <div className="a-figs">
            {[[m.open, 'Open'], [m.high_open, 'High'], [m.resolved, 'Resolved'], [m.linked_duplicates, 'Linked dup.']].map(([n, l]) => <div key={String(l)}><b>{n}</b><span>{l}</span></div>)}
          </div>
          <div>
            <p className="a-label">Reports, last 21 days</p>
            <svg viewBox="0 0 420 110" className="a-spark" role="img" aria-label="Daily reports received and resolved">
              {D.trend.map((t, i) => <g key={i}>
                <rect x={i * 20} y={100 - (t.received / max) * 90} width="8" height={(t.received / max) * 90} fill="#111" />
                <rect x={i * 20 + 9} y={100 - (t.resolved / max) * 90} width="8" height={(t.resolved / max) * 90} fill="#C9B79C" />
              </g>)}
              <line x1="0" x2="420" y1="100.5" y2="100.5" stroke="#111" />
            </svg>
            <p className="a-meta"><span className="a-key" style={{ background: '#111' }} />received <span className="a-key" style={{ background: '#C9B79C' }} />resolved</p>
          </div>
          <div>
            <p className="a-label">Who carries the load</p>
            <table className="a-table"><tbody>{D.workload.map((w) => <tr key={w.label}><td>{w.label}</td><td><span className="a-bar"><i style={{ width: `${w.open * 18}%` }} /></span></td><td className="a-mono">{w.open}</td></tr>)}</tbody></table>
          </div>
        </div>
      </div>
    </section>
  )
}

function MapScreen() {
  return (
    <section className="a-atlas">
      <div className="a-desk__head">
        <p className="a-kicker">The City Atlas · Hotspots</p>
        <h1 className="a-h1 a-h1--s">Five places where problems gather.</h1>
      </div>
      <div className="a-atlas__grid">
        <figure className="a-atlas__fig"><CityMap w={760} h={600} /><figcaption>Clusters: DBSCAN, 350 m, at least three open reports. Ring size follows report count.</figcaption></figure>
        <ol className="a-captions">
          {D.hotspots.map((h, i) => (
            <li key={h.id}>
              <span className="a-num a-num--ink">{i + 1}</span>
              <div>
                <h3>{h.location}</h3>
                <p className="a-meta">{h.ward} · {h.count} reports · {h.critical_count} critical · avg {Math.round(h.avg_priority)}</p>
                <p>{h.intervention}.</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

function Track() {
  const f = D.featured
  const cur = 3
  return (
    <article className="a-track">
      <header className="a-track__head">
        <p className="a-kicker">{f.label} · Filing {f.id}</p>
        <h1 className="a-h1 a-h1--s">Knee-deep water at the Central Bus Stand</h1>
        <p className="a-byline">Filed by a citizen, 30 October, 08:42 · {f.location}, {f.ward}</p>
      </header>
      <div className="a-track__grid">
        <div>
          <ol className="a-chapters">
            {STEPS.map((s, i) => <li key={s} className={i < cur ? 'done' : i === cur ? 'now' : ''}><span>{ROMAN[i]}</span>{s}</li>)}
          </ol>
          <div className="a-story">
            {[...f.timeline].reverse().map((t, i) => (
              <div key={i} className="a-entry"><p className="a-meta">{t.at} — {t.who}</p><p>{t.status && <b>{t.status}. </b>}{t.msg}</p></div>
            ))}
          </div>
        </div>
        <aside className="a-track__side">
          <div className="a-bigscore"><b>{f.score}</b><span>/100 · {LV[f.level]}</span></div>
          <p className="a-dek a-dek--s">{f.reasoning}</p>
          <table className="a-table a-table--factors"><tbody>
            {f.factors.map((x) => <tr key={x.label}><td>{x.label}</td><td><span className="a-bar a-bar--ox"><i style={{ width: `${(x.points / x.weight) * 100}%` }} /></span></td><td className="a-mono">{Math.round(x.points)}/{x.weight}</td></tr>)}
          </tbody></table>
          <p className="a-label">Assigned</p>
          <p>{f.dept} · respond {f.respond}</p>
        </aside>
      </div>
    </article>
  )
}

export function Atlas({ screen, go }: ConceptProps) {
  return (
    <div className="c-atlas">
      <Masthead screen={screen} go={go} />
      <main className="a-main">
        {screen === 'landing' && <Landing go={go} />}
        {screen === 'report' && <Report />}
        {screen === 'command' && <Command />}
        {screen === 'map' && <MapScreen />}
        {screen === 'track' && <Track />}
      </main>
      <footer className="a-foot"><span className="a-word a-word--s">CivicPulse<em>.</em></span><span>Synthetic data · fictional wards · deterministic, explainable analysis</span></footer>
    </div>
  )
}
