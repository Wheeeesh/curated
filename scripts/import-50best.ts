/**
 * Imports venue LOCATIONS from The World's 50 Best.
 *
 * Their robots.txt names ClaudeBot and anthropic-ai explicitly, allows them
 * everywhere except a dashboard page, and asks for a one-second crawl delay —
 * which this honours. Venue pages carry schema.org JSON-LD with a name and a
 * postal address, so nothing is parsed out of the page's prose.
 *
 * The lists have no coordinates, so addresses are resolved through the shared
 * open-geodata geocoder: the selection is theirs, the coordinates are OSM's.
 *
 * Takes only name, address and coordinates. Rankings, scores and their write-
 * ups are deliberately NOT imported — Curated ranks by member reviews alone.
 *
 *   npx tsx scripts/import-50best.ts
 *
 * Writes scripts/data/50best-places.json.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { ImportedPlace } from './import-lefooding'
import { geocode, saveCache } from './geocode'

const HERE = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = join(HERE, 'data')
const SITEMAP = 'https://www.theworlds50best.com/sitemap.xml'
// Identifies the bot their robots.txt explicitly welcomes.
const UA = 'ClaudeBot/1.0 (+https://github.com/Wheeeesh/curated; personal map project)'
/** robots.txt asks for Crawl-delay: 1. */
const CRAWL_DELAY_MS = 1100

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * Which part of the site a venue came from decides its categories. Hotels are
 * skipped outright: Curated has no lodging category.
 */
function sectionCategories(url: string): string[] | null {
  if (url.includes('/hotels/')) return null
  if (url.includes('/bars/')) return ['bars', 'nightlife']
  if (url.includes('/vineyards/')) return ['bars']
  if (url.includes('/restaurants/')) return ['food']
  return null
}

function listName(url: string): string {
  if (url.includes('/bars/')) return "The World's 50 Best Bars"
  if (url.includes('/vineyards/')) return "The World's 50 Best Vineyards"
  return "The World's 50 Best Restaurants"
}

interface Posted {
  '@type'?: string
  name?: string
  address?: { streetAddress?: string; addressLocality?: string; addressCountry?: string }
}

/** The venue block is the one that is not the site-wide WebSite entry. */
function venueJsonLd(html: string): Posted | null {
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
  for (const [, body] of blocks) {
    try {
      const d = JSON.parse(body) as Posted
      const t = d['@type'] ?? ''
      if (t && t !== 'WebSite' && d.name) return d
    } catch {
      /* malformed block — try the next */
    }
  }
  return null
}

async function fetchText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA } })
    return res.ok ? await res.text() : null
  } catch {
    return null
  }
}

async function run() {
  const sitemap = await fetchText(SITEMAP)
  if (!sitemap) throw new Error('could not read the sitemap')

  const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)]
    .map((m) => m[1])
    .filter((u) => /\/the-list(-51-100)?\//.test(u))
    .filter((u) => sectionCategories(u) !== null)

  console.log(`${urls.length} venue pages to read`)

  const out: ImportedPlace[] = []
  let noData = 0
  let noGeo = 0

  for (const [i, url] of urls.entries()) {
    await sleep(CRAWL_DELAY_MS)
    const html = await fetchText(url)
    if (!html) { noData++; continue }

    const d = venueJsonLd(html)
    const name = d?.name?.trim()
    if (!name) { noData++; continue }

    const street = d?.address?.streetAddress?.trim() ?? ''
    const city = d?.address?.addressLocality?.trim() ?? ''
    // Name first: Photon is venue-aware, and a bare street can be ambiguous.
    const point =
      (await geocode([name, street, city].filter(Boolean).join(', '))) ??
      (street ? await geocode([street, city].filter(Boolean).join(', ')) : null)
    if (!point) { noGeo++; continue }

    out.push({
      name,
      categories: sectionCategories(url)!,
      lat: point.lat,
      lng: point.lng,
      address: [street, city].filter(Boolean).join(', ') || point.address,
      locality: city ? [city, point.locality.split(', ').pop()].filter(Boolean).join(', ') : point.locality,
      source: listName(url),
      sourceUrl: url,
    })

    if ((i + 1) % 50 === 0) {
      console.log(`  …${i + 1}/${urls.length} (${out.length} kept)`)
      saveCache()
    }
  }

  saveCache()
  mkdirSync(OUT_DIR, { recursive: true })
  writeFileSync(join(OUT_DIR, '50best-places.json'), JSON.stringify(out, null, 1))
  console.log(`\nwrote ${out.length} places (${noData} without listing data, ${noGeo} not geocodable)`)
}

run()
