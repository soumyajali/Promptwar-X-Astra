import {
  CircleHelp, Construction, Droplets, Lightbulb, ShieldAlert, Trash2, Waves, Workflow,
  type LucideIcon,
} from 'lucide-react'
import type { CategoryKey, Level } from './types'

export const CATEGORY_META: Record<CategoryKey, { label: string; short: string; icon: LucideIcon; blurb: string }> = {
  roads: { label: 'Roads and potholes', short: 'Roads', icon: Construction, blurb: 'Potholes, broken surfaces, damaged footpaths' },
  waterlogging: { label: 'Waterlogging and flooding', short: 'Waterlogging', icon: Waves, blurb: 'Standing water, flooded streets after rain' },
  garbage: { label: 'Garbage and sanitation', short: 'Garbage', icon: Trash2, blurb: 'Overflowing bins, uncollected waste, dumping' },
  streetlights: { label: 'Streetlights', short: 'Streetlights', icon: Lightbulb, blurb: 'Dark stretches, broken poles, exposed wires' },
  drainage: { label: 'Drainage', short: 'Drainage', icon: Workflow, blurb: 'Blocked drains, open manholes, sewage overflow' },
  public_safety: { label: 'Public safety', short: 'Safety', icon: ShieldAlert, blurb: 'Hazards, unsafe spots, incidents' },
  water_supply: { label: 'Water supply', short: 'Water supply', icon: Droplets, blurb: 'No supply, leaks, dirty water' },
  other: { label: 'Other', short: 'Other', icon: CircleHelp, blurb: 'Anything else the ward office should know' },
}

export const CATEGORY_KEYS = Object.keys(CATEGORY_META) as CategoryKey[]

export const LEVEL_COLOR: Record<Level, string> = {
  critical: '#D94B3D',
  high: '#E45B32',
  medium: '#E9A33A',
  low: '#80B69A',
}

export const CHART = {
  ink: '#F0EBDD',
  muted: '#71857A',
  rule: '#1E3A2F',
  civic: '#80B69A',
  signal: '#D94B3D',
  ochre: '#E9A33A',
  slate: '#E9A33A',
  sage: '#80B69A',
  paper: '#06130F',
  amber: '#E9A33A',
  orange: '#E45B32',
}

// Category palette for distribution charts: warm-to-cool sequence that reads on dark green.
export const CATEGORY_COLOR: Record<CategoryKey, string> = {
  roads: '#E45B32', waterlogging: '#E9A33A', garbage: '#C9B27C', streetlights: '#F2D27A',
  drainage: '#80B69A', public_safety: '#D94B3D', water_supply: '#6FA8A0', other: '#71857A',
}

export const DEMO_EXAMPLE = {
  description:
    'Knee deep waterlogging near the Central Bus Stand entrance after heavy rain since this morning. Commuters and school children cannot reach the buses and the drain is completely blocked.',
  location: 'Central Bus Stand, Platform Road',
  lat: 12.8701,
  lng: 74.84255,
}
