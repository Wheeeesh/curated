/**
 * Imports venue LOCATIONS from Time Out's city guides.
 *
 * Time Out's robots.txt allows the wildcard agent; the `Disallow: /` entries
 * in it apply to a handful of named spam crawlers, not to everyone.
 *
 * Their listicles carry no structured venue data — entries are numbered
 * headings with an "Address:" line in the prose — so only the venue name and
 * that address line are read, and coordinates come from the shared open
 * geocoder. Nothing of their editorial is imported.
 *
 * Guide URLs are not consistently derivable, so a fixed list of city hubs is
 * probed and whatever does not resolve is skipped. That means coverage here is
 * deliberately partial: the world's larger cities rather than everywhere.
 *
 *   npx tsx scripts/import-timeout.ts
 *
 * Writes scripts/data/timeout-places.json.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { ImportedPlace } from './import-lefooding'
import { geocode, saveCache } from './geocode'

const HERE = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = join(HERE, 'data')
const UA = 'CuratedAtlasBot/1.0 (personal map project; contact via github.com/Wheeeesh/curated)'
const CRAWL_DELAY_MS = 1100

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Time Out's own city hubs: [url slug, the slug used inside article names]. */
const CITIES: [string, string][] = [
  ['london', 'london'], ['newyork', 'nyc'], ['paris', 'paris'], ['tokyo', 'tokyo'],
  ['barcelona', 'barcelona'], ['berlin', 'berlin'], ['madrid', 'madrid'], ['rome', 'rome'],
  ['lisbon', 'lisbon'], ['amsterdam', 'amsterdam'], ['chicago', 'chicago'],
  ['losangeles', 'los-angeles'], ['sanfrancisco', 'san-francisco'], ['miami', 'miami'],
  ['boston', 'boston'], ['melbourne', 'melbourne'], ['sydney', 'sydney'],
  ['hongkong', 'hong-kong'], ['singapore', 'singapore'], ['dubai', 'dubai'],
  ['mexicocity', 'mexico-city'], ['buenosaires', 'buenos-aires'], ['montreal', 'montreal'],
  ['toronto', 'toronto'], ['vienna', 'vienna'], ['prague', 'prague'], ['budapest', 'budapest'],
  ['copenhagen', 'copenhagen'], ['stockholm', 'stockholm'], ['dublin', 'dublin'],
  ['edinburgh', 'edinburgh'], ['manchester', 'manchester'], ['porto', 'porto'],
  ['milan', 'milan'], ['naples', 'naples'], ['athens', 'athens'], ['istanbul', 'istanbul'],
  ['seoul', 'seoul'], ['bangkok', 'bangkok'], ['shanghai', 'shanghai'],
  ['brussels', 'brussels'], ['marseille', 'marseille'], ['valencia', 'valencia'],
  ['seville', 'seville'], ['krakow', 'krakow'], ['zurich', 'zurich'],
]

/** Article shapes that exist for most cities, with the categories they imply. */
const GUIDES: { path: (name: string) => string; categories: string[] }[] = [
  { path: (n) => `restaurants/best-restaurants-in-${n}`, categories: ['food'] },
  { path: (n) => `restaurants/best-restaurants-${n}`, categories: ['food'] },
  { path: (n) => `bars/best-bars-in-${n}`, categories: ['bars'] },
  { path: (n) => `bars/best-bars-${n}`, categories: ['bars'] },
  { path: (n) => `restaurants/best-cafes-in-${n}`, categories: ['coffee'] },
]

async function fetchText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow' })
    return res.ok ? await res.text() : null
  } catch {
    return null
  }
}

const decode = (s: string): string =>
  s
    .replace(/&nbsp;|&#160;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&rsquo;|&#8217;/g, '’')
    .replace(/&lsquo;/g, '‘')
    .replace(/&quot;|&ldquo;|&rdquo;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&eacute;/g, 'é')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim()

interface Entry {
  name: string
  address: string
}

/**
 * Entries are `<h3>1. Camille</h3>`, with `Address: …` somewhere in the text
 * that follows before the next heading.
 */
function parseEntries(html: string): Entry[] {
  const out: Entry[] = []
  const heads = [...html.matchAll(/<h3[^>]*>([\s\S]{0,200}?)<\/h3>/g)]

  for (const [i, h] of heads.entries()) {
    const raw = decode(h[1])
    const numbered = /^(\d+)\.\s*(.+)$/.exec(raw)
    if (!numbered) continue
    const name = numbered[2].trim()
    if (!name || name.length > 90) continue

    const from = h.index + h[0].length
    const to = i + 1 < heads.length ? heads[i + 1].index : Math.min(html.length, from + 6000)
    const body = decode(html.slice(from, to))
    const addr = /Address:\s*([^.]{4,120})/i.exec(body)

    out.push({ name, address: addr ? addr[1].trim() : '' })
  }
  return out
}

async function run() {
  const out: ImportedPlace[] = []
  let pagesFound = 0
  let noGeo = 0

  for (const [slug, name] of CITIES) {
    for (const guide of GUIDES) {
      await sleep(CRAWL_DELAY_MS)
      const url = `https://www.timeout.com/${slug}/${guide.path(name)}`
      const html = await fetchText(url)
      if (!html) continue

      const entries = parseEntries(html)
      if (entries.length === 0) continue
      pagesFound++

      for (const e of entries) {
        const query = [e.name, e.address, slug].filter(Boolean).join(', ')
        const point = await geocode(query)
        if (!point) { noGeo++; continue }

        out.push({
          name: e.name,
          categories: guide.categories,
          lat: point.lat,
          lng: point.lng,
          address: e.address || point.address,
          locality: point.locality,
          source: 'Time Out',
          sourceUrl: url,
        })
      }
      console.log(`  ${slug}/${guide.path(name).split('/')[1]}: ${entries.length} entries (${out.length} total)`)
      saveCache()
    }
  }

  saveCache()
  mkdirSync(OUT_DIR, { recursive: true })
  writeFileSync(join(OUT_DIR, 'timeout-places.json'), JSON.stringify(out, null, 1))
  console.log(`\n${pagesFound} guides read; ${noGeo} entries not geocodable`)
  console.log(`wrote ${out.length} places`)
}

run()
