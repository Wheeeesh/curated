/**
 * Imports venue LOCATIONS from Le Fooding into the atlas.
 *
 * Takes only the facts needed to put a pin on a map — name, street address,
 * locality, country and coordinates — from the schema.org JSON-LD that the
 * site publishes for machine consumption. Their editorial reviews, ratings,
 * photos and descriptions are deliberately NOT read or stored: Curated's
 * recommendations come from its own members' reviews, and the guide's
 * writing is theirs.
 *
 * lefooding.com/robots.txt allows all agents (checked 2026-07-22); requests
 * are serialised in small batches with a delay so the site is not hammered.
 *
 *   npx tsx scripts/import-lefooding.ts [--limit N]
 *
 * Writes scripts/data/lefooding-places.json.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = join(HERE, 'data')

const UA = 'CuratedAtlasBot/1.0 (personal map project; contact via github.com/Wheeeesh/curated)'
const CONCURRENCY = 6
const DELAY_MS = 120

/** Le Fooding content type → Curated categories. */
const TYPE_CATEGORIES: Record<string, string[]> = {
  restaurant: ['food'],
  winecellar: ['bars', 'shopping'],
  deli: ['food', 'shopping'],
}

export interface ImportedPlace {
  name: string
  categories: string[]
  lat: number
  lng: number
  address: string
  locality: string
  source: string
  sourceUrl: string
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function get(url: string, tries = 3): Promise<string | null> {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'text/html,application/xml' } })
      if (res.status === 429 || res.status >= 500) {
        await sleep(1500 * (i + 1))
        continue
      }
      if (!res.ok) return null
      return await res.text()
    } catch {
      await sleep(800 * (i + 1))
    }
  }
  return null
}

async function sitemapUrls(type: string): Promise<string[]> {
  const xml = await get(`https://lefooding.com/wp-json/api/v1/sitemap/${type}.xml`)
  if (!xml) return []
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim())
}

/** Pull the venue's own JSON-LD node — the one carrying an address. */
function extractPlace(html: string, type: string, url: string): ImportedPlace | null {
  const blocks = [...html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1])
  for (const raw of blocks) {
    let parsed: unknown
    try {
      parsed = JSON.parse(raw.trim())
    } catch {
      continue
    }
    const nodes = Array.isArray(parsed) ? parsed : [parsed]
    for (const n of nodes as Record<string, any>[]) {
      const geo = n?.geo
      const addr = n?.address
      if (!geo || !addr || typeof n.name !== 'string') continue
      const lat = Number(geo.latitude)
      const lng = Number(geo.longitude)
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) continue

      // Street numbers are sometimes glued to the street ("3Stationsstraat").
      const street = String(addr.streetAddress ?? '').replace(/^(\d+[a-zA-Z]?)(?=[A-Za-zÀ-ÿ])/, '$1 ').trim()
      const localityParts = [addr.addressLocality, addr.addressCountry].filter(Boolean).map(String)

      return {
        name: n.name.trim(),
        categories: TYPE_CATEGORIES[type] ?? ['food'],
        lat,
        lng,
        address: [street, addr.postalCode, addr.addressLocality].filter(Boolean).join(', '),
        locality: localityParts.join(', '),
        source: 'Le Fooding',
        sourceUrl: url,
      }
    }
  }
  return null
}

async function run() {
  const limitArg = process.argv.indexOf('--limit')
  const limit = limitArg > -1 ? Number(process.argv[limitArg + 1]) : Infinity

  const targets: { url: string; type: string }[] = []
  for (const type of Object.keys(TYPE_CATEGORIES)) {
    const urls = await sitemapUrls(type)
    console.log(`${type}: ${urls.length} urls`)
    for (const url of urls) targets.push({ url, type })
  }

  const queue = targets.slice(0, limit === Infinity ? targets.length : limit)
  console.log(`fetching ${queue.length} venue pages…`)

  const out: ImportedPlace[] = []
  let done = 0
  let failed = 0

  const workers = Array.from({ length: CONCURRENCY }, async () => {
    for (;;) {
      const item = queue.shift()
      if (!item) return
      const html = await get(item.url)
      if (html) {
        const place = extractPlace(html, item.type, item.url)
        if (place) out.push(place)
        else failed++
      } else {
        failed++
      }
      done++
      if (done % 200 === 0) console.log(`  ${done} fetched · ${out.length} with coordinates · ${failed} skipped`)
      await sleep(DELAY_MS)
    }
  })
  await Promise.all(workers)

  // One venue can appear under several types; keep the first and merge categories.
  const byKey = new Map<string, ImportedPlace>()
  for (const p of out) {
    const key = `${p.name.toLowerCase()}|${p.lat.toFixed(4)}|${p.lng.toFixed(4)}`
    const existing = byKey.get(key)
    if (existing) {
      existing.categories = [...new Set([...existing.categories, ...p.categories])]
    } else {
      byKey.set(key, p)
    }
  }
  const places = [...byKey.values()]

  mkdirSync(OUT_DIR, { recursive: true })
  writeFileSync(join(OUT_DIR, 'lefooding-places.json'), JSON.stringify(places, null, 1))
  console.log(`\nwrote ${places.length} places (from ${done} pages, ${failed} without usable data)`)
}

run()
