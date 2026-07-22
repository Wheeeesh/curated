import type { Follow, Place, Profile, Review } from '../api/types'
import { overallScore } from '../api/types'
import { buildTasteVector, type TasteVector } from './tasteVector'
import { userSimilarity } from './similarity'

export interface MatchResult {
  /** null → no reviews yet ("New" badge, ranked by affinity) */
  pct: number | null
  affinity: number
  warningCount: number
  /** the single most influential positive reviewer, for the "why" line */
  topInfluence: { userId: string; sim: number } | null
}

export interface TasteEngine {
  myVector: TasteVector
  vectorFor(userId: string): TasteVector | null
  similarityTo(userId: string): number
  matchFor(place: Place): MatchResult
}

const BASE_WEIGHT = 0.15
const FOLLOW_BOOST = 1.25
const SCORE_MIX = 0.75 // predicted-score weight vs category affinity
const WARNING_PENALTY = 0.35
const CONFIDENCE_HALFLIFE = 2 // conf = n / (n + 2)

/**
 * Builds the whole taste computation once per data change; every accessor is
 * O(small) after that. Invite-scale data (≤ tens of thousands of reviews)
 * makes this comfortably a client-side job.
 */
export function buildTasteEngine(opts: {
  me: Profile
  members: Profile[]
  follows: Follow[]
  places: Place[]
  reviews: Review[]
}): TasteEngine {
  const { me, members, follows, places, reviews } = opts

  const placeById = new Map(places.map((p) => [p.id, p]))
  const reviewsByUser = new Map<string, Map<string, Review>>() // userId → placeId → review
  const reviewsByPlace = new Map<string, Review[]>()
  for (const r of reviews) {
    if (!reviewsByUser.has(r.userId)) reviewsByUser.set(r.userId, new Map())
    reviewsByUser.get(r.userId)!.set(r.placeId, r)
    if (!reviewsByPlace.has(r.placeId)) reviewsByPlace.set(r.placeId, [])
    reviewsByPlace.get(r.placeId)!.push(r)
  }
  const placesByUser = new Map<string, Place[]>()
  for (const p of places) {
    if (!placesByUser.has(p.createdBy)) placesByUser.set(p.createdBy, [])
    placesByUser.get(p.createdBy)!.push(p)
  }

  const vectors = new Map<string, TasteVector>()
  for (const m of members) {
    vectors.set(
      m.id,
      buildTasteVector(m, [...(reviewsByUser.get(m.id)?.values() ?? [])], placesByUser.get(m.id) ?? [], placeById),
    )
  }
  const myVector = vectors.get(me.id) ?? buildTasteVector(me, [], [], placeById)
  const myReviews = reviewsByUser.get(me.id) ?? new Map<string, Review>()
  const iFollow = new Set(follows.filter((f) => f.followerId === me.id).map((f) => f.followeeId))

  const simCache = new Map<string, number>()
  const similarityTo = (userId: string): number => {
    if (userId === me.id) return 1
    const cached = simCache.get(userId)
    if (cached !== undefined) return cached
    const theirVector = vectors.get(userId)
    if (!theirVector) return 0
    const sim = userSimilarity(myReviews, reviewsByUser.get(userId) ?? new Map(), myVector, theirVector)
    simCache.set(userId, sim)
    return sim
  }

  const matchFor = (place: Place): MatchResult => {
    // A place with several categories is judged by the one you care most
    // about — a restaurant that also has a dancefloor still appeals to a
    // food lover.
    const affinity = Math.max(...place.categories.map((c) => myVector[c]), 0)
    const raters = (reviewsByPlace.get(place.id) ?? []).filter((r) => r.userId !== me.id)
    const warnings = raters.filter((r) => r.isWarning)

    if (raters.length === 0) {
      return { pct: null, affinity, warningCount: 0, topInfluence: null }
    }

    let weightSum = 0
    let scoreSum = 0
    let topInfluence: { userId: string; sim: number } | null = null
    for (const r of raters) {
      const sim = similarityTo(r.userId)
      const w = (BASE_WEIGHT + (1 - BASE_WEIGHT) * sim) * (iFollow.has(r.userId) ? FOLLOW_BOOST : 1)
      weightSum += w
      scoreSum += w * overallScore(r)
      if (!r.isWarning && overallScore(r) >= 7 && (!topInfluence || sim > topInfluence.sim)) {
        topInfluence = { userId: r.userId, sim }
      }
    }
    const predicted = scoreSum / weightSum // 1–10
    const raw = SCORE_MIX * ((predicted - 1) / 9) + (1 - SCORE_MIX) * affinity

    let penalty = 1
    for (const w of warnings) {
      const sim = similarityTo(w.userId)
      penalty *= 1 - WARNING_PENALTY * (BASE_WEIGHT + (1 - BASE_WEIGHT) * sim)
    }

    const n = raters.length
    const conf = n / (n + CONFIDENCE_HALFLIFE)
    const neutral = 0.5 + 0.2 * (affinity - 0.5)
    const pct = Math.round(100 * Math.min(1, Math.max(0, penalty * (conf * raw + (1 - conf) * neutral))))
    return { pct, affinity, warningCount: warnings.length, topInfluence }
  }

  return { myVector, vectorFor: (id) => vectors.get(id) ?? null, similarityTo, matchFor }
}
