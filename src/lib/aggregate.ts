import type { Aspect, Review } from './api/types'
import { ASPECTS, overallScore } from './api/types'

export interface Aggregates {
  count: number
  overall: number
  /** Mean per criterion, only for criteria anyone actually rated. */
  byAspect: { aspect: Aspect; mean: number; count: number }[]
  warningCount: number
}

export function aggregateReviews(reviews: Review[]): Aggregates | null {
  if (reviews.length === 0) return null

  const byAspect: Aggregates['byAspect'] = []
  for (const aspect of ASPECTS) {
    const vals = reviews
      .map((r) => r.scores[aspect])
      .filter((v): v is number => typeof v === 'number')
    if (vals.length > 0) {
      byAspect.push({ aspect, mean: vals.reduce((s, v) => s + v, 0) / vals.length, count: vals.length })
    }
  }

  return {
    count: reviews.length,
    overall: reviews.reduce((s, r) => s + overallScore(r), 0) / reviews.length,
    byAspect,
    warningCount: reviews.filter((r) => r.isWarning).length,
  }
}
