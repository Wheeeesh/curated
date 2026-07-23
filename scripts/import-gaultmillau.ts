/**
 * Imports venue LOCATIONS from Gault&Millau's published feed.
 *
 * Their country sites expose /.well-known/places-*.json, linked from the
 * page head as rel="ai-knowledge" — a machine-readable feed they publish
 * deliberately for automated consumption. One request per country, so no
 * crawling of the site itself.
 *
 * Takes only name, address and coordinates. Their scores, awards, team,
 * price ranges, photos and written descriptions are deliberately NOT
 * imported — Curated's recommendations come from its members' own reviews.
 *
 *   npx tsx scripts/import-gaultmillau.ts
 *
 * Writes scripts/data/gaultmillau-places.json.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { ImportedPlace } from './import-lefooding'

const HERE = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = join(HERE, 'data')
const UA = 'CuratedAtlasBot/1.0 (personal map project; contact via github.com/Wheeeesh/curated)'

const COUNTRIES = [
  { host: 'www.gaultmillau.be', country: 'Belgium' },
  { host: 'www.gaultmillau.lu', country: 'Luxembourg' },
  { host: 'www.gaultmillau.at', country: 'Austria' },
  { host: 'www.gaultmillau.ch', country: 'Switzerland' },
  { host: 'www.gaultmillau.it', country: 'Italy' },
  { host: 'www.gaultmillau.ma', country: 'Morocco' },
]

const FEEDS = ['places-en.json', 'places-fr.json', 'places.json']

/** Their category labels → Curated categories. */
function toCategories(labels: string[]): string[] {
  const s = labels.join(' ').toLowerCase()
  const out = new Set<string>()
  if (/hotel|b&b|lodging/.test(s)) return [] // no matching Curated category
  if (/bar|pub|cocktail|brasserie/.test(s)) out.add('bars')
  if (/wine|vin|cave/.test(s)) out.add('bars')
  if (/coffee|caf|koffie/.test(s)) out.add('coffee')
  if (/bakery|patiss|chocola|boucher|shop|winkel|deli/.test(s)) out.add('shopping')
  if (/restaurant|bistro|table|eat|food/.test(s) || out.size === 0) out.add('food')
  return [...out]
}

interface Feed {
  places?: {
    name?: string
    address?: { street?: string; city?: string; postalCode?: string; country?: string }
    coordinates?: { lat?: number; lng?: number }
    categories?: string[]
    url?: string
  }[]
}

async function fetchFeed(host: string): Promise<Feed | null> {
  for (const f of FEEDS) {
    try {
      const res = await fetch(`https://${host}/.well-known/${f}`, { headers: { 'User-Agent': UA } })
      if (!res.ok) continue
      return (await res.json()) as Feed
    } catch {
      /* try the next filename */
    }
  }
  return null
}

async function run() {
  const out: ImportedPlace[] = []

  for (const { host, country } of COUNTRIES) {
    const feed = await fetchFeed(host)
    if (!feed?.places?.length) {
      console.log(`${host}: no feed`)
      continue
    }
    let kept = 0
    for (const p of feed.places) {
      const lat = Number(p.coordinates?.lat)
      const lng = Number(p.coordinates?.lng)
      if (!p.name || !Number.isFinite(lat) || !Number.isFinite(lng)) continue
      const categories = toCategories(p.categories ?? [])
      if (categories.length === 0) continue

      const city = p.address?.city ?? ''
      out.push({
        name: p.name.trim(),
        categories,
        lat,
        lng,
        address: [p.address?.street, p.address?.postalCode, city].filter(Boolean).join(', '),
        locality: [city, country].filter(Boolean).join(', '),
        source: 'Gault&Millau',
        sourceUrl: p.url ?? `https://${host}`,
      })
      kept++
    }
    console.log(`${host}: ${kept} places`)
  }

  mkdirSync(OUT_DIR, { recursive: true })
  writeFileSync(join(OUT_DIR, 'gaultmillau-places.json'), JSON.stringify(out, null, 1))
  console.log(`\nwrote ${out.length} places`)
}

run()
