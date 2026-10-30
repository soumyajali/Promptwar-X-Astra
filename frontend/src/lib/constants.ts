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
  critical: '#C8441A',
  high: '#B57A12',
  medium: '#3D5F7D',
  low: '#5D7D62',
}

export const CHART = {
  ink: '#13201B',
  muted: '#67726C',
  rule: '#D6CEBD',
  civic: '#1D4A3C',
  signal: '#C8441A',
  ochre: '#B57A12',
  slate: '#3D5F7D',
  sage: '#5D7D62',
  paper: '#F2EEE5',
}

export const DEMO_EXAMPLE = {
  description:
    'Knee deep waterlogging near the Central Bus Stand entrance after heavy rain since this morning. Commuters and school children cannot reach the buses and the drain is completely blocked.',
  location: 'Central Bus Stand, Platform Road',
  lat: 12.8701,
  lng: 74.84255,
}
