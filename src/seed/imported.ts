import type { Category, Place } from '../lib/api/types'
import raw from './imported-places.json'

/**
 * Venue locations imported from published guide data (see
 * scripts/import-*.ts). Names, addresses and coordinates only — no reviews,
 * scores or editorial, so every rating in Curated still comes from a member.
 *
 * Held separately from the mutable demo state on purpose: this is read-only
 * reference data, so keeping it out of localStorage avoids re-serialising
 * thousands of records on every write.
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

export const IMPORTED_PLACES: Place[] = (raw as RawPlace[]).map((p) => ({
  id: idFor(`${p.s}|${p.n}|${p.y.toFixed(5)}|${p.x.toFixed(5)}`),
  cityId: '',
  locality: p.l,
  name: p.n,
  categories: p.c as Category[],
  lat: p.y,
  lng: p.x,
  address: p.a,
  // Provenance, not the guide's words about the place.
  description: `Listed by ${p.s}`,
  createdBy: HOUSE_ID,
  createdAt: EPOCH,
}))
