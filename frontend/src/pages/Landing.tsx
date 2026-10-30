import { ArrowRight, ArrowUpRight, Copy, GitMerge, Layers, MapPinned, ScanText, Scale, Siren } from 'lucide-react'
import { Link } from 'react-router-dom'
import { CityPlate } from '../components/CityPlate'
import { CategoryTag, ErrorState, LiveIndicator, PriorityBadge, ScoreBreakdown, Skeleton, StatusPill } from '../components/ui'
import { api } from '../lib/api'
import { CATEGORY_KEYS, CATEGORY_META } from '../lib/constants'
import { fmtHours, timeAgo } from '../lib/format'
import { useLiveQuery } from '../store/live'

const STAGES = [
  { n: '01', name: 'Capture', text: 'A citizen reports with a description, a pin on the map and a photo. No account, no forms to decode. They get a tracking ID immediately.', algo: 'Validated intake · image checks · coordinates' },
  { n: '02', name: 'Understand', text: 'The engine classifies the issue, writes a factual summary, looks for duplicates nearby and scores urgency from 0 to 100 — showing every reason.', algo: 'Weighted lexicon classifier · TF-IDF cosine · geo + time proximity' },
  { n: '03', name: 'Reveal', text: 'Reports are clustered on the map. Recurring problems and multi-issue blocks surface as hotspots, ranked by risk, not by who complained loudest.', algo: 'DBSCAN over haversine distance (350 m)' },
  { n: '04', name: 'Act', text: 'The ward office assigns departments and officers, posts progress, resolves with a note — and the citizen sees each step on their tracking page.', algo: 'Audited workflow · live sync over Server-Sent Events' },
]

const PROBLEMS = [
  ['The same pothole, reported eleven times.', 'Duplicates are linked, not deleted — each citizen keeps their ID, the office sees one problem.'],
  ['A live wire waits behind a garbage complaint.', 'Every report gets an explainable 0–100 priority. Safety risk carries the most weight.'],
  ['Nobody can say what to fix first.', 'The action brief ranks interventions from hotspots and critical reports.'],
  ['The drain floods every monsoon. Every year it is “new”.', 'Recurrence and geographic concentration raise priority and flag root-cause fixes.'],
  ['Citizens never hear back.', 'A public timeline shows status, department and resolution notes in real time.'],
]

const ENGINE = [
  { icon: ScanText, name: 'Classification', text: 'Reads the description and predicts the category with a confidence score and the exact phrases that decided it. Low confidence goes to a human.' },
  { icon: Layers, name: 'Summarisation', text: 'Extracts what happened, where, who is affected, safety concerns and urgency cues. It never adds facts that weren’t written.' },
  { icon: Copy, name: 'Duplicate detection', text: 'Compares wording (TF-IDF), category, distance and time. Matches are linked with reasons — never auto-merged.' },
  { icon: Scale, name: 'Priority scoring', text: 'Six documented factors: safety, severity, urgency, public impact, recurrence and concentration. Weights sum to 100.' },
  { icon: MapPinned, name: 'Hotspot detection', text: 'Density clustering finds blocks with repeated or mixed problems. Map, dashboard and brief share one calculation.' },
  { icon: Siren, name: 'Action briefs', text: 'Separates what the data shows from what the rules suggest, and orders interventions by risk.' },
]

export function Landing() {
  const stats = useLiveQuery(() => api.stats())
  const map = useLiveQuery(() => api.publicMap())
  const recent = useLiveQuery(() => api.publicReports(8))
  const s = stats.data
  const m = s?.metrics
  const catMax = Math.max(1, ...(s?.categories.map((c) => c.total) ?? [1]))

  return (
    <div className="landing">
      {/* ---------------- HERO ---------------- */}
      <section className="hero wrap">
        <div className="hero__copy">
          <div className="hero__kicker">
            <span className="eyebrow">Civic intelligence · {s?.demo_area.name ?? 'Demo City'}</span>
            <LiveIndicator />
          </div>
          <h1 className="hero__title serif">Every complaint<br />is a <em>signal</em>.</h1>
          <p className="hero__lede">
            CivicPulse reads what citizens report, links the duplicates, scores what is dangerous, finds where problems
            cluster — and shows everyone what happens next.
          </p>
          <div className="hero__ctas">
            <Link to="/report" className="btn btn--signal">Report an issue <ArrowRight /></Link>
            <Link to="/command" className="btn btn--ghost">Explore city intelligence</Link>
          </div>
          <dl className="ledger">
            {m ? (
              <>
                <div><dt>Reports logged</dt><dd>{m.total}</dd></div>
                <div><dt>Open now</dt><dd>{m.open}</dd></div>
                <div className="is-signal"><dt>Critical, open</dt><dd>{m.critical_open}</dd></div>
                <div><dt>Resolution rate</dt><dd>{Math.round(m.resolution_rate)}<small>%</small></dd></div>
              </>
            ) : stats.error ? <ErrorState error={stats.error} onRetry={stats.reload} /> : [0, 1, 2, 3].map((i) => <div key={i}><Skeleton h={54} /></div>)}
          </dl>
        </div>
        <figure className="plate">
          <div className="plate__frame">
            {map.data && s ? <CityPlate reports={map.data} hotspots={s.hotspots} /> : <Skeleton h={520} />}
          </div>
          <figcaption className="plate__caption">
            <span className="mono">Fig. 1</span> Every open report in {s?.demo_area.name ?? 'Demo City'}, coloured by priority.
            Dashed rings are hotspots found by clustering — recalculated with each new report.
            <span className="plate__legend">
              <i style={{ background: 'var(--critical)' }} />Critical <i style={{ background: 'var(--high)' }} />High
              <i style={{ background: 'var(--medium)' }} />Medium <i style={{ background: 'var(--low)' }} />Low
              <i className="hollow" />Closed
            </span>
          </figcaption>
        </figure>
      </section>

      {/* ---------------- PROBLEM ---------------- */}
      <section className="problem">
        <div className="wrap problem__grid">
          <div className="problem__head">
            <span className="eyebrow">The problem</span>
            <h2 className="serif display-2">Calls, messages, posts, visits. <em>One queue, no memory.</em></h2>
            <p className="muted">Ward offices don’t lack complaints. They lack a way to see which ones are the same, which ones are dangerous and which ones keep coming back.</p>
          </div>
          <ol className="problem__list">
            {PROBLEMS.map(([p, a], i) => (
              <li key={i}>
                <span className="mono problem__n">{String(i + 1).padStart(2, '0')}</span>
                <div><p className="problem__p serif">{p}</p><p className="problem__a">{a}</p></div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ---------------- HOW IT WORKS ---------------- */}
      <section id="how" className="how wrap">
        <div className="section-head">
          <span className="eyebrow">How it works</span>
          <h2 className="serif display-2">Four stages, from a phone in the rain to a crew on site.</h2>
        </div>
        <ol className="stages">
          {STAGES.map((st) => (
            <li key={st.n} className="stage">
              <span className="stage__n serif">{st.n}</span>
              <h3 className="stage__name">{st.name}</h3>
              <p>{st.text}</p>
              <p className="stage__algo mono">{st.algo}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* ---------------- ENGINE ---------------- */}
      <section className="engine">
        <div className="wrap engine__grid">
          <div>
            <span className="eyebrow eyebrow--light">Inside the engine</span>
            <h2 className="serif display-2">Intelligence you can audit.</h2>
            <p className="engine__lede">No black box. Every decision CivicPulse makes is produced by documented algorithms and comes with the evidence behind it — so an officer can agree, disagree, or correct it.</p>
            <ul className="engine__list">
              {ENGINE.map(({ icon: Icon, name, text }) => (
                <li key={name}><Icon aria-hidden /><div><h3>{name}</h3><p>{text}</p></div></li>
              ))}
            </ul>
          </div>
          <aside className="specimen" aria-label="Live example of a priority score">
            <div className="specimen__head">
              <span className="eyebrow">Live specimen · highest-priority open report</span>
            </div>
            {s?.engine_example ? (
              <>
                <div className="specimen__top">
                  <div>
                    <span className="id">{s.engine_example.id}</span>
                    <p className="specimen__title serif">{s.engine_example.headline}</p>
                    <p className="muted small">{s.engine_example.category_label} · {s.engine_example.location_text}</p>
                  </div>
                  <div className="score-dial"><b>{s.engine_example.priority.score}</b><span>/100</span></div>
                </div>
                <PriorityBadge level={s.engine_example.priority.level} />
                <ScoreBreakdown factors={s.engine_example.priority.factors} />
                <p className="specimen__reason">{s.engine_example.priority.reasoning}</p>
              </>
            ) : <Skeleton h={320} />}
          </aside>
        </div>
      </section>

      {/* ---------------- CITY PULSE ---------------- */}
      <section id="pulse" className="pulse wrap">
        <div className="section-head section-head--row">
          <div>
            <span className="eyebrow">City pulse</span>
            <h2 className="serif display-2">Where the city is hurting right now.</h2>
          </div>
          <Link to="/command/hotspots" className="btn btn--ghost btn--sm">All hotspots <ArrowUpRight /></Link>
        </div>
        <div className="pulse__grid">
          <div className="hotspot-list">
            {s ? s.hotspots.slice(0, 4).map((h, i) => (
              <article key={h.id} className={`hs ${i === 0 ? 'hs--lead' : ''}`}>
                <div className="hs__rank serif">{h.id}</div>
                <div className="hs__body">
                  <h3>{h.location}</h3>
                  <p className="muted small">{h.ward} · {h.dominant_label}</p>
                  <p className="hs__reason">{h.reason}</p>
                </div>
                <dl className="hs__nums">
                  <div><dt>Reports</dt><dd>{h.count}</dd></div>
                  <div><dt>Critical</dt><dd className={h.critical_count ? 'is-signal' : ''}>{h.critical_count}</dd></div>
                  <div><dt>Avg score</dt><dd>{Math.round(h.avg_priority)}</dd></div>
                </dl>
              </article>
            )) : <Skeleton h={300} />}
            {s && s.hotspots.length === 0 && <p className="muted">No clusters of open reports right now.</p>}
          </div>
          <div className="categories">
            <h3 className="label">Reports by category <span className="muted">· open / total</span></h3>
            <ul>
              {CATEGORY_KEYS.map((k) => {
                const c = s?.categories.find((x) => x.key === k)
                const Icon = CATEGORY_META[k].icon
                return (
                  <li key={k}>
                    <Icon aria-hidden />
                    <div className="cat__name">
                      <span>{CATEGORY_META[k].label}</span>
                      <span className="cat__bar"><span style={{ width: `${((c?.total ?? 0) / catMax) * 100}%` }}><span style={{ width: c?.total ? `${(c.open / c.total) * 100}%` : 0 }} /></span></span>
                    </div>
                    <span className="mono cat__n">{c?.open ?? 0}<small>/{c?.total ?? 0}</small></span>
                  </li>
                )
              })}
            </ul>
            <p className="muted small">Average time to resolve: <strong className="mono">{fmtHours(m?.avg_resolution_hours ?? null)}</strong>
              {m?.avg_resolution_note ? ` (${m.avg_resolution_note.toLowerCase()})` : ''} · {m?.linked_duplicates ?? 0} duplicate reports linked</p>
          </div>
        </div>
      </section>

      {/* ---------------- RECENT ---------------- */}
      <section className="recent wrap">
        <div className="section-head section-head--row">
          <div>
            <span className="eyebrow">Recent reports</span>
            <h2 className="serif display-3">Public ledger</h2>
          </div>
          <p className="muted small recent__note">Names, contacts and photos are never shown publicly.</p>
        </div>
        <ul className="ledger-list">
          {recent.data?.map((r) => (
            <li key={r.id}>
              <Link to={`/track/${r.id}`} className="ledger-row">
                <span className="id">{r.id}</span>
                <span className="ledger-row__main">
                  <CategoryTag category={r.category} />
                  <span className="ledger-row__headline">{r.headline}</span>
                  <span className="muted small">{r.location_text}</span>
                </span>
                <PriorityBadge level={r.priority_level} />
                <StatusPill status={r.status} />
                <span className="muted small mono ledger-row__time">{timeAgo(r.created_at)}</span>
              </Link>
            </li>
          )) ?? <Skeleton h={240} />}
        </ul>
      </section>

      {/* ---------------- CTA ---------------- */}
      <section className="cta">
        <div className="wrap cta__inner">
          <h2 className="serif cta__title">Seen something broken?<br /><em>Tell the city.</em></h2>
          <div className="cta__side">
            <p>Two minutes, no account. You’ll get an ID and see every step the ward office takes.</p>
            <div className="hero__ctas">
              <Link to="/report" className="btn btn--signal">Report an issue <ArrowRight /></Link>
              <Link to="/track" className="btn btn--ghost btn--on-dark"><GitMerge />Track a report</Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
