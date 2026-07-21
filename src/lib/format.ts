import type { Aspect, Category } from './api/types'

/**
 * Category hues are used only where colour carries information — map pins
 * and the small badge on a place. Everything else in the UI is monochrome.
 * Values are tuned for contrast against white.
 */
export const CATEGORY_META: Record<Category, { label: string; color: string; icon: string }> = {
  food: { label: 'Food', color: '#c8562f', icon: '◆' },
  bars: { label: 'Bars', color: '#a8791b', icon: '●' },
  nature: { label: 'Nature', color: '#4a7c46', icon: '▲' },
  music: { label: 'Music', color: '#6d4fb0', icon: '♪' },
  culture: { label: 'Culture', color: '#b04a78', icon: '■' },
  nightlife: { label: 'Nightlife', color: '#3a63c0', icon: '★' },
  shopping: { label: 'Shopping', color: '#1f8478', icon: '✦' },
}

export const ASPECT_META: Record<Aspect, { label: string; hint: string }> = {
  quality: { label: 'Quality', hint: 'the food, the show, the view' },
  vibe: { label: 'Vibe', hint: 'atmosphere, crowd, feel' },
  service: { label: 'Service', hint: 'how you were treated' },
  value: { label: 'Value', hint: 'worth what it costs' },
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
