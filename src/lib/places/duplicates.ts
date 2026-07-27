import type { Place } from '../api/types'

/**
 * One definition of "these are the same venue", shared by the atlas build
 * (scripts/build-imported-seed.ts) and by the app at runtime. Keeping the rule
 * in a single place is the point: when the two disagreed, places the build
 * thought were distinct showed up on the map as two dots on top of each other.
 */

/** Same name this close together is the same place, whatever the source. */
export const SAME_NAME_RADIUS_M = 150

/**
 * A longer name is only treated as the same venue when it is practically on
 * the same spot. Neighbouring venues share a name far more often than you
 * would like — "Frenchie" and "Frenchie Bar à Vins" are ten metres apart on
 * rue du Nil and are genuinely different restaurants.
 */
export const EXTENSION_RADIUS_M = 30

/**
 * Accent-folded, punctuation-free name.
 *
 * Folding matters more than it looks: stripping accents instead of folding
 * them turns "Mécha Uma" into "mchauma" and "Mecha Uma" into "mechauma", so
 * the same venue from two sources never matched and every accented name in
 * the atlas kept its twin.
 */
export function foldName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/** Leading articles differ between sources: "Le Chardenoux" / "Chardenoux". */
const LEADING_ARTICLE = /^(le|la|les|el|los|las|the|il|lo|de|het|een)\s+/

const nameVariants = (name: string): string[] => {
  const folded = foldName(name)
  const bare = folded.replace(LEADING_ARTICLE, '')
  return bare && bare !== folded ? [folded, bare] : [folded]
}

export function distanceM(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(bLat - aLat)
  const dLng = toRad(bLng - aLng)
  const s =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)))
}

export interface Candidate {
  name: string
  lat: number
  lng: number
}

/**
 * Whether two entries describe the same venue.
 *
 * `allowExtension` opts into the looser "one name contains the other" test.
 * The build only allows it across different sources: a single guide listing
 * both "Frenchie" and "Frenchie Bar à Vins" is telling us they are two
 * places, and it knows better than a string comparison does.
 */
export function isSameVenue(a: Candidate, b: Candidate, allowExtension = false): boolean {
  const metres = distanceM(a.lat, a.lng, b.lat, b.lng)
  if (metres > SAME_NAME_RADIUS_M) return false

  const av = nameVariants(a.name)
  const bv = nameVariants(b.name)
  if (av.some((n) => n.length > 0 && bv.includes(n))) return true

  if (!allowExtension || metres > EXTENSION_RADIUS_M) return false
  const [short, long] = av[0].length <= bv[0].length ? [av[0], bv[0]] : [bv[0], av[0]]
  // Short names collide constantly; only extend something distinctive.
  return short.length >= 5 && long.startsWith(`${short} `)
}

/** Degrees of latitude per metre, near enough at any latitude. */
const M_PER_DEG_LAT = 111_320
const CELL_DEG = 0.002

/**
 * Buckets entries into a grid so each one only has to be compared with its
 * neighbours rather than with all 28,000. Returns the keys to search for a
 * given point, widened at high latitudes where a degree of longitude is short.
 */
function searchKeys(lat: number, lng: number, radiusM: number): string[] {
  const latCells = Math.ceil(radiusM / M_PER_DEG_LAT / CELL_DEG)
  const metresPerDegLng = M_PER_DEG_LAT * Math.max(Math.cos((lat * Math.PI) / 180), 0.02)
  const lngCells = Math.ceil(radiusM / metresPerDegLng / CELL_DEG)
  const baseLat = Math.floor(lat / CELL_DEG)
  const baseLng = Math.floor(lng / CELL_DEG)

  const keys: string[] = []
  for (let dy = -latCells; dy <= latCells; dy++) {
    for (let dx = -lngCells; dx <= lngCells; dx++) keys.push(`${baseLat + dy}:${baseLng + dx}`)
  }
  return keys
}

export const cellKey = (lat: number, lng: number): string =>
  `${Math.floor(lat / CELL_DEG)}:${Math.floor(lng / CELL_DEG)}`

/** Index for repeated "is anything already here?" questions. */
export class VenueIndex<T extends Candidate> {
  private cells = new Map<string, T[]>()

  add(item: T): void {
    const key = cellKey(item.lat, item.lng)
    const bucket = this.cells.get(key)
    if (bucket) bucket.push(item)
    else this.cells.set(key, [item])
  }

  /** The first already-indexed entry that is the same venue, if any. */
  find(item: Candidate, allowExtension = false): T | null {
    for (const key of searchKeys(item.lat, item.lng, SAME_NAME_RADIUS_M)) {
      for (const other of this.cells.get(key) ?? []) {
        if (isSameVenue(item, other, allowExtension)) return other
      }
    }
    return null
  }
}

/** The house account that owns every imported atlas place. */
const HOUSE_ID = '00000000-0000-4000-a000-000000000001'

/**
 * Last line of defence before places reach the map.
 *
 * The atlas is deduplicated when it is built, so this exists for the case the
 * build cannot see: a member pinning somewhere the atlas already knew about.
 * Their pin wins and the imported twin is dropped — never the other way
 * round, because the member's place is the one carrying their review.
 */
export function dedupePlaces(places: Place[]): Place[] {
  const members: Place[] = []
  const imported: Place[] = []
  for (const p of places) (p.createdBy === HOUSE_ID ? imported : members).push(p)
  if (members.length === 0 || imported.length === 0) return places

  const index = new VenueIndex<Place>()
  for (const p of members) index.add(p)

  return [...members, ...imported.filter((p) => index.find(p) === null)]
}
