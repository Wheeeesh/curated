/**
 * Imports venue LOCATIONS from Eater's city map guides.
 *
 * Eater's robots.txt allows the wildcard agent everywhere except /wp-admin.
 * Their "/maps/" guides embed each venue as structured data — name, address
 * and real coordinates — so nothing is geocoded and nothing is scraped out of
 * the editorial prose.
 *
 * Guides are discovered through the published monthly sitemaps rather than by
 * crawling the site.
 *
 * Takes only name, address and coordinates. Their write-ups and rankings are
 * deliberately NOT imported.
 *
 *   npx tsx scripts/import-eater.ts
 *
 * Writes scripts/data/eater-places.json.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import type { ImportedPlace } from './import-lefooding'

const HERE = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = join(HERE, 'data')
const SITEMAP_INDEX = 'https://www.eater.com/sitemaps'
const UA = 'CuratedAtlasBot/1.0 (personal map project; contact via github.com/Wheeeesh/curated)'
const CRAWL_DELAY_MS = 1100
/** How far back to read the monthly archives. */
const MONTHS = 72

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Guides are titled by what they cover; that is the only category signal. */
function categoriesFor(url: string): string[] {
  const s = url.toLowerCase()
  if (/coffee|cafe|espresso/.test(s)) return ['coffee']
  if (/\bbars?\b|cocktail|brewer|beer|wine/.test(s)) return ['bars']
  if (/bakery|bakeries|pastry|dessert|ice-cream/.test(s)) return ['food', 'shopping']
  return ['food']
}

async function fetchText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA } })
    return res.ok ? await res.text() : null
  } catch {
    return null
  }
}

const unescapeJson = (s: string): string => {
  try {
    return JSON.parse(`"${s.replace(/"/g, '\\"')}"`) as string
  } catch {
    return s
  }
}

interface Venue {
  name: string
  lat: number
  lng: number
  address: string
}

/**
 * Venues appear in an embedded payload as
 *   "location":{"latitude":48.8,"longitude":2.3},"name":"Juveniles", … ,"address":"47 Rue …"
 * The address sits in a sibling object a little further along, so it is picked
 * up from the window of text that follows the coordinates.
 */
function parseVenues(html: string): Venue[] {
  const out: Venue[] = []
  const re = /"location":\{"latitude":(-?[\d.]+),"longitude":(-?[\d.]+)\},"name":"((?:[^"\\]|\\.)*)"/g
  let m: RegExpExecArray | null

  while ((m = re.exec(html))) {
    const lat = Number(m[1])
    const lng = Number(m[2])
    const name = unescapeJson(m[3]).trim()
    if (!name || !Number.isFinite(lat) || !Number.isFinite(lng)) continue
    if (lat === 0 && lng === 0) continue

    const window = html.slice(m.index, m.index + 1600)
    const addr = /"address":"((?:[^"\\]|\\.)*)"/.exec(window)
    out.push({ name, lat, lng, address: addr ? unescapeJson(addr[1]).trim() : '' })
  }
  return out
}

const COUNTRY_ALIASES: Record<string, string> = {
  us: 'United States',
  usa: 'United States',
  uk: 'United Kingdom',
  gb: 'United Kingdom',
  uae: 'United Arab Emirates',
}

/** Postcodes, state codes and abbreviations sit between the city and country. */
const isNoise = (s: string): boolean =>
  /^\d[\d\s-]*$/.test(s) || // 60615, 75001
  /^[A-Z]{2}(\s+[\d-]{3,10})?$/.test(s) || // IL, CA 94086
  /^[A-Za-z]{2,5}\.$/.test(s) // Oax.

/**
 * "1462 E 53rd St, Chicago, IL, 60615, US" → "Chicago, United States".
 * Addresses arrive in every shape imaginable, so this walks in from the end
 * discarding postcodes and state codes until something city-like remains.
 */
export function localityFrom(address: string): string {
  const parts = address.split(',').map((s) => s.trim()).filter(Boolean)
  if (parts.length === 0) return ''
  if (parts.length === 1) return parts[0]

  let country = ''
  const rest = [...parts]
  const last = rest[rest.length - 1]
  // A country is the trailing part with no digits in it.
  if (!/\d/.test(last) && !/^[A-Z]{2}$/.test(last)) {
    country = COUNTRY_ALIASES[last.toLowerCase()] ?? last
    rest.pop()
  } else if (COUNTRY_ALIASES[last.toLowerCase()]) {
    country = COUNTRY_ALIASES[last.toLowerCase()]
    rest.pop()
  }

  let city = ''
  for (let i = rest.length - 1; i >= 0; i--) {
    // Strip an attached postcode: "68000 Oaxaca", "Hawaii 96753".
    const cleaned = rest[i].replace(/\b[\d-]{4,10}\b/g, '').trim()
    if (!cleaned || isNoise(rest[i])) continue
    // The first element is the street, never the city, unless it is all we have.
    if (i === 0 && rest.length > 1) break
    city = cleaned
    break
  }

  return [city, country].filter(Boolean).join(', ') || country || parts[parts.length - 1]
}

async function run() {
  const index = await fetchText(SITEMAP_INDEX)
  if (!index) throw new Error('could not read the sitemap index')

  const monthly = [...index.matchAll(/<loc>([^<]+\/sitemaps\/entries\/\d+\/\d+)<\/loc>/g)]
    .map((m) => m[1])
    .slice(0, MONTHS)
  console.log(`${monthly.length} monthly archives to scan`)

  const guides = new Set<string>()
  for (const sm of monthly) {
    await sleep(CRAWL_DELAY_MS)
    const xml = await fetchText(sm)
    if (!xml) continue
    for (const [, u] of xml.matchAll(/<loc>([^<]+)<\/loc>/g)) {
      if (u.includes('/maps/')) guides.add(u)
    }
  }
  console.log(`${guides.size} map guides found`)

  const out: ImportedPlace[] = []
  const seen = new Set<string>()
  let empty = 0

  for (const [i, url] of [...guides].entries()) {
    await sleep(CRAWL_DELAY_MS)
    const html = await fetchText(url)
    if (!html) { empty++; continue }

    const venues = parseVenues(html)
    if (venues.length === 0) empty++
    const categories = categoriesFor(url)

    for (const v of venues) {
      // The same venue turns up across a city's several guides.
      const key = `${v.name.toLowerCase()}|${v.lat.toFixed(4)}|${v.lng.toFixed(4)}`
      if (seen.has(key)) continue
      seen.add(key)

      out.push({
        name: v.name,
        categories,
        lat: v.lat,
        lng: v.lng,
        address: v.address,
        locality: localityFrom(v.address),
        source: 'Eater',
        sourceUrl: url,
      })
    }

    if ((i + 1) % 25 === 0) console.log(`  …${i + 1}/${guides.size} (${out.length} places)`)
  }

  mkdirSync(OUT_DIR, { recursive: true })
  writeFileSync(join(OUT_DIR, 'eater-places.json'), JSON.stringify(out, null, 1))
  console.log(`\nwrote ${out.length} places (${empty} guides yielded nothing)`)
}

// Only crawl when run directly — this module also exports localityFrom, and
// importing it for that should not kick off several hundred requests.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) run()
