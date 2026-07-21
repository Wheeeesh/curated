import type { CreditEntry } from '../lib/api/types'
import { creditsForPlaceAdd, creditsForReview, creditsForSignup } from '../lib/credits/rules'
import { creditId } from './ids'
import { SEED_MEMBERS } from './members'
import { SEED_PLACES } from './places'
import { SEED_REVIEWS } from './reviews'

/**
 * Replays the seed events through the real credit rules, in chronological
 * order, so the demo ledger is exactly what the Supabase triggers would have
 * produced. One code path, no drift.
 */
export function buildSeedLedger(): CreditEntry[] {
  const ledger: CreditEntry[] = []
  let n = 0
  const commit = (pending: { userId: string; amount: number; reason: CreditEntry['reason']; refId: string | null }[], at: string) => {
    for (const pc of pending) {
      n += 1
      ledger.push({ id: creditId(n), createdAt: at, ...pc })
    }
  }

  for (const m of SEED_MEMBERS) commit(creditsForSignup(m.id, null), m.createdAt)

  const events: { at: string; run: () => void }[] = []
  for (const place of SEED_PLACES) {
    events.push({
      at: place.createdAt,
      run: () => commit(creditsForPlaceAdd({ place, ledger, nowIso: place.createdAt }), place.createdAt),
    })
  }
  for (const review of SEED_REVIEWS) {
    events.push({
      at: review.createdAt,
      run: () => {
        const place = SEED_PLACES.find((p) => p.id === review.placeId)!
        const allPlaceReviews = SEED_REVIEWS.filter(
          (r) => r.placeId === review.placeId && r.createdAt <= review.createdAt,
        )
        commit(creditsForReview({ review, place, allPlaceReviews, ledger, nowIso: review.createdAt }), review.createdAt)
      },
    })
  }
  events.sort((a, b) => a.at.localeCompare(b.at))
  for (const e of events) e.run()
  return ledger
}
