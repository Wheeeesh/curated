import type { Aspect, Review } from '../lib/api/types'
import { aspectsForCategories, overallScore } from '../lib/api/types'
import { reviewId, seedDate } from './ids'
import { SEED_MEMBERS, memberByUsername } from './members'
import { SEED_PLACES, seedPlaceById } from './places'

/** Deterministic RNG so every fresh demo (and the SQL seed) is identical. */
function mulberry32(seed: number) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const clamp10 = (x: number) => Math.max(1, Math.min(10, Math.round(x)))

/**
 * Personas lean on particular criteria. Anything not listed sits at 0, so a
 * value hunter marks Value up wherever Value is asked, regardless of
 * whether the place is a bar, a gallery or a park.
 */
const ASPECT_BIAS: Record<string, Partial<Record<Aspect, number>>> = {
  mika: { food: -1, atmosphere: 1, coffee: -1 },
  elif: { atmosphere: 2, sound: 1, service: -1 },
  jules: { curation: 1, value: -1, food: 1 },
  nora: { value: 1, quiet: 2, scenery: 1, atmosphere: -1 },
  dae: { sound: 2, lineup: 1, value: -2 },
  sam: { service: 1, selection: 1, atmosphere: 1 },
  vera: { value: 2, drinks: 1, curation: -1 },
  ken: {},
}

function generate(): Review[] {
  const rng = mulberry32(20260601)
  const reviews: Review[] = []
  const taken = new Set<string>()
  let n = 0

  const push = (r: Omit<Review, 'id'>) => {
    n += 1
    reviews.push({ id: reviewId(n), ...r })
  }

  for (const member of SEED_MEMBERS) {
    const cities = [member.homeCity, ...member.bias.travelsTo]
    const candidates = SEED_PLACES.filter((p) => cities.includes(p.cityId) && p.baseQuality >= 6)
    const inLane = candidates.filter((p) => p.categories.some((c) => member.interests.includes(c)))
    const offLane = candidates.filter((p) => !p.categories.some((c) => member.interests.includes(c)))
    const shuffled = [...inLane, ...offLane]
      .map((p) => ({ p, sort: rng() * (p.categories.some((c) => member.interests.includes(c)) ? 0.6 : 1) }))
      .sort((a, b) => a.sort - b.sort)
      .map((x) => x.p)

    let written = 0
    for (const place of shuffled) {
      if (written >= member.bias.reviewCount) break
      const key = `${member.id}:${place.id}`
      if (taken.has(key)) continue
      taken.add(key)
      written += 1

      const bias = ASPECT_BIAS[member.username] ?? {}
      const scores: Partial<Record<Aspect, number>> = {}
      for (const aspect of aspectsForCategories(place.categories)) {
        const noise = (rng() - 0.5) * 2
        scores[aspect] = clamp10(place.baseQuality + member.bias.meanOffset + (bias[aspect] ?? 0) + noise)
      }
      const overall = overallScore({ scores })

      const v = member.voice
      let text: string
      if (rng() < 0.42) {
        text = v.short[Math.floor(rng() * v.short.length)]
      } else if (overall >= 7.3) {
        text = `${v.praise[Math.floor(rng() * v.praise.length)]} ${v.short[Math.floor(rng() * v.short.length)]}`
      } else {
        text = `${v.mixed[Math.floor(rng() * v.mixed.length)]} ${v.short[Math.floor(rng() * v.short.length)]}`
      }

      const when = seedDate(2 + Math.floor(rng() * 150))
      push({
        placeId: place.id,
        userId: member.id,
        scores,
        textReview: text,
        isWarning: false,
        warningReason: null,
        createdAt: when,
        updatedAt: when,
      })
    }
  }

  // ——— hand-written warnings on the three fictional tourist traps ———
  const trap = (name: string) => SEED_PLACES.find((p) => p.name === name)!
  const rate = (name: string, base: number, over: Partial<Record<Aspect, number>>) => {
    const scores: Partial<Record<Aspect, number>> = {}
    for (const a of aspectsForCategories(trap(name).categories)) scores[a] = over[a] ?? base
    return scores
  }
  const add = (username: string, placeName: string, scores: Partial<Record<Aspect, number>>, text: string, isWarning: boolean, daysAgo: number) => {
    const when = seedDate(daysAgo)
    push({
      placeId: trap(placeName).id,
      userId: memberByUsername[username].id,
      scores,
      textReview: text,
      isWarning,
      warningReason: isWarning ? text : null,
      createdAt: when,
      updatedAt: when,
    })
  }

  add('nora', 'Chez Papillon Doré', rate('Chez Papillon Doré', 2, { value: 1, atmosphere: 3 }),
    'Defrosted duck confit at €38, a mystery “service” line on the bill, and waiters who switch to bored the second you order. Built entirely for people who will never come back.', true, 12)
  add('vera', 'Sultan’s Terrace 360', rate('Sultan’s Terrace 360', 3, { value: 1, atmosphere: 6 }),
    'Nineteen-euro cocktails made with the cheapest pour on the shelf. You pay for the view twice — once at the door and once in the glass. Skip it; the çay house next door has the same view.', true, 25)
  add('mika', 'Neo Samurai Nights', rate('Neo Samurai Nights', 2, { value: 1, atmosphere: 3 }),
    'A cover charge, then a surprise “table charge”, then drinks watered past the point of argument. The show is twenty minutes of people filming other people filming.', true, 8)

  add('ken', 'Chez Papillon Doré', rate('Chez Papillon Doré', 4, { value: 2, atmosphere: 5 }),
    'The riverside table is the whole product. Eat elsewhere first, then have one coffee here for the view.', false, 40)
  add('elif', 'Sultan’s Terrace 360', rate('Sultan’s Terrace 360', 4, { value: 2, atmosphere: 7 }),
    'The view genuinely is spectacular at sunset. Everything else about the place knows it, and charges accordingly.', false, 33)
  add('dae', 'Neo Samurai Nights', rate('Neo Samurai Nights', 3, { value: 2, sound: 4 }),
    'Came for the spectacle, left after one drink. The sound system deserves a better venue.', false, 15)

  return reviews
}

export const SEED_REVIEWS: Review[] = generate()
export { seedPlaceById }
