import type { Aspect, Category } from './api/types'

/**
 * Category hues are used only where colour carries information — map pins
 * and the small badge on a place. Everything else in the UI is monochrome.
 * Values are tuned for contrast against white.
 */
export const CATEGORY_META: Record<Category, { label: string; color: string }> = {
  food: { label: 'Food', color: '#c8562f' },
  coffee: { label: 'Coffee', color: '#8a6240' },
  bars: { label: 'Bars', color: '#a8791b' },
  nightlife: { label: 'Nightlife', color: '#3a63c0' },
  music: { label: 'Music', color: '#6d4fb0' },
  culture: { label: 'Culture', color: '#b04a78' },
  art: { label: 'Art', color: '#c2497f' },
  nature: { label: 'Nature', color: '#4a7c46' },
  shopping: { label: 'Shopping', color: '#1f8478' },
}

/** Question shown for each rating criterion. */
export const ASPECT_META: Record<Aspect, { label: string; hint: string }> = {
  food: { label: 'Food', hint: 'how good is what you ate' },
  coffee: { label: 'Coffee', hint: 'the cup itself' },
  drinks: { label: 'Drinks', hint: 'what’s in the glass' },
  sound: { label: 'Sound', hint: 'system, mix, acoustics' },
  lineup: { label: 'Line-up', hint: 'who they book' },
  crowd: { label: 'Crowd', hint: 'who’s there, and how they behave' },
  curation: { label: 'Curation', hint: 'what they chose to show, and why' },
  scenery: { label: 'Scenery', hint: 'how it looks and feels' },
  quiet: { label: 'Peace', hint: 'calm, space, room to breathe' },
  selection: { label: 'Selection', hint: 'what you can actually find' },
  atmosphere: { label: 'Atmosphere', hint: 'the room, the feel' },
  service: { label: 'Service', hint: 'how you were treated' },
  value: { label: 'Value', hint: 'worth what it costs' },
  upkeep: { label: 'Upkeep', hint: 'how well it’s looked after' },
}

export const ACCENT = '#1c1c1e'
export const DANGER = '#ff3b30'

/** Graphite ramp — strength shown by weight, not hue. Red only for genuinely bad. */
export function scoreColor(score: number): string {
  if (score >= 7) return '#1c1c1e'
  if (score >= 5) return 'rgba(60,60,67,0.6)'
  return DANGER
}

export function matchTone(pct: number): string {
  return pct >= 60 ? ACCENT : 'rgba(60,60,67,0.45)'
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')
}
