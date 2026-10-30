import { Flame, List, Map as MapIcon, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CityMap } from '../../components/CityMap'
import { CategoryTag, ErrorState, PriorityBadge, StatusPill } from '../../components/ui'
import { api } from '../../lib/api'
import { CATEGORY_KEYS, CATEGORY_META, LEVEL_COLOR } from '../../lib/constants'
import { LEVEL_LABEL, LEVEL_ORDER, OPEN, STATUS_LABEL, timeAgo } from '../../lib/format'
import type { Status } from '../../lib/types'
import { useLiveQuery } from '../../store/live'

export function MapPage() {
  const reports = useLiveQuery(() => api.reports())
  const hotspots = useLiveQuery(() => api.hotspots())
  const [cat, setCat] = useState('')
  const [pri, setPri] = useState('')
  const [st, setSt] = useState('open')
  const [showHs, setShowHs] = useState(true)
  const [sel, setSel] = useState<string | null>(null)
  const [selHs, setSelHs] = useState<string | null>(null)
  const [view, setView] = useState<'map' | 'list'>('map')

  const rows = useMemo(() => (reports.data ?? []).filter((r) =>
    (!cat || r.category === cat) && (!pri || r.priority_level === pri) &&
    (st === 'all' || (st === 'open' ? OPEN.includes(r.status) : r.status === st))
  ).sort((a, b) => b.priority_score - a.priority_score), [reports.data, cat, pri, st])
  const selected = (reports.data ?? []).find((r) => r.id === sel)
  const hs = hotspots.data ?? []
  const hsSel = hs.find((h) => h.id === selHs) ?? (sel ? null : hs[0] ?? null)
  const fit = `${cat}${pri}${st}`
  const byLevel = Object.fromEntries(LEVEL_ORDER.map((l) => [l, rows.filter((r) => r.priority_level === l).length]))
  const byCat = Object.fromEntries(CATEGORY_KEYS.map((k) => [k, rows.filter((r) => r.category === k).length]))
  const pickReport = (id: string) => { setSel(id); setSelHs(null); setView('map') }
  const pickHotspot = (id: string) => { setSelHs(id); setSel(null) }
  // Fly to a hotspot only when the user picks one; on first load the map fits the whole city.
  const hsTarget = selHs && hsSel && !sel ? [hsSel.lat, hsSel.lng] as [number, number] : null

  if (reports.error) return <ErrorState error={reports.error} onRetry={reports.reload} />

  return (
    <div className="cpage omap">
      <header className="omap__head">
        <div>
          <h1 className="serif cpage__title">City Intelligence Map</h1>
          <p className="cpage__lede">{rows.length} reports shown · {hs.length} hotspots found by clustering open reports (350 m, ≥ 3 reports). Updates as reports arrive.</p>
        </div>
        <div className="omap__filters">
          <select className="select" aria-label="Category" value={cat} onChange={(e) => setCat(e.target.value)}>
            <option value="">All categories</option>
            {CATEGORY_KEYS.map((k) => <option key={k} value={k}>{CATEGORY_META[k].label}</option>)}
          </select>
          <select className="select" aria-label="Priority" value={pri} onChange={(e) => setPri(e.target.value)}>
            <option value="">All priorities</option>
            {LEVEL_ORDER.map((l) => <option key={l} value={l}>{LEVEL_LABEL[l]}</option>)}
          </select>
          <select className="select" aria-label="Status" value={st} onChange={(e) => setSt(e.target.value)}>
            <option value="open">Open</option><option value="all">All statuses</option>
            {(Object.keys(STATUS_LABEL) as Status[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
          </select>
          <label className="toggle"><input type="checkbox" checked={showHs} onChange={(e) => setShowHs(e.target.checked)} />Hotspots</label>
          <div className="seg seg--view" role="tablist" aria-label="View">
            <button role="tab" aria-selected={view === 'map'} className={view === 'map' ? 'is-on' : ''} onClick={() => setView('map')}><MapIcon size={15} />Map</button>
            <button role="tab" aria-selected={view === 'list'} className={view === 'list' ? 'is-on' : ''} onClick={() => setView('list')}><List size={15} />List</button>
          </div>
        </div>
      </header>

      <div className={`omap__stage omap__stage--${view}`}>
        <div className="omap__map">
          <CityMap height="100%" noticeAt="bottom-center" fitPadding={typeof window !== 'undefined' && window.innerWidth > 900 ? [40, 350, 70, 220] : [30, 30, 30, 30]}
            points={rows.map((r) => ({ id: r.id, lat: r.lat, lng: r.lng, level: r.priority_level, status: r.status, title: r.headline, score: r.priority_score }))}
            hotspots={hs} showHotspots={showHs} selectedId={sel} onSelect={pickReport} fitKey={fit}
            onHotspot={pickHotspot} selectedHotspot={hsSel && !sel ? hsSel.id : null}
            flyTo={selected?.lat != null ? [selected.lat, selected.lng!] : hsTarget} />

          <aside className="omap__legend" aria-label="Map legend and counts">
            <h3>Map legend</h3>
            <ul>
              {LEVEL_ORDER.map((l) => (
                <li key={l}><button className={pri === l ? 'is-on' : ''} onClick={() => setPri(pri === l ? '' : l)}>
                  <i style={{ background: LEVEL_COLOR[l], boxShadow: `0 0 8px ${LEVEL_COLOR[l]}` }} />{LEVEL_LABEL[l]}<b className="mono">{byLevel[l]}</b>
                </button></li>
              ))}
            </ul>
            <ul className="omap__cats">
              {CATEGORY_KEYS.filter((k) => byCat[k] || cat === k).map((k) => {
                const Icon = CATEGORY_META[k].icon
                return (
                  <li key={k}><button className={cat === k ? 'is-on' : ''} onClick={() => setCat(cat === k ? '' : k)}>
                    <Icon aria-hidden />{CATEGORY_META[k].short}<b className="mono">{byCat[k]}</b>
                  </button></li>
                )
              })}
            </ul>
            <p><span className="map-beacon map-beacon--legend" />Hotspot</p>
          </aside>

          {selected ? (
            <section className="omap__panel" aria-label={`Report ${selected.id}`}>
              <button className="btn btn--quiet btn--sm omap__x" aria-label="Close" onClick={() => setSel(null)}><X /></button>
              <span className="omap__kicker"><span className="id">{selected.id}</span></span>
              <h3>{selected.headline}</h3>
              <CategoryTag category={selected.category} label={selected.category_label} />
              <dl>
                <div><dt>Location</dt><dd>{selected.location_text}</dd></div>
                <div><dt>Priority</dt><dd><PriorityBadge level={selected.priority_level} score={selected.priority_score} /></dd></div>
                <div><dt>Status</dt><dd><StatusPill status={selected.status} /></dd></div>
                <div><dt>Department</dt><dd>{selected.department_label ?? 'Unassigned'}</dd></div>
                <div><dt>Reported</dt><dd className="mono">{timeAgo(selected.created_at)}</dd></div>
                {selected.lat != null && <div><dt>Coordinates</dt><dd className="mono">{selected.lat.toFixed(4)}, {selected.lng!.toFixed(4)}</dd></div>}
              </dl>
              <Link to={`/command/reports/${selected.id}`} className="btn btn--signal btn--sm btn--block">View details</Link>
            </section>
          ) : hsSel && showHs ? (
            <section className="omap__panel" aria-label={`Hotspot ${hsSel.id}`}>
              <span className="omap__kicker omap__kicker--hot"><Flame size={14} />Hotspot detected · {hsSel.id}</span>
              <h3>{hsSel.location}</h3>
              <p className="muted small">{hsSel.count} related complaints · {hsSel.ward}</p>
              <dl>
                <div><dt>Main issue</dt><dd>{hsSel.dominant_label}</dd></div>
                <div><dt>Avg. priority</dt><dd className="mono">{Math.round(hsSel.avg_priority)} / 100</dd></div>
                <div><dt>Critical</dt><dd className={`mono ${hsSel.critical_count ? 'is-crit' : ''}`}>{hsSel.critical_count}</dd></div>
                <div><dt>Coordinates</dt><dd className="mono">{hsSel.lat.toFixed(4)}, {hsSel.lng.toFixed(4)}</dd></div>
              </dl>
              <p className="small omap__why">{hsSel.reason}</p>
              <p className="small"><b>Suggested:</b> {hsSel.intervention}.</p>
              <div className="omap__hsnav">
                {hs.map((h) => <button key={h.id} className={h.id === hsSel.id ? 'is-on' : ''} onClick={() => pickHotspot(h.id)}>{h.id}</button>)}
              </div>
              <Link to="/command/hotspots" className="btn btn--signal btn--sm btn--block">View details</Link>
            </section>
          ) : null}
        </div>
        <ul className="omap__list">
          {rows.map((r) => (
            <li key={r.id}>
              <button className={`maprow ${sel === r.id ? 'is-on' : ''}`} onClick={() => pickReport(r.id)}>
                <span className="maprow__top"><span className="id">{r.id}</span><PriorityBadge level={r.priority_level} score={r.priority_score} /></span>
                <span className="maprow__title">{r.headline}</span>
                <span className="muted small">{r.category_label} · {r.location_text}</span>
              </button>
            </li>
          ))}
          {rows.length === 0 && <li className="muted small" style={{ padding: 16 }}>No reports match these filters.</li>}
        </ul>
      </div>
    </div>
  )
}
