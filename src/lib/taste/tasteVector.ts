import type { Category, Place, Profile, Review } from '../api/types'
import { CATEGORIES, overallScore } from '../api/types'

export type TasteVector = Record<Category, number>

const INTEREST_PRIOR = 0.7
const NON_INTEREST_PRIOR = 0.3
const PRIOR_WEIGHT = 2 // the prior counts as two pseudo-observations
const ADDED_PLACE_SIGNAL = 0.8 // adding a place is an implicit like

/**
 * 7-dim category affinity in [0,1]. Onboarding interests dominate at first;
 * real rating behaviour takes over smoothly as reviews accumulate.
 */
export function buildTasteVector(
  profile: Profile,
  ownReviews: Review[],
  ownPlaces: Place[],
  placeById: Map<string, Place>,
): TasteVector {
  const vec = {} as TasteVector
  for (const c of CATEGORIES) {
    const prior = profile.interests.includes(c) ? INTEREST_PRIOR : NON_INTEREST_PRIOR
    let sum = PRIOR_WEIGHT * prior
    let count = PRIOR_WEIGHT
    for (const r of ownReviews) {
      const place = placeById.get(r.placeId)
      if (place?.category === c) {
        sum += overallScore(r) / 10
        count += 1
      }
    }
    for (const p of ownPlaces) {
      if (p.category === c) {
        sum += ADDED_PLACE_SIGNAL
        count += 1
      }
    }
    vec[c] = sum / count
  }
  return vec
}

export function cosine(a: TasteVector, b: TasteVector): number {
  let dot = 0
  let na = 0
  let nb = 0
  for (const c of CATEGORIES) {
    dot += a[c] * b[c]
    na += a[c] * a[c]
    nb += b[c] * b[c]
  }
  if (na === 0 || nb === 0) return 0
  return dot / (Math.sqrt(na) * Math.sqrt(nb))
}
