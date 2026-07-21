import type { Review } from '../lib/api/types'
import { ASPECTS, overallScore } from '../lib/api/types'
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

function generate(): Review[] {
  const rng = mulberry32(20260601)
  const reviews: Review[] = []
  const taken = new Set<string>() // `${userId}:${placeId}`
  let n = 0

  const push = (r: Omit<Review, 'id'>) => {
    n += 1
    reviews.push({ id: reviewId(n), ...r })
  }

  for (const member of SEED_MEMBERS) {
    const cities = [member.homeCity, ...member.bias.travelsTo]
    const candidates = SEED_PLACES.filter(
      (p) => cities.includes(p.cityId) && p.baseQuality >= 6,
    )
    // Interest-matching places first, then a few outside their lane so
    // co-rating overlap (and therefore similarity) has structure.
    const inLane = candidates.filter((p) => member.interests.includes(p.category))
    const offLane = candidates.filter((p) => !member.interests.includes(p.category))
    const shuffled = [...inLane, ...offLane]
      .map((p) => ({ p, sort: rng() * (member.interests.includes(p.category) ? 0.6 : 1) }))
      .sort((a, b) => a.sort - b.sort)
      .map((x) => x.p)

    let written = 0
    for (const place of shuffled) {
      if (written >= member.bias.reviewCount) break
      const key = `${member.id}:${place.id}`
      if (taken.has(key)) continue
      taken.add(key)
      written += 1

      const noise = () => (rng() - 0.5) * 2 // ±1
      const score = (aspect: (typeof ASPECTS)[number]) =>
        clamp10(place.baseQuality + member.bias.meanOffset + (member.bias.aspectBias[aspect] ?? 0) + noise())

      const quality = score('quality')
      const vibe = score('vibe')
      const service = score('service')
      const value = score('value')
      const overall = overallScore({ quality, vibe, service, value })

      const v = member.voice
      let text: string
      if (rng() < 0.42) {
        text = v.short[Math.floor(rng() * v.short.length)]
      } else if (overall >= 7.3) {
        const a = v.praise[Math.floor(rng() * v.praise.length)]
        const b = v.short[Math.floor(rng() * v.short.length)]
        text = `${a} ${b}`
      } else {
        const a = v.mixed[Math.floor(rng() * v.mixed.length)]
        const b = v.short[Math.floor(rng() * v.short.length)]
        text = `${a} ${b}`
      }

      const when = seedDate(2 + Math.floor(rng() * 150))
      push({
        placeId: place.id,
        userId: member.id,
        quality,
        vibe,
        service,
        value,
        textReview: text,
        isWarning: false,
        warningReason: null,
        createdAt: when,
        updatedAt: when,
      })
    }
  }

  // ——— Hand-written warnings on the three fictional tourist traps ———
  const trap = (name: string) => SEED_PLACES.find((p) => p.name === name)!
  const warn = (
    username: string,
    placeName: string,
    scores: [number, number, number, number],
    reason: string,
    daysAgo: number,
  ) => {
    const [quality, vibe, service, value] = scores
    const when = seedDate(daysAgo)
    push({
      placeId: trap(placeName).id,
      userId: memberByUsername[username].id,
      quality,
      vibe,
      service,
      value,
      textReview: reason,
      isWarning: true,
      warningReason: reason,
      createdAt: when,
      updatedAt: when,
    })
  }

  warn('nora', 'Chez Papillon Doré', [2, 3, 2, 1],
    'Defrosted duck confit at €38, a mystery “service” line on the bill, and waiters who switch to bored the second you order. Built entirely for people who will never come back.', 12)
  warn('vera', 'Sultan’s Terrace 360', [3, 6, 3, 1],
    'Nineteen-euro cocktails made with the cheapest pour on the shelf. You pay for the view twice — once at the door and once in the glass. Skip it; the çay house next door has the same view.', 25)
  warn('mika', 'Neo Samurai Nights', [2, 3, 2, 1],
    'A cover charge, then a surprise “table charge”, then drinks watered past the point of argument. The show is twenty minutes of people filming other people filming.', 8)

  // Mild corroborating reviews so the traps show consensus, not one angry voice.
  const mild = (username: string, placeName: string, scores: [number, number, number, number], text: string, daysAgo: number) => {
    const [quality, vibe, service, value] = scores
    const when = seedDate(daysAgo)
    push({
      placeId: trap(placeName).id,
      userId: memberByUsername[username].id,
      quality, vibe, service, value,
      textReview: text,
      isWarning: false,
      warningReason: null,
      createdAt: when,
      updatedAt: when,
    })
  }
  mild('ken', 'Chez Papillon Doré', [4, 5, 4, 2], 'The riverside table is the whole product. Eat elsewhere first, then have one coffee here for the view.', 40)
  mild('elif', 'Sultan’s Terrace 360', [4, 7, 4, 2], 'The view genuinely is spectacular at sunset. Everything else about the place knows it, and charges accordingly.', 33)
  mild('dae', 'Neo Samurai Nights', [3, 4, 3, 2], 'Came for the spectacle, left after one drink. The sound system deserves a better venue.', 15)

  return reviews
}

export const SEED_REVIEWS: Review[] = generate()
export { seedPlaceById }
