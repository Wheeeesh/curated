export interface ParsedLocation {
  lat: number
  lng: number
  /** Venue name if the link carried one. */
  name: string
}

export type LinkParseResult =
  | { kind: 'location'; value: ParsedLocation }
  /** A shortened link we cannot resolve in the browser (CORS). */
  | { kind: 'needs-expanding' }
  | { kind: 'not-a-link' }

const inRange = (lat: number, lng: number) =>
  Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180

const tidyName = (raw: string): string => {
  try {
    return decodeURIComponent(raw.replace(/\+/g, ' ')).trim()
  } catch {
    return raw.replace(/\+/g, ' ').trim()
  }
}

/**
 * Reads a location out of a pasted map link or a raw coordinate pair, so
 * members can find a place in whichever map app they already use and paste
 * the result here. No API key and no licensing entanglement, because the
 * search happened in the other app.
 *
 * Handles Apple Maps, Google Maps long links, geo: URIs and "lat, lng".
 * Google's shortened maps.app.goo.gl links redirect, and the browser cannot
 * follow them cross-origin, so those are reported back for the UI to explain.
 */
export function parseLocationInput(input: string): LinkParseResult {
  const text = input.trim()
  if (!text) return { kind: 'not-a-link' }

  // ——— raw coordinates: "51.2211, 4.4046" ———
  const rawCoords = text.match(/^\s*(-?\d{1,3}(?:\.\d+)?)\s*[,;]\s*(-?\d{1,3}(?:\.\d+)?)\s*$/)
  if (rawCoords) {
    const lat = parseFloat(rawCoords[1])
    const lng = parseFloat(rawCoords[2])
    if (inRange(lat, lng)) return { kind: 'location', value: { lat, lng, name: '' } }
  }

  if (!/^https?:\/\//i.test(text) && !/^geo:/i.test(text)) return { kind: 'not-a-link' }

  // ——— geo:51.2211,4.4046 ———
  const geo = text.match(/^geo:(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/i)
  if (geo) {
    const lat = parseFloat(geo[1])
    const lng = parseFloat(geo[2])
    if (inRange(lat, lng)) return { kind: 'location', value: { lat, lng, name: '' } }
  }

  let url: URL
  try {
    url = new URL(text)
  } catch {
    return { kind: 'not-a-link' }
  }
  const host = url.hostname.toLowerCase()

  // ——— shortened links we cannot expand from the browser ———
  if (/(^|\.)(goo\.gl|maps\.app\.goo\.gl|g\.co)$/.test(host)) {
    return { kind: 'needs-expanding' }
  }

  // ——— Apple Maps: ...?ll=51.22,4.40&q=Name  (also coordinate=) ———
  if (host.endsWith('maps.apple.com')) {
    const ll = url.searchParams.get('ll') ?? url.searchParams.get('coordinate') ?? url.searchParams.get('sll')
    const pair = ll?.match(/(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/)
    if (pair) {
      const lat = parseFloat(pair[1])
      const lng = parseFloat(pair[2])
      const q = url.searchParams.get('q') ?? url.searchParams.get('name') ?? ''
      // Apple uses q for the coordinates themselves on dropped pins.
      const name = /^-?\d/.test(q) ? '' : tidyName(q)
      if (inRange(lat, lng)) return { kind: 'location', value: { lat, lng, name } }
    }
  }

  // ——— Google Maps ———
  if (host.includes('google.')) {
    const path = decodeURIComponent(url.pathname)

    // The !3d/!4d pair is the place itself; @lat,lng is only the viewport.
    const exact = text.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/)
    const at = path.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/)
    const qParam = url.searchParams.get('q') ?? url.searchParams.get('query') ?? ''
    const qCoords = qParam.match(/^(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)$/)

    const chosen = exact ?? qCoords ?? at
    if (chosen) {
      const lat = parseFloat(chosen[1])
      const lng = parseFloat(chosen[2])
      // /maps/place/Some+Venue/@... — the segment after "place" is the name.
      const placeName = path.match(/\/place\/([^/@]+)/)
      const name = placeName ? tidyName(placeName[1]) : /^-?\d/.test(qParam) ? '' : tidyName(qParam)
      if (inRange(lat, lng)) return { kind: 'location', value: { lat, lng, name } }
    }
  }

  return { kind: 'not-a-link' }
}
