import type { Place } from '../api/types'
import type { GeoResult } from './geocode'

/**
 * How close a search result has to be to an atlas place before their names
 * are even worth comparing. Wide enough to survive the disagreement between
 * a geocoder's entrance pin and a guide's street address.
 */
const NAME_MATCH_RADIUS_M = 150

/**
 * Close enough to be the same point whatever either side calls it — the last
 * resort for a venue the two sources simply name differently. Kept very tight,
 * because separate businesses share an address more often than you would like.
 */
const SAME_POINT_RADIUS_M = 10

function distanceM(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(bLat - aLat)
  const dLng = toRad(bLng - aLng)
  const s =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(s))
}

/** Case, accents and punctuation all differ between sources; none of them matter. */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/**
 * Whether two venue names denote the same place. Only exact matches and
 * whole-word extensions count — "Le Pristine" is "Le Pristine Restaurant",
 * but "MAS" is emphatically not "MAS Shop", "BelRoy's MAS" or every other
 * business that happens to sit near the museum and borrow its name.
 */
function namesAgree(a: string, b: string): boolean {
  if (a === b) return a.length > 0
  const [short, long] = a.length <= b.length ? [a, b] : [b, a]
  // Short names are far too collision-prone to extend by prefix.
  if (short.length < 5) return false
  return long.startsWith(`${short} `)
}

/**
 * The atlas place a search result refers to, or null if it is somewhere we do
 * not have yet. Wrong either way costs the member something — a duplicate pin,
 * or being sent to a neighbour instead of adding what they meant — so both
 * the distance and the name have to agree.
 */
export function findExistingPlace(result: GeoResult, places: Place[]): Place | null {
  const name = normalize(result.name)
  let best: Place | null = null
  let bestDistance = Infinity

  for (const place of places) {
    const d = distanceM(result.lat, result.lng, place.lat, place.lng)
    if (d > NAME_MATCH_RADIUS_M || d >= bestDistance) continue

    if (d > SAME_POINT_RADIUS_M && !namesAgree(name, normalize(place.name))) continue

    best = place
    bestDistance = d
  }

  return best
}
