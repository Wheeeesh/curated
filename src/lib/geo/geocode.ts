export interface GeoResult {
  /** Venue or street name. */
  name: string
  /** "Antwerp, Belgium" — shown under the name and stored on the place. */
  locality: string
  /** Full one-line address, when we have one. */
  address: string
  lat: number
  lng: number
}

/**
 * Photon (Komoot) over OpenStreetMap: keyless, CORS-friendly, and far
 * better than Nominatim at partial words and venue names — "dogma cock"
 * finds the bar, where a pure address geocoder finds nothing.
 */
const PHOTON = 'https://photon.komoot.io'

const cache = new Map<string, GeoResult[]>()

const localityOf = (p: Record<string, unknown>): string =>
  [p.city ?? p.town ?? p.village ?? p.county, p.country].filter(Boolean).join(', ')

const addressOf = (p: Record<string, unknown>): string =>
  [[p.street, p.housenumber].filter(Boolean).join(' '), p.city ?? p.town ?? p.village, p.country]
    .filter((s) => s && String(s).trim())
    .join(', ')

interface PhotonFeature {
  properties: Record<string, unknown>
  geometry: { coordinates: [number, number] }
}

function toResults(features: PhotonFeature[]): GeoResult[] {
  const out: GeoResult[] = []
  const seen = new Set<string>()
  for (const f of features) {
    const p = f.properties
    const [lng, lat] = f.geometry.coordinates
    const name = String(p.name ?? [p.street, p.housenumber].filter(Boolean).join(' ') ?? '').trim()
    if (!name) continue
    const key = `${name}|${lat.toFixed(4)}|${lng.toFixed(4)}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ name, locality: localityOf(p), address: addressOf(p) || localityOf(p), lat, lng })
  }
  return out
}

/**
 * Search for a place. `near` biases results towards what the member is
 * currently looking at, so "storm" finds the café down the road before the
 * one on another continent — but never restricts the search to it.
 */
export async function searchPlaces(query: string, near?: { lat: number; lng: number }): Promise<GeoResult[]> {
  const q = query.trim()
  if (q.length < 2) return []
  const key = `${q.toLowerCase()}|${near ? `${near.lat.toFixed(1)},${near.lng.toFixed(1)}` : ''}`
  const hit = cache.get(key)
  if (hit) return hit

  const params = new URLSearchParams({ q, limit: '10', lang: 'en' })
  if (near) {
    params.set('lat', String(near.lat))
    params.set('lon', String(near.lng))
  }
  const res = await fetch(`${PHOTON}/api/?${params}`)
  if (!res.ok) throw new Error('Search is unavailable right now — drop a pin instead.')
  const body = (await res.json()) as { features?: PhotonFeature[] }
  const results = toResults(body.features ?? [])
  cache.set(key, results)
  return results
}

/** Turn coordinates into a human locality, for pins dropped on the map. */
export async function reverseGeocode(lat: number, lng: number): Promise<{ locality: string; address: string }> {
  try {
    const res = await fetch(`${PHOTON}/reverse?lat=${lat}&lon=${lng}&lang=en`)
    if (!res.ok) return { locality: '', address: '' }
    const body = (await res.json()) as { features?: PhotonFeature[] }
    const f = body.features?.[0]
    if (!f) return { locality: '', address: '' }
    return { locality: localityOf(f.properties), address: addressOf(f.properties) }
  } catch {
    return { locality: '', address: '' }
  }
}

export interface Coords {
  lat: number
  lng: number
}

/** The browser's location, or a clear reason why not. */
export function getCurrentPosition(): Promise<Coords> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('This device can’t share its location.'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => {
        reject(
          new Error(
            err.code === err.PERMISSION_DENIED
              ? 'Location is switched off for this site. You can turn it on in your browser settings.'
              : 'Couldn’t get your location just now.',
          ),
        )
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    )
  })
}
