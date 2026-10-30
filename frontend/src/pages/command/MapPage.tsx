import { List, Map as MapIcon, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CityMap } from '../../components/CityMap'
import { PageHead } from '../../components/command'
import { CategoryTag, ErrorState, PriorityBadge, StatusPill } from '../../components/ui'
import { api } from '../../lib/api'
import { CATEGORY_KEYS, CATEGORY_META, LEVEL_COLOR } from '../../lib/constants'
import { LEVEL_ORDER, OPEN, STATUS_LABEL, timeAgo } from '../../lib/format'
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
  const [view, setView] = useState<'map' | 'list'>('map')

  const rows = useMemo(() => (reports.data ?? []).filter((r) =>
    (!cat || r.category === cat) && (!pri || r.priority_level === pri) &&
    (st === 'all' || (st === 'open' ? OPEN.includes(r.status) : r.status === st))
  ).sort((a, b) => b.priority_score - a.priority_score), [reports.data, cat, pri, st])
  const selected = rows.find((r) => r.id === sel) ?? (reports.data ?? []).find((r) => r.id === sel)
  const fit = `${cat}${pri}${st}`

  if (reports.error) return <ErrorState error={reports.error} onRetry={reports.reload} />

  return (
    <div className="cpage cpage--map">
      <PageHead eyebrow="Reveal · Live city map" title="Live city map">
        {rows.length} reports shown · {hotspots.data?.length ?? 0} hotspots (DBSCAN, 350 m, ≥3 open reports). Updates as reports arrive.
      </PageHead>
      <div className="filters filters--map">
        <select className="select" aria-label="Category" value={cat} onChange={(e) => setCat(e.target.value)}>
          <option value="">All categories</option>
          {CATEGORY_KEYS.map((k) => <option key={k} value={k}>{CATEGORY_META[k].label}</option>)}
        </select>
        <select className="select" aria-label="Priority" value={pri} onChange={(e) => setPri(e.target.value)}>
          <option value="">All priorities</option>
          {LEVEL_ORDER.map((l) => <option key={l} value={l}>{l[0].toUpperCase() + l.slice(1)}</option>)}
        </select>
        <select className="select" aria-label="Status" value={st} onChange={(e) => setSt(e.target.value)}>
          <option value="open">Open</option><option value="all">All statuses</option>
          {(Object.keys(STATUS_LABEL) as Status[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
        </select>
        <label className="toggle"><input type="checkbox" checked={showHs} onChange={(e) => setShowHs(e.target.checked)} />Show hotspots</label>
        <div className="seg seg--view" role="tablist" aria-label="View">
          <button role="tab" aria-selected={view === 'map'} className={view === 'map' ? 'is-on' : ''} onClick={() => setView('map')}><MapIcon size={15} />Map</button>
          <button role="tab" aria-selected={view === 'list'} className={view === 'list' ? 'is-on' : ''} onClick={() => setView('list')}><List size={15} />List</button>
        </div>
        <ul className="map-legend">
          {LEVEL_ORDER.map((l) => <li key={l}><i style={{ background: LEVEL_COLOR[l] }} />{l}</li>)}
          <li><i className="ring" />hotspot</li>
        </ul>
      </div>

      <div className={`mapview mapview--${view}`}>
        <div className="mapview__map">
          <CityMap height="100%" points={rows.map((r) => ({ id: r.id, lat: r.lat, lng: r.lng, level: r.priority_level, status: r.status, title: r.headline, score: r.priority_score }))}
            hotspots={hotspots.data ?? []} showHotspots={showHs} selectedId={sel} onSelect={setSel} fitKey={fit}
            flyTo={selected?.lat != null ? [selected.lat, selected.lng!] : null} />
          {selected && (
            <div className="mapcard" role="dialog" aria-label={`Report ${selected.id}`}>
              <button className="btn btn--quiet btn--sm mapcard__x" aria-label="Close" onClick={() => setSel(null)}><X /></button>
              <span className="id">{selected.id}</span>
              <strong>{selected.headline}</strong>
              <CategoryTag category={selected.category} label={selected.category_label} />
              <span className="muted small">{selected.location_text}</span>
              <div className="mapcard__row"><PriorityBadge level={selected.priority_level} score={selected.priority_score} /><StatusPill status={selected.status} /></div>
              <span className="muted small">{selected.department_label ?? 'Unassigned'} · {timeAgo(selected.created_at)}</span>
              <Link to={`/command/reports/${selected.id}`} className="btn btn--civic btn--sm">Open report</Link>
            </div>
          )}
        </div>
        <ul className="mapview__list">
          {rows.map((r) => (
            <li key={r.id}>
              <button className={`maprow ${sel === r.id ? 'is-on' : ''}`} onClick={() => { setSel(r.id); setView('map') }}>
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
