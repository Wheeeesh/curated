import type { Category, Place } from '../lib/api/types'

/**
 * Venue locations imported from published guide and open-data sources (see
 * scripts/import-*.ts). Names, addresses and coordinates only — no reviews,
 * scores or editorial, so every rating in Curated still comes from a member.
 *
 * Served as a static asset rather than bundled into the JavaScript: there are
 * tens of thousands of these, and inlining them would put several megabytes in
 * front of first paint. The service worker precaches the file, so the atlas is
 * still available offline. Loaded once and memoised.
 */
interface RawPlace {
  n: string
  c: string[]
  y: number
  x: number
  a: string
  l: string
  s: string
}

const HOUSE_ID = '00000000-0000-4000-a000-000000000001'
const EPOCH = '2026-01-01T00:00:00.000Z'

/** Deterministic id so a place keeps the same identity across reloads. */
function idFor(seed: string): string {
  let h1 = 0x811c9dc5
  let h2 = 0x01000193
  for (let i = 0; i < seed.length; i++) {
    h1 ^= seed.charCodeAt(i)
    h1 = Math.imul(h1, 0x01000193) >>> 0
    h2 ^= seed.charCodeAt(seed.length - 1 - i)
    h2 = Math.imul(h2, 0x85ebca6b) >>> 0
  }
  const b = (n: number) => n.toString(16).padStart(8, '0')
  const hex = (b(h1) + b(h2) + b(h1 ^ h2) + b((h1 + h2) >>> 0)).slice(0, 32)
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`
}

const toPlace = (p: RawPlace): Place => ({
  id: idFor(`${p.s}|${p.n}|${p.y.toFixed(5)}|${p.x.toFixed(5)}`),
  cityId: '',
  locality: p.l,
  name: p.n,
  categories: p.c as Category[],
  lat: p.y,
  lng: p.x,
  address: p.a,
  // Provenance, not the source's words about the place.
  description: `Listed by ${p.s}`,
  createdBy: HOUSE_ID,
  createdAt: EPOCH,
})

let loaded: Place[] | null = null
let inflight: Promise<Place[]> | null = null

async function load(): Promise<Place[]> {
  try {
    // BASE_URL keeps this correct under the /curated/ subpath on Pages.
    const res = await fetch(`${import.meta.env.BASE_URL}atlas-places.json`)
    if (!res.ok) throw new Error(String(res.status))
    const raw = (await res.json()) as RawPlace[]
    return raw.map(toPlace)
  } catch {
    // A missing or unreadable atlas must not take the app down — members'
    // own places and reviews still work without it.
    return []
  }
}

/** The imported atlas, fetched once per session and reused thereafter. */
export async function importedPlaces(): Promise<Place[]> {
  if (loaded) return loaded
  if (!inflight) inflight = load()
  loaded = await inflight
  return loaded
}
