/**
 * Turns the hand-curated venue list into atlas places.
 *
 * The curation (which venues are best-in-kind) is the human work in
 * scripts/curated/venues.ts; this script only resolves each to coordinates
 * through the shared open geocoder — the same selection-is-editorial,
 * coordinates-are-open-data split the rest of the atlas uses.
 *
 * A result further than the city's radius from its centre is treated as a
 * mis-geocode and dropped, and every drop is reported — a wrong pin on a
 * hand-picked "best of" list is worse than a missing one.
 *
 *   npx tsx scripts/import-curated.ts
 *
 * Writes scripts/data/curated-places.json.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { ImportedPlace } from './import-lefooding'
import { geocode, saveCache } from './geocode'
import { CITY_CENTERS, CURATED_VENUES, type CuratedVenue } from './curated/venues'

const HERE = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = join(HERE, 'data')

function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(bLat - aLat)
  const dLng = toRad(bLng - aLng)
  const s =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(s))
}

const queryFor = (v: CuratedVenue): string =>
  v.geocodeAs ?? [v.name, v.area, v.city, v.country].filter(Boolean).join(', ')

async function run() {
  const out: ImportedPlace[] = []
  const dropped: { name: string; reason: string }[] = []

  for (const v of CURATED_VENUES) {
    const center = CITY_CENTERS[v.city]
    if (!center) {
      dropped.push({ name: v.name, reason: `no city centre for ${v.city}` })
      continue
    }

    // Hand-set coordinates win, but are still distance-checked below so a
    // mistyped value is caught the same as a bad geocode.
    const point =
      v.lat != null && v.lng != null
        ? { lat: v.lat, lng: v.lng, address: '', locality: '' }
        : await geocode(queryFor(v), { lat: center.lat, lng: center.lng })
    if (!point) {
      dropped.push({ name: v.name, reason: 'no geocode result' })
      continue
    }

    const dist = distanceKm(center.lat, center.lng, point.lat, point.lng)
    if (dist > center.radiusKm) {
      dropped.push({ name: v.name, reason: `resolved ${dist.toFixed(0)} km from ${v.city} — likely wrong` })
      continue
    }

    out.push({
      name: v.name,
      categories: v.categories,
      lat: point.lat,
      lng: point.lng,
      // Photon's street address where it has one; otherwise the query itself.
      address: point.address || [v.area, v.city, v.country].filter(Boolean).join(', '),
      // A clean, consistent locality rather than whatever suburb Photon named.
      locality: `${v.city}, ${v.country}`,
      source: 'Curated',
      sourceUrl: '',
    })
    console.log(`  ✓ ${v.name} — ${dist.toFixed(1)} km — ${point.address || '(no street)'}`)
  }

  saveCache()
  mkdirSync(OUT_DIR, { recursive: true })
  writeFileSync(join(OUT_DIR, 'curated-places.json'), JSON.stringify(out, null, 1))

  console.log(`\nwrote ${out.length} of ${CURATED_VENUES.length} curated places`)
  if (dropped.length) {
    console.log('dropped:')
    for (const d of dropped) console.log(`  ✗ ${d.name} — ${d.reason}`)
  }
}

run()
