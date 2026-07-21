import type { Review } from '../api/types'
import { overallScore } from '../api/types'
import type { TasteVector } from './tasteVector'
import { cosine } from './tasteVector'

const MIN_CO_RATED = 3
const FULL_CONFIDENCE_AT = 10

/**
 * sim(u,v) ∈ [0,1]. Pearson over co-rated places once ≥3 overlap, blended by
 * confidence with taste-vector cosine. Negative correlation clamps to 0 —
 * dissimilar people simply don't influence you in v1.
 */
export function userSimilarity(
  reviewsByUserU: Map<string, Review>, // placeId → review
  reviewsByUserV: Map<string, Review>,
  tasteU: TasteVector,
  tasteV: TasteVector,
): number {
  const simTaste = cosine(tasteU, tasteV)

  const co: [number, number][] = []
  for (const [placeId, ru] of reviewsByUserU) {
    const rv = reviewsByUserV.get(placeId)
    if (rv) co.push([overallScore(ru), overallScore(rv)])
  }
  if (co.length < MIN_CO_RATED) return simTaste

  const meanU = co.reduce((s, [u]) => s + u, 0) / co.length
  const meanV = co.reduce((s, [, v]) => s + v, 0) / co.length
  let num = 0
  let du = 0
  let dv = 0
  for (const [u, v] of co) {
    num += (u - meanU) * (v - meanV)
    du += (u - meanU) ** 2
    dv += (v - meanV) ** 2
  }
  // Zero variance (someone scores everything identically) → fall back to taste.
  const simCo = du === 0 || dv === 0 ? simTaste : Math.max(0, num / Math.sqrt(du * dv))

  const conf = Math.min(co.length, FULL_CONFIDENCE_AT) / FULL_CONFIDENCE_AT
  return conf * simCo + (1 - conf) * simTaste
}
