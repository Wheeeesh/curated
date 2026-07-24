/**
 * Imports venue LOCATIONS from Wikidata.
 *
 * Wikidata is CC0 (public domain) and exposes a public SPARQL endpoint, so
 * nothing here is scraped and nothing is licence-encumbered. It is also the
 * only lawful route to the Michelin selection: guide.michelin.com refuses
 * automated requests, but the awards themselves are recorded on Wikidata as
 * statements, contributed by its editors.
 *
 * Takes only name, address and coordinates — no editorial, no scores.
 *
 *   npx tsx scripts/import-wikidata.ts
 *
 * Writes scripts/data/wikidata-places.json.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { ImportedPlace } from './import-lefooding'

const HERE = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = join(HERE, 'data')
const ENDPOINT = 'https://query.wikidata.org/sparql'
// Wikimedia asks for a descriptive agent that identifies the project.
const UA = 'CuratedAtlasBot/1.0 (personal map project; contact via github.com/Wheeeesh/curated)'

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Labels are resolved in English first, then the venue's likely local language. */
const LABEL_SERVICE = 'SERVICE wikibase:label { bd:serviceParam wikibase:language "en,fr,nl,de,it,es,pt,ja". }'

/**
 * Common shape: a thing with coordinates, plus whatever address parts exist.
 * `?item` must be bound by the caller's `where` clause.
 */
const detailQuery = (where: string): string => `
SELECT DISTINCT ?item ?itemLabel ?coord ?countryLabel ?adminLabel ?street WHERE {
  ${where}
  ?item wdt:P625 ?coord .
  OPTIONAL { ?item wdt:P17 ?country }
  OPTIONAL { ?item wdt:P131 ?admin }
  OPTIONAL { ?item wdt:P6375 ?street }
  ${LABEL_SERVICE}
}`

interface Job {
  label: string
  categories: string[]
  source: string
  where: string
}

const JOBS: Job[] = [
  {
    label: 'Michelin-starred restaurants',
    categories: ['food'],
    // The selection is Michelin's; the record of it is Wikidata's. Credit both.
    source: 'Michelin Guide (via Wikidata)',
    where: '?item p:P166/ps:P166 wd:Q20824563 .',
  },
  {
    label: 'art museums',
    categories: ['art', 'culture'],
    source: 'Wikidata',
    // An English Wikipedia article stands in for notability — without it this
    // is 9,000+ entries, most of them a single room in a small town.
    where: `?item wdt:P31/wdt:P279* wd:Q207694 .
  ?article schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> .`,
  },
  {
    label: 'art galleries',
    categories: ['art'],
    source: 'Wikidata',
    where: `?item wdt:P31/wdt:P279* wd:Q1007870 .
  ?article schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> .`,
  },
]

interface Binding {
  item: { value: string }
  itemLabel?: { value: string }
  coord?: { value: string }
  countryLabel?: { value: string }
  adminLabel?: { value: string }
  street?: { value: string }
}

async function sparql(query: string): Promise<Binding[]> {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/sparql-query',
      Accept: 'application/sparql-results+json',
      'User-Agent': UA,
    },
    body: query,
  })
  if (!res.ok) throw new Error(`SPARQL ${res.status} ${res.statusText}`)
  const json = (await res.json()) as { results: { bindings: Binding[] } }
  return json.results.bindings
}

/** Wikidata serialises points as "Point(lng lat)". */
function parsePoint(wkt: string): { lat: number; lng: number } | null {
  const m = /Point\(([-\d.eE]+)\s+([-\d.eE]+)\)/.exec(wkt)
  if (!m) return null
  const lng = Number(m[1])
  const lat = Number(m[2])
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null
}

/** A Q-id where a label should be means the label service found nothing useful. */
const isQid = (s: string): boolean => /^Q\d+$/.test(s)

async function run() {
  const out: ImportedPlace[] = []

  for (const job of JOBS) {
    const rows = await sparql(detailQuery(job.where))
    // OPTIONAL clauses multiply rows, so collapse back to one entry per item.
    const seen = new Set<string>()
    let kept = 0

    for (const r of rows) {
      if (seen.has(r.item.value)) continue
      const name = r.itemLabel?.value?.trim()
      const point = r.coord ? parsePoint(r.coord.value) : null
      if (!name || isQid(name) || !point) continue
      seen.add(r.item.value)

      const admin = r.adminLabel?.value
      const country = r.countryLabel?.value
      const parts = [admin, country].filter((s): s is string => !!s && !isQid(s))

      out.push({
        name,
        categories: job.categories,
        lat: point.lat,
        lng: point.lng,
        address: [r.street?.value, ...parts].filter(Boolean).join(', '),
        locality: parts.join(', '),
        source: job.source,
        sourceUrl: r.item.value,
      })
      kept++
    }

    console.log(`${job.label}: ${kept} places (${rows.length} rows)`)
    await sleep(1500) // the endpoint is a shared public resource
  }

  mkdirSync(OUT_DIR, { recursive: true })
  writeFileSync(join(OUT_DIR, 'wikidata-places.json'), JSON.stringify(out, null, 1))
  console.log(`\nwrote ${out.length} places`)
}

run()
