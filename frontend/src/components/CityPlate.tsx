/* Hero illustration: an engraved "city plate" drawn in SVG. The streets and coastline are an
   abstract drawing, but every dot and ring is plotted from live report coordinates and the same
   DBSCAN hotspots the authority dashboard uses. */
import { useMemo } from 'react'
import type { PublicReport, PublicStats } from '../lib/types'
import { LEVEL_COLOR } from '../lib/constants'

// Wide panoramic plate. Bounds are derived from the aspect ratio so geography is not stretched:
// ~4.9 km north–south, and the matching east–west span at Demo City's latitude.
const W = 1280
const H = 560
const LAT_C = 12.8705
const LNG_C = 74.8425
const LAT_SPAN = 0.044
const KM_LAT = 111.0
const KM_LNG = 108.5
const LNG_SPAN = (LAT_SPAN * KM_LAT * (W / H)) / KM_LNG
const B = { latMin: LAT_C - LAT_SPAN / 2, latMax: LAT_C + LAT_SPAN / 2, lngMin: LNG_C - LNG_SPAN / 2, lngMax: LNG_C + LNG_SPAN / 2 }
const M_PER_PX = (LNG_SPAN * KM_LNG * 1000) / W

const project = (lat: number, lng: number) => ({
  x: ((lng - B.lngMin) / (B.lngMax - B.lngMin)) * W,
  y: (1 - (lat - B.latMin) / (B.latMax - B.latMin)) * H,
})
const COAST = project(LAT_C, 74.8195).x

// Deterministic pseudo-random for the street grid
function rand(seed: number) {
  return () => {
    seed = (seed * 9301 + 49297) % 233280
    return seed / 233280
  }
}

export function CityPlate({ reports, hotspots }: { reports: PublicReport[]; hotspots: PublicStats['hotspots'] }) {
  const streets = useMemo(() => {
    const r = rand(7)
    const lines: string[] = []
    for (let i = 0; i < 24; i++) {
      const y = 12 + i * 23 + r() * 8
      lines.push(`M${COAST - 10 + r() * 30} ${y} L${W} ${y + (r() - .5) * 30}`)
    }
    for (let i = 0; COAST + 20 + i * 26 < W; i++) {
      const x = COAST + 20 + i * 26 + r() * 10
      lines.push(`M${x} 0 L${x + (r() - .5) * 40} ${H}`)
    }
    return lines
  }, [])

  const pts = reports.filter((p) => p.lat != null && p.lng != null)
  const open = pts.filter((p) => p.status !== 'resolved' && p.status !== 'rejected')
  const newest = open.length ? [...open].sort((a, b) => b.created_at.localeCompare(a.created_at))[0] : null

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="plate__svg" role="img"
      aria-label={`Map plate of the demo city showing ${open.length} open reports and ${hotspots.length} detected hotspots`}>
      <defs>
        <pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
          <line x1="0" y1="0" x2="0" y2="6" stroke="#22332B" strokeWidth="1" />
        </pattern>
        <clipPath id="land"><path d={`M${COAST} 0 C ${COAST - 30} ${H * .2}, ${COAST + 24} ${H * .4}, ${COAST - 8} ${H * .6} C ${COAST - 36} ${H * .78}, ${COAST + 10} ${H * .9}, ${COAST} ${H} L${W} ${H} L${W} 0 Z`} /></clipPath>
      </defs>
      {/* sea */}
      <rect width={W} height={H} fill="#0B1411" />
      <rect width={W} height={H} fill="url(#hatch)" opacity=".55" />
      {/* land */}
      <path d={`M${COAST} 0 C ${COAST - 30} ${H * .2}, ${COAST + 24} ${H * .4}, ${COAST - 8} ${H * .6} C ${COAST - 36} ${H * .78}, ${COAST + 10} ${H * .9}, ${COAST} ${H} L${W} ${H} L${W} 0 Z`} fill="#16251F" />
      <g clipPath="url(#land)" stroke="#24372E" strokeWidth="1" fill="none">
        {streets.map((d, i) => <path key={i} d={d} />)}
      </g>
      {/* arterial roads */}
      <g fill="none" stroke="#8E9C94" strokeLinecap="round">
        <path d={`M${COAST} ${H * .66} C ${W * .45} ${H * .62}, ${W * .55} ${H * .5}, ${W} ${H * .46}`} strokeWidth="3" opacity=".75" />
        <path d={`M${W * .5} 0 C ${W * .51} ${H * .3}, ${W * .54} ${H * .55}, ${W * .57} ${H}`} strokeWidth="3" opacity=".75" />
        <path d={`M${COAST + 30} ${H * .2} C ${W * .5} ${H * .26}, ${W * .7} ${H * .18}, ${W} ${H * .24}`} strokeWidth="1.6" opacity=".5" />
      </g>
      {/* river */}
      <path d={`M${COAST} ${H * .95} C ${W * .45} ${H * .9}, ${W * .7} ${H}, ${W} ${H * .93}`} fill="none" stroke="#3E5E6A" strokeWidth="10" opacity=".8" />
      <text x={COAST / 2} y="40" className="plate__sea">ARABIAN SEA</text>

      {/* hotspots */}
      {hotspots.map((h, i) => {
        const p = project(h.lat, h.lng)
        const r = 26 + h.count * 5
        const label = `${h.id} · ${h.count}`
        const w = label.length * 7.2 + 16
        // Put the tag up-right unless that would sit on top of another hotspot ring; then down-left.
        const others = hotspots.filter((_, j) => j !== i).map((o) => ({ ...project(o.lat, o.lng), r: 26 + o.count * 5 }))
        const upRight = { x: p.x + r * .7 + 20 + w / 2, y: p.y - r * .7 - 19 }
        const clash = others.some((o) => Math.hypot(o.x - upRight.x, o.y - upRight.y) < o.r + 24) || upRight.x + w / 2 > W
        const sx = clash ? -1 : 1
        const sy = clash ? 1 : -1
        const ax = p.x + sx * r * .7
        const ay = p.y + sy * r * .7
        const tx = clash ? ax - 20 - w : ax + 20
        const ty = clash ? ay + 10 : ay - 30
        return (
          <g key={h.id}>
            <circle cx={p.x} cy={p.y} r={r} fill="#E57B56" fillOpacity=".08" stroke="#E57B56" strokeWidth="1.3" strokeDasharray="4 4" />
            <line x1={ax} y1={ay} x2={ax + sx * 18} y2={ay + sy * 18} stroke="#ECE8DC" strokeWidth="1" />
            <g transform={`translate(${tx} ${ty})`}>
              <rect width={w} height="22" rx="3" fill="#E4E1D1" />
              <text x="8" y="15" className="plate__tag">{label}</text>
            </g>
          </g>
        )
      })}

      {/* reports */}
      {pts.map((p) => {
        const { x, y } = project(p.lat!, p.lng!)
        const closed = p.status === 'resolved' || p.status === 'rejected'
        return closed
          ? <circle key={p.id} cx={x} cy={y} r="3.2" fill="none" stroke="#5E6C64" strokeWidth="1.2" />
          : <circle key={p.id} cx={x} cy={y} r={p.priority_level === 'critical' ? 6.5 : 5} fill={LEVEL_COLOR[p.priority_level]} stroke="#0E1814" strokeWidth="1.5" />
      })}
      {newest && (() => {
        const { x, y } = project(newest.lat!, newest.lng!)
        return <circle cx={x} cy={y} r="10" fill="none" stroke="#E4E1D1" strokeWidth="1.5" className="plate__pulse" />
      })()}

      {/* frame & scale */}
      <g transform={`translate(${W - 60 - 1000 / M_PER_PX} ${H - 34})`} className="plate__scale">
        <line x1="0" y1="0" x2={1000 / M_PER_PX} y2="0" stroke="#ECE8DC" strokeWidth="2" />
        <line x1="0" y1="-5" x2="0" y2="5" stroke="#ECE8DC" />
        <line x1={500 / M_PER_PX} y1="-4" x2={500 / M_PER_PX} y2="4" stroke="#ECE8DC" />
        <line x1={1000 / M_PER_PX} y1="-5" x2={1000 / M_PER_PX} y2="5" stroke="#ECE8DC" />
        <text x="0" y="18">0</text><text x={1000 / M_PER_PX - 22} y="18">1 km</text>
      </g>
      <g transform={`translate(${W - 40} 46)`}>
        <path d="M0 -18 L6 6 L0 2 L-6 6 Z" fill="#ECE8DC" />
        <text x="-4" y="22" className="plate__n">N</text>
      </g>
    </svg>
  )
}
