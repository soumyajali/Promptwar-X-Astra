import type { Level, Status } from './types'

// Backend stores naive UTC ISO strings.
export const toDate = (iso: string) => new Date(iso.endsWith('Z') ? iso : iso + 'Z')

export function timeAgo(iso: string, now = Date.now()): string {
  const s = Math.max(0, (now - toDate(iso).getTime()) / 1000)
  if (s < 60) return 'just now'
  const m = s / 60
  if (m < 60) return `${Math.floor(m)} min ago`
  const h = m / 60
  if (h < 24) return `${Math.floor(h)} h ago`
  const d = h / 24
  if (d < 30) return `${Math.floor(d)} d ago`
  return toDate(iso).toLocaleDateString()
}

export const fmtDate = (iso: string) =>
  toDate(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

export const fmtDay = (iso: string) => toDate(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })

export const STATUS_LABEL: Record<Status, string> = {
  submitted: 'Submitted', under_review: 'Under review', assigned: 'Assigned',
  in_progress: 'In progress', resolved: 'Resolved', rejected: 'Rejected',
}

export const LEVEL_LABEL: Record<Level, string> = { critical: 'Critical', high: 'High', medium: 'Medium', low: 'Low' }

export const LEVEL_ORDER: Level[] = ['critical', 'high', 'medium', 'low']

export const OPEN: Status[] = ['submitted', 'under_review', 'assigned', 'in_progress']

export const pct = (x: number) => `${Math.round(x * 100)}%`

export const fmtHours = (h: number | null) => {
  if (h == null) return '—'
  if (h < 48) return `${Math.round(h)} h`
  return `${(h / 24).toFixed(1)} d`
}

export const distance = (m: number | null | undefined) =>
  m == null ? 'no coordinates' : m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`
