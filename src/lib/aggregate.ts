import type { Review } from './api/types'
import { overallScore } from './api/types'

export interface Aggregates {
  count: number
  overall: number
  quality: number
  vibe: number
  service: number
  value: number
  warningCount: number
}

export function aggregateReviews(reviews: Review[]): Aggregates | null {
  if (reviews.length === 0) return null
  const mean = (f: (r: Review) => number) => reviews.reduce((s, r) => s + f(r), 0) / reviews.length
  return {
    count: reviews.length,
    overall: mean(overallScore),
    quality: mean((r) => r.quality),
    vibe: mean((r) => r.vibe),
    service: mean((r) => r.service),
    value: mean((r) => r.value),
    warningCount: reviews.filter((r) => r.isWarning).length,
  }
}
