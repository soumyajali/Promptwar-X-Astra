/* Hero illustration: an engraved "city plate" drawn in SVG. The streets and coastline are an
   abstract drawing, but every dot and ring is plotted from live report coordinates and the same
   DBSCAN hotspots the authority dashboard uses. */
import { useMemo } from 'react'
import type { PublicReport, PublicStats } from '../lib/types'
import { LEVEL_COLOR } from '../lib/constants'

const B = { latMin: 12.851, latMax: 12.89, lngMin: 74.826, lngMax: 74.861 }
const W = 640
const H = 640

const project = (lat: number, lng: number) => ({
  x: ((lng - B.lngMin) / (B.lngMax - B.lngMin)) * W,
  y: (1 - (lat - B.latMin) / (B.latMax - B.latMin)) * H,
})

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
    for (let i = 0; i < 26; i++) {
      const y = 30 + i * 24 + r() * 8
      const x1 = 90 + r() * 60
      lines.push(`M${x1} ${y} L${W} ${y + (r() - .5) * 30}`)
    }
    for (let i = 0; i < 22; i++) {
      const x = 120 + i * 24 + r() * 10
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
          <line x1="0" y1="0" x2="0" y2="6" stroke="#B4AB97" strokeWidth="1" />
        </pattern>
        <clipPath id="land"><path d="M95 0 C 70 120, 120 210, 88 330 C 62 430, 110 520, 96 640 L640 640 L640 0 Z" /></clipPath>
      </defs>
      {/* sea */}
      <rect width={W} height={H} fill="#E3DDCF" />
      <rect width={W} height={H} fill="url(#hatch)" opacity=".55" />
      {/* land */}
      <path d="M95 0 C 70 120, 120 210, 88 330 C 62 430, 110 520, 96 640 L640 640 L640 0 Z" fill="#F4F0E7" />
      <g clipPath="url(#land)" stroke="#D4CBB8" strokeWidth="1" fill="none">
        {streets.map((d, i) => <path key={i} d={d} />)}
      </g>
      {/* arterial roads */}
      <g fill="none" stroke="#13201B" strokeLinecap="round">
        <path d="M110 420 C 260 400, 330 330, 640 300" strokeWidth="3" opacity=".75" />
        <path d="M300 0 C 320 160, 380 300, 420 640" strokeWidth="3" opacity=".75" />
        <path d="M140 120 C 300 160, 470 120, 640 160" strokeWidth="1.6" opacity=".5" />
        <path d="M120 560 C 300 520, 520 560, 640 520" strokeWidth="1.6" opacity=".5" />
      </g>
      {/* river */}
      <path d="M96 610 C 220 585, 330 640, 640 600" fill="none" stroke="#8FA9B8" strokeWidth="10" opacity=".55" />
      <text x="24" y="40" className="plate__sea">ARABIAN SEA</text>

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
            <circle cx={p.x} cy={p.y} r={r} fill="#C8441A" fillOpacity=".08" stroke="#C8441A" strokeWidth="1.3" strokeDasharray="4 4" />
            <line x1={ax} y1={ay} x2={ax + sx * 18} y2={ay + sy * 18} stroke="#13201B" strokeWidth="1" />
            <g transform={`translate(${tx} ${ty})`}>
              <rect width={w} height="22" rx="2" fill="#13201B" />
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
          ? <circle key={p.id} cx={x} cy={y} r="3.2" fill="none" stroke="#646F69" strokeWidth="1.2" />
          : <circle key={p.id} cx={x} cy={y} r={p.priority_level === 'critical' ? 6.5 : 5} fill={LEVEL_COLOR[p.priority_level]} stroke="#FAF8F3" strokeWidth="1.5" />
      })}
      {newest && (() => {
        const { x, y } = project(newest.lat!, newest.lng!)
        return <circle cx={x} cy={y} r="10" fill="none" stroke="#C8441A" strokeWidth="1.5" className="plate__pulse" />
      })()}

      {/* frame & scale */}
      <g transform={`translate(${W - 150} ${H - 34})`} className="plate__scale">
        <line x1="0" y1="0" x2="100" y2="0" stroke="#13201B" strokeWidth="2" />
        <line x1="0" y1="-5" x2="0" y2="5" stroke="#13201B" />
        <line x1="50" y1="-4" x2="50" y2="4" stroke="#13201B" />
        <line x1="100" y1="-5" x2="100" y2="5" stroke="#13201B" />
        <text x="0" y="18">0</text><text x="78" y="18">~600 m</text>
      </g>
      <g transform={`translate(${W - 40} 46)`}>
        <path d="M0 -18 L6 6 L0 2 L-6 6 Z" fill="#13201B" />
        <text x="-4" y="22" className="plate__n">N</text>
      </g>
    </svg>
  )
}
