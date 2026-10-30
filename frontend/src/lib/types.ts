export type CategoryKey =
  | 'roads' | 'waterlogging' | 'garbage' | 'streetlights' | 'drainage' | 'public_safety' | 'water_supply' | 'other'
export type Level = 'critical' | 'high' | 'medium' | 'low'
export type Status = 'submitted' | 'under_review' | 'assigned' | 'in_progress' | 'resolved' | 'rejected'
export type DeptKey = 'roads' | 'sanitation' | 'water' | 'electricity' | 'safety' | 'admin'

export interface Meta {
  categories: Record<CategoryKey, string>
  departments: Record<DeptKey, string>
  officers: Record<DeptKey, string[]>
  statuses: Status[]
  category_department: Record<CategoryKey, DeptKey>
  demo_area: DemoArea
  max_image_mb: number
  priority_weights: Record<string, number>
}

export interface DemoArea {
  name: string
  description: string
  center: [number, number]
  zoom: number
}

export interface Factor {
  key: string
  label: string
  weight: number
  raw: number
  points: number
  evidence: string[]
}

export interface PriorityResult {
  score: number
  level: Level
  factors: Factor[]
  reasoning: string
}

export interface DuplicateMatch {
  id: string
  score: number
  likelihood: 'likely' | 'possible'
  distance_m: number | null
  days_apart: number
  reasons: string[]
  category: CategoryKey
  status?: Status
  components?: Record<string, number>
  location_text?: string
}

export interface Recommendation {
  department: DeptKey
  department_label: string
  primary: { action: string; why: string }
  actions: { action: string; why: string }[]
  response_target: string
  note: string
}

export interface Summary {
  text: string
  what: string
  where: string
  affected: string[]
  people: number | null
  safety_concerns: string[]
  urgency_cues: string[]
}

export interface Classification {
  category: CategoryKey
  label: string
  confidence: number
  evidence: string[]
  explanation: string
  alternative: CategoryKey | null
  alternative_label: string | null
  alternative_confidence: number | null
  scores: Record<string, number>
  needs_review: boolean
  resolution: { source: string; mismatch: boolean; message: string }
}

export interface Analysis {
  category: CategoryKey
  classification: Classification
  summary: Summary
  duplicates: { likelihood: 'likely' | 'possible' | 'none'; top_score: number; matches: DuplicateMatch[]; weights: Record<string, number> }
  neighbourhood: { same_category_nearby: number; open_nearby: number }
  priority: PriorityResult & { weights: Record<string, number> }
  recommendation: Recommendation
  signals: { hazards: string[]; severity: string[]; urgency: string[]; affected: string[]; duration: string | null }
  corrections?: { from: string; to: string; by: string; reason?: string }[]
}

export interface TimelineEntry {
  id: number
  report_id: string
  kind: string
  status: Status | null
  message: string
  visibility: 'public' | 'internal'
  actor: string
  created_at: string
}

export interface PublicReport {
  id: string
  category: CategoryKey
  category_label: string
  location_text: string
  ward: string | null
  lat: number | null
  lng: number | null
  status: Status
  priority_level: Level
  priority_score: number
  headline: string
  created_at: string
  updated_at: string
}

export interface TrackView extends PublicReport {
  description: string
  summary: string
  image_url: string | null
  department: DeptKey | null
  department_label: string | null
  officer_assigned: boolean
  officer: string | null
  resolution_note: string | null
  resolved_at: string | null
  timeline: TimelineEntry[]
  analysis: {
    classification: Pick<Classification, 'category' | 'label' | 'confidence' | 'explanation' | 'resolution'>
    priority: PriorityResult
    duplicates: { likelihood: string; count?: number; top_score?: number; matches?: DuplicateMatch[] }
    recommendation: Partial<Recommendation> & { department_label: string; response_target: string }
    summary?: Summary
    signals?: Analysis['signals']
  }
}

export interface AuthorityReport {
  id: string
  description: string
  category: CategoryKey
  category_label: string
  category_selected: CategoryKey | null
  category_predicted: CategoryKey | null
  category_confidence: number | null
  category_corrected: boolean
  location_text: string
  ward: string | null
  lat: number | null
  lng: number | null
  location_source: 'device' | 'map' | 'demo' | null
  location_accuracy_m: number | null
  image_url: string | null
  reporter_name: string | null
  reporter_contact: string | null
  affected_people: number | null
  channel: string
  status: Status
  priority_score: number
  priority_level: Level
  priority_overridden: boolean
  priority_override_reason: string | null
  department: DeptKey | null
  department_label: string | null
  officer: string | null
  summary: string
  headline: string
  primary_report_id: string | null
  duplicate_likelihood: 'likely' | 'possible' | 'none'
  needs_review: boolean
  resolution_note: string | null
  created_at: string
  updated_at: string
  resolved_at: string | null
}

export interface LinkedReport {
  id: string
  score: number
  distance_m: number | null
  likelihood: string
  reasons: string[]
  category: CategoryKey
  category_label: string
  status: Status
  location_text: string
  priority_level: Level
  priority_score: number
  created_at: string
  lat: number | null
  lng: number | null
}

export interface ReportDetail extends AuthorityReport {
  analysis: Analysis
  timeline: TimelineEntry[]
  links: LinkedReport[]
}

export interface Hotspot {
  id: string
  rank: number
  lat: number
  lng: number
  radius_m: number
  location: string
  ward: string
  count: number
  dominant_category: CategoryKey
  dominant_label: string
  categories: Record<string, number>
  critical_count: number
  high_count: number
  avg_priority: number
  score: number
  kind: 'recurring' | 'multi-issue'
  department: string
  intervention: string
  reason: string
  report_ids: string[]
}

export interface Metrics {
  total: number
  open: number
  critical_open: number
  high_open: number
  resolved: number
  rejected: number
  unassigned_open: number
  resolution_rate: number
  avg_resolution_hours: number | null
  avg_resolution_note: string | null
  linked_duplicates: number
}

export interface Dashboard {
  metrics: Metrics
  trend: { date: string; label: string; received: number; resolved: number }[]
  distributions: {
    category: { key: CategoryKey; label: string; total: number; open: number }[]
    priority: { key: Level; label: string; count: number }[]
    status: { key: Status; count: number }[]
    ward: { ward: string; open: number }[]
  }
  workload: { key: DeptKey; label: string; open: number; in_progress: number; critical: number; resolved: number; officers: string[] }[]
  hotspots: Hotspot[]
  insights: { kind: string; title: string; detail: string; evidence: string[] }[]
  critical_ids: string[]
  recent_ids: string[]
  week: { received: [number, number]; resolved: [number, number]; critical: [number, number] }
}

export interface PublicStats {
  metrics: Metrics
  categories: { key: CategoryKey; label: string; total: number; open: number }[]
  hotspots: Pick<Hotspot, 'id' | 'lat' | 'lng' | 'radius_m' | 'location' | 'ward' | 'count' | 'dominant_label' | 'critical_count' | 'avg_priority' | 'score' | 'reason' | 'kind'>[]
  wards: string[]
  engine_example: null | {
    id: string
    category_label: string
    location_text: string
    headline: string
    priority: PriorityResult
    duplicates: number
  }
  demo_area: DemoArea
}

export interface Brief {
  scope: string
  generated_from: string
  calculated: {
    metrics: Metrics
    recurring_problems: { category: CategoryKey; label: string; open: number; linked_duplicates: number; top_locations: string[] }[]
    most_affected_areas: { ward: string; open: number; critical: number }[]
    high_priority_reports: { id: string; category: CategoryKey; label: string; location: string; score: number; level: Level; status: Status; department: DeptKey | null }[]
    department_workload: Dashboard['workload']
    hotspots: Hotspot[]
  }
  suggested: {
    intervention_order: { step: number; type: string; target: string; action: string; department: string; why: string; report_ids: string[]; respond: string; score: number }[]
    notes: string[]
    disclaimer: string
  }
}

export interface AssistantAnswer {
  intent: string
  confidence: number
  answer: string
  evidence: string[]
  items: { id: string; label: string; location: string; level: Level; score: number; status: string }[]
  slots?: Record<string, string>
  suggestions?: string[]
  source?: string
  engine?: 'local' | 'claude'
  model?: string
  fallback_reason?: string
}

export interface Preview {
  ready: boolean
  category?: CategoryKey
  label?: string
  confidence?: number
  evidence?: string[]
  needs_review?: boolean
  hazards?: string[]
  affected?: string[]
}
