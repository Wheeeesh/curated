import type { City } from '../api/types'

export interface GeoResult {
  name: string
  displayName: string
  lat: number
  lng: number
}

const cache = new Map<string, GeoResult[]>()

/**
 * Nominatim usage policy: max 1 req/s. Callers debounce (400 ms) and we
 * cache per query string. Adding a place never *depends* on this — the
 * drop-a-pin mode is always available.
 */
export async function searchPlaces(query: string, city: City): Promise<GeoResult[]> {
  const q = query.trim()
  if (q.length < 3) return []
  const key = `${city.id}:${q.toLowerCase()}`
  const hit = cache.get(key)
  if (hit) return hit

  const d = 0.35 // ~city-scale viewbox bias
  const params = new URLSearchParams({
    q,
    format: 'jsonv2',
    limit: '6',
    'accept-language': 'en',
    viewbox: `${city.centerLng - d},${city.centerLat + d},${city.centerLng + d},${city.centerLat - d}`,
    bounded: '0',
  })
  const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) throw new Error('Address search is unavailable right now — drop a pin instead.')
  const rows = (await res.json()) as { name?: string; display_name: string; lat: string; lon: string }[]
  const results = rows.map((r) => ({
    name: r.name || r.display_name.split(',')[0],
    displayName: r.display_name,
    lat: parseFloat(r.lat),
    lng: parseFloat(r.lon),
  }))
  cache.set(key, results)
  return results
}
