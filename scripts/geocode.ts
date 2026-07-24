/**
 * Shared address → coordinates helper for the importers.
 *
 * Several guides publish a curated selection with a postal address but no
 * coordinates. That is the split this project relies on: the *selection* comes
 * from the guide, the *coordinates* come from open geodata — here Photon over
 * OpenStreetMap, the same geocoder the app itself uses.
 *
 * Results are cached to disk, so re-running an importer costs no requests for
 * anything already resolved. Photon is a free service run by Komoot; the rate
 * limit below is deliberate politeness, not a technical ceiling.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const CACHE_FILE = join(HERE, 'data', 'geocode-cache.json')
const UA = 'CuratedAtlasBot/1.0 (personal map project; contact via github.com/Wheeeesh/curated)'
const MIN_INTERVAL_MS = 1100

export interface GeoPoint {
  lat: number
  lng: number
  locality: string
  address: string
}

type CacheEntry = GeoPoint | null

const cache: Record<string, CacheEntry> = existsSync(CACHE_FILE)
  ? (JSON.parse(readFileSync(CACHE_FILE, 'utf8')) as Record<string, CacheEntry>)
  : {}

let dirty = false
let lastRequest = 0

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export function saveCache(): void {
  if (!dirty) return
  mkdirSync(dirname(CACHE_FILE), { recursive: true })
  writeFileSync(CACHE_FILE, JSON.stringify(cache))
  dirty = false
}

const str = (v: unknown): string => (typeof v === 'string' ? v : '')

interface PhotonFeature {
  properties: Record<string, unknown>
  geometry: { coordinates: [number, number] }
}

/**
 * Resolve a free-text place description. `near` biases the search towards a
 * city, which matters for venue names that repeat around the world.
 */
export async function geocode(query: string, near?: { lat: number; lng: number }): Promise<GeoPoint | null> {
  // `en` is part of the key: without it Photon answers in the local language
  // and the atlas ends up with "Hong Kong, 中国" next to "Paris, France".
  const key = `en|${query}|${near ? `${near.lat.toFixed(2)},${near.lng.toFixed(2)}` : ''}`
  if (key in cache) return cache[key]

  const wait = MIN_INTERVAL_MS - (Date.now() - lastRequest)
  if (wait > 0) await sleep(wait)
  lastRequest = Date.now()

  const params = new URLSearchParams({ q: query, limit: '1', lang: 'en' })
  if (near) {
    params.set('lat', String(near.lat))
    params.set('lon', String(near.lng))
  }

  let result: GeoPoint | null = null
  try {
    const res = await fetch(`https://photon.komoot.io/api?${params}`, { headers: { 'User-Agent': UA } })
    if (res.ok) {
      const json = (await res.json()) as { features?: PhotonFeature[] }
      const f = json.features?.[0]
      if (f) {
        const [lng, lat] = f.geometry.coordinates
        const p = f.properties
        const city = str(p.city) || str(p.town) || str(p.village) || str(p.county)
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          result = {
            lat,
            lng,
            locality: [city, str(p.country)].filter(Boolean).join(', '),
            address: [[str(p.street), str(p.housenumber)].filter(Boolean).join(' '), city, str(p.country)]
              .filter(Boolean)
              .join(', '),
          }
        }
      }
    }
  } catch {
    // Network hiccup: cache nothing, so a later run retries.
    return null
  }

  cache[key] = result
  dirty = true
  // Persist as we go — these runs are long and interruptions are expected.
  if (Object.keys(cache).length % 25 === 0) saveCache()
  return result
}
