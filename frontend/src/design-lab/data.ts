/* Sample data for the Design Lab. Snapshot of real CivicPulse engine output on the synthetic
   "Demo City" dataset (fictional wards on Mangaluru coordinates). Static, so previews never touch the live API. */
import raw from './data.json'

export type Level = 'critical' | 'high' | 'medium' | 'low'
export interface LabReport {
  id: string; category: string; label: string; headline: string; location: string; ward: string
  lat: number; lng: number; status: string; level: Level; score: number; dept: string | null
  officer: string | null; ago: string; dup: string
}
export interface LabHotspot {
  id: string; lat: number; lng: number; radius_m: number; location: string; ward: string; count: number
  dominant_label: string; critical_count: number; avg_priority: number; score: number; reason: string
  intervention: string; department: string; kind: string
}

export const D = raw as unknown as {
  metrics: { total: number; open: number; critical_open: number; high_open: number; resolved: number; resolution_rate: number; avg_resolution_hours: number; unassigned_open: number; linked_duplicates: number }
  trend: { label: string; received: number; resolved: number }[]
  categories: { key: string; label: string; total: number; open: number }[]
  priority: { key: Level; label: string; count: number }[]
  workload: { label: string; open: number; critical: number; in_progress: number }[]
  hotspots: LabHotspot[]
  reports: LabReport[]
  featured: {
    id: string; description: string; location: string; ward: string; lat: number; lng: number; category: string; label: string
    confidence: number; evidence: string[]; summary: string; affected: string[]; score: number; level: Level; reasoning: string
    factors: { label: string; weight: number; points: number; evidence: string[] }[]
    matches: { id: string; score: number; likelihood: string; distance_m: number; reasons: string[] }[]
    action: string; dept: string; respond: string
    timeline: { at: string; who: string; status: string | null; msg: string }[]
  }
}

export const OPEN = ['submitted', 'under_review', 'assigned', 'in_progress']
export const openReports = D.reports.filter((r) => OPEN.includes(r.status))
export const byScore = [...openReports].sort((a, b) => b.score - a.score)
export const STATUS: Record<string, string> = {
  submitted: 'Submitted', under_review: 'Under review', assigned: 'Assigned', in_progress: 'In progress', resolved: 'Resolved', rejected: 'Rejected',
}
export const STEPS = ['Submitted', 'Under review', 'Assigned', 'In progress', 'Resolved']
export const CATS = [
  ['roads', 'Roads & potholes'], ['waterlogging', 'Waterlogging'], ['garbage', 'Garbage'], ['streetlights', 'Streetlights'],
  ['drainage', 'Drainage'], ['public_safety', 'Public safety'], ['water_supply', 'Water supply'], ['other', 'Other'],
] as const

const lats = D.reports.map((r) => r.lat)
const lngs = D.reports.map((r) => r.lng)
const B = { latMin: Math.min(...lats) - 0.002, latMax: Math.max(...lats) + 0.002, lngMin: Math.min(...lngs) - 0.003, lngMax: Math.max(...lngs) + 0.003 }

/** Project a coordinate into an SVG box (equirectangular, fine at city scale). */
export function project(lat: number, lng: number, w: number, h: number, pad = 0) {
  return {
    x: pad + ((lng - B.lngMin) / (B.lngMax - B.lngMin)) * (w - pad * 2),
    y: pad + (1 - (lat - B.latMin) / (B.latMax - B.latMin)) * (h - pad * 2),
  }
}
/** Approx metres per SVG unit horizontally, for scale bars. */
export const metresPerUnit = (w: number) => ((B.lngMax - B.lngMin) * 108_500) / w

export type Screen = 'landing' | 'report' | 'command' | 'map' | 'track'
export const SCREENS: { key: Screen; label: string }[] = [
  { key: 'landing', label: 'Landing' },
  { key: 'report', label: 'Report an issue' },
  { key: 'command', label: 'Command center' },
  { key: 'map', label: 'Map & hotspots' },
  { key: 'track', label: 'Tracking' },
]
export interface ConceptProps { screen: Screen; go: (s: Screen) => void }
