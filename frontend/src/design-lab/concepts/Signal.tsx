/* CONCEPT 3 — SIGNAL · Bold & expressive.
   A public-safety poster: caution yellow, black, white and one alarm red. Anton for huge condensed
   numerals, Archivo (variable width) for text. Hazard stripes mark urgency. Map is a hex heat grid. */
import '@fontsource/anton/latin-400.css'
import '@fontsource-variable/archivo/wdth.css'
import { ArrowRight, ArrowUpRight } from 'lucide-react'
import { useMemo, useState } from 'react'
import { byScore, CATS, D, openReports, project, STATUS, STEPS, type ConceptProps, type Screen } from '../data'
import './signal.css'

function Bar({ screen, go }: ConceptProps) {
  const items: [Screen, string][] = [['landing', 'Home'], ['report', 'Report'], ['track', 'Track'], ['map', 'Heat map'], ['command', 'Control']]
  return (
    <header className="s-bar">
      <button className="s-logo" onClick={() => go('landing')}>CIVIC<span>PULSE</span></button>
      <nav className="s-nav">{items.map(([k, l]) => <button key={k} className={screen === k ? 'is-on' : ''} onClick={() => go(k)}>{l}</button>)}</nav>
    </header>
  )
}

const Stripe = ({ thin = false }: { thin?: boolean }) => <div className={`s-stripe ${thin ? 's-stripe--thin' : ''}`} aria-hidden />

function HexHeat({ w = 640, h = 520, labels = true }: { w?: number; h?: number; labels?: boolean }) {
  const R = 30
  const cells = useMemo(() => {
    const hw = Math.sqrt(3) * R
    const map = new Map<string, { x: number; y: number; n: number; crit: number }>()
    for (const r of openReports) {
      const p = project(r.lat, r.lng, w, h, 40)
      const row = Math.round(p.y / (1.5 * R))
      const col = Math.round((p.x - (row % 2) * hw / 2) / hw)
      const k = `${row}:${col}`
      const c = map.get(k) ?? { x: col * hw + (row % 2) * hw / 2, y: row * 1.5 * R, n: 0, crit: 0 }
      c.n++; if (r.level === 'critical') c.crit++
      map.set(k, c)
    }
    return [...map.values()]
  }, [w, h])
  const hex = (x: number, y: number, r: number) => Array.from({ length: 6 }, (_, i) => { const a = Math.PI / 180 * (60 * i - 30); return `${x + r * Math.cos(a)},${y + r * Math.sin(a)}` }).join(' ')
  const grid: [number, number][] = []
  for (let row = 0; row * 1.5 * R < h + R; row++) for (let col = 0; col * Math.sqrt(3) * R < w + R; col++) grid.push([col * Math.sqrt(3) * R + (row % 2) * Math.sqrt(3) * R / 2, row * 1.5 * R])
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="s-heat" role="img" aria-label="Hexagonal heat map of open reports">
      <rect width={w} height={h} fill="#0A0A0A" />
      {grid.map(([x, y], i) => <polygon key={i} points={hex(x, y, R - 2)} fill="none" stroke="#222" strokeWidth="1" />)}
      {cells.map((c, i) => (
        <g key={i}>
          <polygon points={hex(c.x, c.y, R - 2)} fill={c.crit ? '#E63B2E' : '#FFD60A'} opacity={c.crit ? 1 : Math.min(1, .35 + c.n * .2)} />
          <text x={c.x} y={c.y + 7} textAnchor="middle" className="s-heat__n" fill={c.crit ? '#fff' : '#0A0A0A'}>{c.n}</text>
        </g>
      ))}
      {labels && D.hotspots.map((hs) => {
        const p = project(hs.lat, hs.lng, w, h, 40)
        const label = `${hs.id} · ${hs.count}`
        const tw = label.length * 9 + 14
        const right = p.x < w * .7
        const x = right ? p.x + R * 1.3 : p.x - R * 1.3 - tw
        return (
          <g key={hs.id}>
            <line x1={p.x} y1={p.y} x2={right ? x : x + tw} y2={p.y - 34 + 13} stroke="#fff" strokeWidth="1.5" />
            <rect x={x} y={p.y - 34} width={tw} height="26" fill="#fff" />
            <text x={x + 7} y={p.y - 15} className="s-heat__tag">{label}</text>
          </g>
        )
      })}
    </svg>
  )
}

function Landing({ go }: { go: (s: Screen) => void }) {
  const m = D.metrics
  return (
    <>
      <section className="s-hero">
        <p className="s-tag">Demo City · live civic status</p>
        <h1 className="s-giant"><span>{m.open}</span> open.<br /><span className="s-red">{m.critical_open}</span> critical.</h1>
        <p className="s-lede">Fix the dangerous ones first. CivicPulse reads every complaint, scores the risk from 0 to 100 and shows exactly why.</p>
        <div className="s-ctas">
          <button className="s-btn" onClick={() => go('report')}>Report a problem <ArrowRight /></button>
          <button className="s-btn s-btn--line" onClick={() => go('track')}>Track yours</button>
        </div>
      </section>
      <Stripe />
      <section className="s-black s-split">
        <div>
          <p className="s-tag s-tag--y">Where it hurts</p>
          <h2 className="s-h2">{D.hotspots.length} hotspots.<br />Same streets.<br />Again.</h2>
          <ol className="s-hlist">{D.hotspots.map((h) => <li key={h.id}><b>{h.id}</b><span>{h.location}</span><em>{h.count}</em></li>)}</ol>
        </div>
        <HexHeat />
      </section>
      <section className="s-white">
        <div className="s-steps">
          {[['01', 'Capture', 'Words, a pin, a photo. Two minutes.'], ['02', 'Understand', 'Category. Summary. Duplicates. Score 0–100.'], ['03', 'Reveal', 'Problems cluster into hotspots.'], ['04', 'Act', 'A team is assigned. You see each move.']].map(([n, t, d]) => (
            <div key={n}><b>{n}</b><h3>{t}</h3><p>{d}</p></div>
          ))}
        </div>
      </section>
      <section className="s-cats">
        {D.categories.map((c) => <div key={c.key}><b>{c.open}</b><span>{c.label}</span></div>)}
      </section>
    </>
  )
}

function Report() {
  const [cat, setCat] = useState('waterlogging')
  const f = D.featured
  return (
    <section className="s-white s-form">
      <h1 className="s-h1">Report<br />a problem.</h1>
      <div className="s-form__grid">
        <form onSubmit={(e) => e.preventDefault()} className="s-form__main">
          <div className="s-q"><b>1</b><div><h3>What is it?</h3>
            <div className="s-blocks">{CATS.map(([k, l]) => <button type="button" key={k} className={cat === k ? 'is-on' : ''} onClick={() => setCat(k)}>{l}</button>)}</div></div></div>
          <div className="s-q"><b>2</b><div><h3>Tell us. Danger? Who’s affected? How long?</h3>
            <textarea className="s-in" rows={4} defaultValue={f.description} aria-label="Description" />
            <p className="s-read"><span>READ AS</span>{f.label.toUpperCase()} · {Math.round(f.confidence * 100)}%</p></div></div>
          <div className="s-q"><b>3</b><div><h3>Where?</h3>
            <input className="s-in" defaultValue={f.location} aria-label="Location" />
            <div className="s-form__map"><HexHeat w={600} h={240} labels={false} /><span className="s-pin">YOU ARE HERE</span></div></div></div>
          <div className="s-q"><b>4</b><div><h3>Photo <small>(optional)</small></h3><div className="s-drop">+ ADD PHOTO · max 5 MB</div></div></div>
          <button className="s-btn s-btn--xl">Send it <ArrowUpRight /></button>
        </form>
        <aside className="s-note">
          <Stripe thin />
          <p><b>Same problem as your neighbour?</b> Report it anyway. Reports get linked, not deleted — more reports, higher priority.</p>
          <p><b>Private.</b> Your name and number go to the ward office only.</p>
        </aside>
      </div>
    </section>
  )
}

function Command() {
  const m = D.metrics
  const max = Math.max(...D.workload.map((w) => w.open), 1)
  return (
    <section className="s-black s-ctl">
      <div className="s-ctl__head"><h1 className="s-h1 s-h1--y">Control</h1><span className="s-live">● LIVE</span></div>
      <div className="s-tiles">
        <div className="s-tile s-tile--red"><b>{m.critical_open}</b><span>Critical open</span></div>
        <div className="s-tile s-tile--y"><b>{m.high_open}</b><span>High</span></div>
        <div className="s-tile"><b>{m.open}</b><span>Open</span></div>
        <div className="s-tile"><b>{m.unassigned_open}</b><span>No team yet</span></div>
        <div className="s-tile"><b>{Math.round(m.resolution_rate)}%</b><span>Resolved</span></div>
      </div>
      <div className="s-ctl__grid">
        <div>
          <h2 className="s-h3">Danger list</h2>
          <table className="s-table">
            <tbody>
              {byScore.slice(0, 8).map((r) => (
                <tr key={r.id}>
                  <td className={`s-sc s-sc--${r.level}`}>{r.score}</td>
                  <td><b>{r.headline}</b><small>{r.id} · {r.location}</small></td>
                  <td className="s-st">{r.dept ? STATUS[r.status] : <mark>ASSIGN</mark>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div>
          <h2 className="s-h3">Team load</h2>
          {D.workload.map((w) => (
            <div key={w.label} className="s-load"><span>{w.label}</span><i><em style={{ width: `${(w.open / max) * 100}%` }} className={w.critical ? 'is-red' : ''} /></i><b>{w.open}</b></div>
          ))}
          <h2 className="s-h3" style={{ marginTop: 28 }}>21 days</h2>
          <div className="s-cols">{D.trend.map((t, i) => <span key={i} style={{ height: `${t.received * 14 + 4}px` }} title={`${t.label}: ${t.received}`} />)}</div>
        </div>
      </div>
    </section>
  )
}

function MapScreen() {
  return (
    <section className="s-black s-map">
      <h1 className="s-h1 s-h1--y">Heat map</h1>
      <div className="s-map__grid">
        <HexHeat w={760} h={560} />
        <div className="s-map__list">
          {D.hotspots.map((h) => (
            <article key={h.id}>
              <header><b>{h.id}</b><span>{h.count} reports{h.critical_count ? ` · ${h.critical_count} critical` : ''}</span></header>
              <h3>{h.location}</h3>
              <p>{h.intervention}.</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

function Track() {
  const f = D.featured
  const cur = 3
  return (
    <section className="s-track">
      <div className="s-track__top">
        <p className="s-tag">Report {f.id}</p>
        <h1 className="s-giant s-giant--s">In progress.</h1>
        <p className="s-lede">Waterlogging · {f.location}. {f.dept} is on it.</p>
      </div>
      <div className="s-prog">
        {STEPS.map((s, i) => <div key={s} className={i < cur ? 'done' : i === cur ? 'now' : ''}><span>{s}</span></div>)}
      </div>
      <div className="s-black s-track__grid">
        <div className="s-track__score"><b>{f.score}</b><span>/100<br />Critical</span></div>
        <div>
          {f.factors.map((x) => <div key={x.label} className="s-load s-load--w"><span>{x.label}</span><i><em style={{ width: `${(x.points / x.weight) * 100}%` }} /></i><b>{Math.round(x.points)}</b></div>)}
        </div>
        <div className="s-feed">
          {[...f.timeline].reverse().map((t, i) => <div key={i}><small>{t.at} · {t.who}</small><p>{t.status && <b>{t.status.toUpperCase()} </b>}{t.msg}</p></div>)}
        </div>
      </div>
    </section>
  )
}

export function Signal({ screen, go }: ConceptProps) {
  return (
    <div className="c-signal">
      <Bar screen={screen} go={go} />
      {screen === 'landing' && <Landing go={go} />}
      {screen === 'report' && <Report />}
      {screen === 'command' && <Command />}
      {screen === 'map' && <MapScreen />}
      {screen === 'track' && <Track />}
      <footer className="s-foot">CIVICPULSE · DEMO CITY · SYNTHETIC DATA · EXPLAINABLE, RULE-BASED SCORING</footer>
    </div>
  )
}
