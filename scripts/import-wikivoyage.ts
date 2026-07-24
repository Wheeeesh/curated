/**
 * Imports venue LOCATIONS from Wikivoyage's listing templates.
 *
 * Wikivoyage is CC BY-SA: the listings are traveller-written and the licence
 * requires attribution, which the atlas gives as "Listed by Wikivoyage" on
 * every place. Only articles Wikivoyage itself rates Star or Guide are used —
 * its own vetted, well-developed destination guides — which is both a real
 * quality signal and what keeps this to a sane number of places.
 *
 * Content comes from the MediaWiki API, 50 articles per request, so this is
 * ~30 requests rather than a crawl.
 *
 * Takes only name, address and coordinates — never the written descriptions.
 *
 *   npx tsx scripts/import-wikivoyage.ts
 *
 * Writes scripts/data/wikivoyage-places.json.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { ImportedPlace } from './import-lefooding'

const HERE = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = join(HERE, 'data')
const API = 'https://en.wikivoyage.org/w/api.php'
const UA = 'CuratedAtlasBot/1.0 (personal map project; contact via github.com/Wheeeesh/curated)'

/** Wikivoyage's own article-quality grades, best first. */
const QUALITY_CATEGORIES = ['Star articles', 'Guide articles']

/**
 * Listings per article, per grade. A Star article is one of ~80 places on
 * earth Wikivoyage considers exemplary, so it earns more room; Guide articles
 * are capped tightly because there are 1,400+ of them and the atlas has to fit
 * in a phone.
 */
const PER_ARTICLE = { Star: 24, Guide: 8 }

/** Articles per content request, and the pause between them. */
const BATCH = 20
const BATCH_DELAY_MS = 1200

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Listing template → Curated categories. `sleep` and `do` have no clean map. */
const TEMPLATE_CATEGORIES: Record<string, string[]> = {
  eat: ['food'],
  drink: ['bars'],
  see: ['culture'],
  buy: ['shopping'],
}

/**
 * The API rate-limits anonymous callers hard, and full article content is a
 * heavy request. Back off and retry rather than hammering a free service.
 */
async function api(params: Record<string, string>): Promise<Record<string, unknown>> {
  const url = `${API}?${new URLSearchParams({ format: 'json', formatversion: '2', ...params })}`
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, { headers: { 'User-Agent': UA } })
    if (res.ok) return (await res.json()) as Record<string, unknown>
    if ((res.status === 429 || res.status >= 500) && attempt < 6) {
      const retryAfter = Number(res.headers.get('retry-after'))
      const wait = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 2000 * 2 ** attempt
      console.log(`  ${res.status} — waiting ${Math.round(wait / 1000)}s`)
      await sleep(wait)
      continue
    }
    throw new Error(`${res.status} ${res.statusText}`)
  }
}

/** Every mainspace article in a category, following continuation. */
async function categoryMembers(category: string): Promise<string[]> {
  const titles: string[] = []
  let cont: string | undefined
  do {
    const data = (await api({
      action: 'query',
      list: 'categorymembers',
      cmtitle: `Category:${category}`,
      cmnamespace: '0',
      cmlimit: '500',
      ...(cont ? { cmcontinue: cont } : {}),
    })) as {
      query?: { categorymembers?: { title: string }[] }
      continue?: { cmcontinue?: string }
    }
    for (const m of data.query?.categorymembers ?? []) titles.push(m.title)
    cont = data.continue?.cmcontinue
    await sleep(300)
  } while (cont)
  return titles
}

/** Raw wikitext for up to 50 articles at a time. */
async function articleContents(titles: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  const data = (await api({
    action: 'query',
    titles: titles.join('|'),
    prop: 'revisions',
    rvprop: 'content',
    rvslots: 'main',
  })) as {
    query?: { pages?: { title: string; revisions?: { slots?: { main?: { content?: string } } }[] }[] }
  }
  for (const p of data.query?.pages ?? []) {
    const text = p.revisions?.[0]?.slots?.main?.content
    if (text) out.set(p.title, text)
  }
  return out
}

/** `| name=Foo | lat=1.2` — values run to the next pipe or the closing braces. */
function param(body: string, key: string): string {
  const m = new RegExp(`\\|\\s*${key}\\s*=\\s*([^|}]*)`, 'i').exec(body)
  return m ? m[1].trim() : ''
}

interface Listing {
  name: string
  address: string
  lat: number
  lng: number
  categories: string[]
}

/**
 * Pulls `{{eat|...}}`-style listings out of wikitext. Templates can nest, so
 * the closing braces are found by counting depth rather than by regex.
 */
function parseListings(text: string): Listing[] {
  const out: Listing[] = []
  const open = /\{\{\s*(eat|drink|see|buy)\b/gi
  let m: RegExpExecArray | null

  while ((m = open.exec(text))) {
    const type = m[1].toLowerCase()
    let depth = 0
    let end = m.index
    for (let i = m.index; i < text.length - 1; i++) {
      if (text[i] === '{' && text[i + 1] === '{') { depth++; i++ }
      else if (text[i] === '}' && text[i + 1] === '}') {
        depth--
        if (depth === 0) { end = i; break }
        i++
      }
    }
    if (end <= m.index) continue
    const body = text.slice(m.index, end)

    const name = param(body, 'name')
    const lat = Number(param(body, 'lat'))
    const lng = Number(param(body, 'long'))
    if (!name || !Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) continue

    out.push({
      // Wiki markup leaks into names now and then; strip the common bits.
      name: name.replace(/\[\[([^\]|]*\|)?([^\]]*)\]\]/g, '$2').replace(/'''?/g, '').trim(),
      address: param(body, 'address'),
      lat,
      lng,
      categories: TEMPLATE_CATEGORIES[type] ?? [],
    })
  }
  return out
}

/** "Ghent/Old Town" and "Paris/1st arrondissement" both belong to their city. */
const localityOf = (title: string): string => title.split('/')[0].trim()

async function run() {
  const out: ImportedPlace[] = []
  let articlesWithListings = 0
  let dropped = 0

  for (const category of QUALITY_CATEGORIES) {
    const grade = category.startsWith('Star') ? 'Star' : 'Guide'
    const cap = PER_ARTICLE[grade as keyof typeof PER_ARTICLE]
    const titles = await categoryMembers(category)
    console.log(`${category}: ${titles.length} articles`)

    for (let i = 0; i < titles.length; i += BATCH) {
      const batch = titles.slice(i, i + BATCH)
      const contents = await articleContents(batch)

      for (const [title, text] of contents) {
        const listings = parseListings(text)
        if (listings.length === 0) continue
        articlesWithListings++

        // Spread the cap across types so a city does not come back as
        // sixteen restaurants and nothing else.
        const byType = new Map<string, Listing[]>()
        for (const l of listings) {
          const key = l.categories[0] ?? 'other'
          const arr = byType.get(key) ?? []
          arr.push(l)
          byType.set(key, arr)
        }
        const perType = Math.max(1, Math.ceil(cap / Math.max(1, byType.size)))
        const chosen: Listing[] = []
        for (const arr of byType.values()) chosen.push(...arr.slice(0, perType))
        dropped += listings.length - chosen.length

        for (const l of chosen.slice(0, cap)) {
          if (l.categories.length === 0) continue
          out.push({
            name: l.name,
            categories: l.categories,
            lat: l.lat,
            lng: l.lng,
            address: l.address || localityOf(title),
            locality: localityOf(title),
            source: 'Wikivoyage',
            sourceUrl: `https://en.wikivoyage.org/wiki/${encodeURIComponent(title)}`,
          })
        }
      }
      await sleep(BATCH_DELAY_MS)
      if (i % 200 === 0 && i > 0) console.log(`  …${i}/${titles.length} (${out.length} places)`)
    }
  }

  mkdirSync(OUT_DIR, { recursive: true })
  writeFileSync(join(OUT_DIR, 'wikivoyage-places.json'), JSON.stringify(out, null, 1))
  console.log(`\n${articlesWithListings} articles had listings; ${dropped} listings left out by the cap`)
  console.log(`wrote ${out.length} places`)
}

run()
