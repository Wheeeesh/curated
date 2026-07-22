import type { CreditEntry, CreditReason, Place, Review } from '../api/types'
import { overallScore } from '../api/types'

/**
 * SINGLE SOURCE OF TRUTH for the credit economy.
 * The SQL triggers in supabase/migrations/0001_init.sql mirror these
 * constants — every value there carries a comment pointing back here.
 * Change them together or the demo and the real backend drift apart.
 */
export const CREDITS: Record<CreditReason, number> = {
  SIGNUP: 10,
  INVITE_JOINED: 5,
  REVIEW_FULL: 5,
  REVIEW_BASIC: 2,
  PLACE_ADDED: 3,
  PLACE_VALIDATED: 10,
  /** Spending, not earning — always recorded as a negative amount. */
  UNLOCK_SPEND: -20,
  CREDITS_PURCHASED: 0,
  /** Every review past the veteran threshold keeps earning. */
  VETERAN_BONUS: 2,
}

export const FULL_REVIEW_MIN_CHARS = 80
export const WARNING_MIN_CHARS = 30
export const MAX_CREDITED_REVIEWS_PER_DAY = 3
export const MAX_CREDITED_PLACES_PER_DAY = 5
export const VALIDATION_MIN_REVIEWS = 3
export const VALIDATION_MIN_OVERALL = 7
export const CONSENSUS_TOLERANCE = 1.5
export const CONSENSUS_BONUS = 2

export interface PendingCredit {
  userId: string
  amount: number
  reason: CreditReason
  refId: string | null
}

const sameUtcDay = (a: string, b: string) => a.slice(0, 10) === b.slice(0, 10)

const countToday = (ledger: CreditEntry[], userId: string, reasons: CreditReason[], nowIso: string) =>
  ledger.filter((e) => e.userId === userId && reasons.includes(e.reason) && sameUtcDay(e.createdAt, nowIso)).length

/**
 * Credits triggered by a review write. `allPlaceReviews` must include the new
 * review; `ledger` is the ledger state before this write.
 */
export function creditsForReview(opts: {
  review: Review
  place: Place
  allPlaceReviews: Review[]
  ledger: CreditEntry[]
  nowIso: string
}): PendingCredit[] {
  const { review, place, allPlaceReviews, ledger, nowIso } = opts
  const out: PendingCredit[] = []

  const alreadyCredited = ledger.some(
    (e) => e.refId === review.id && (e.reason === 'REVIEW_FULL' || e.reason === 'REVIEW_BASIC'),
  )
  const isOwnPlace = place.createdBy === review.userId
  const overCap =
    countToday(ledger, review.userId, ['REVIEW_FULL', 'REVIEW_BASIC'], nowIso) >= MAX_CREDITED_REVIEWS_PER_DAY

  if (!alreadyCredited && !isOwnPlace && !overCap) {
    const reason: CreditReason =
      review.textReview.trim().length >= FULL_REVIEW_MIN_CHARS ? 'REVIEW_FULL' : 'REVIEW_BASIC'
    out.push({ userId: review.userId, amount: CREDITS[reason], reason, refId: review.id })
  }

  // Place validation: 3 distinct non-creator reviewers scoring overall ≥ 7.
  const alreadyValidated = ledger.some((e) => e.reason === 'PLACE_VALIDATED' && e.refId === place.id)
  if (!alreadyValidated) {
    const validators = new Set(
      allPlaceReviews
        .filter((r) => r.userId !== place.createdBy && overallScore(r) >= VALIDATION_MIN_OVERALL)
        .map((r) => r.userId),
    )
    if (validators.size >= VALIDATION_MIN_REVIEWS) {
      out.push({ userId: place.createdBy, amount: CREDITS.PLACE_VALIDATED, reason: 'PLACE_VALIDATED', refId: place.id })
    }
  }
  return out
}

export function creditsForPlaceAdd(opts: {
  place: Place
  ledger: CreditEntry[]
  nowIso: string
}): PendingCredit[] {
  const { place, ledger, nowIso } = opts
  if (countToday(ledger, place.createdBy, ['PLACE_ADDED'], nowIso) >= MAX_CREDITED_PLACES_PER_DAY) return []
  return [{ userId: place.createdBy, amount: CREDITS.PLACE_ADDED, reason: 'PLACE_ADDED', refId: place.id }]
}

export function creditsForSignup(userId: string, inviterId: string | null): PendingCredit[] {
  const out: PendingCredit[] = [{ userId, amount: CREDITS.SIGNUP, reason: 'SIGNUP', refId: userId }]
  if (inviterId) out.push({ userId: inviterId, amount: CREDITS.INVITE_JOINED, reason: 'INVITE_JOINED', refId: userId })
  return out
}

export function creditBalance(ledger: CreditEntry[], userId: string): number {
  return ledger.filter((e) => e.userId === userId).reduce((s, e) => s + e.amount, 0)
}

/**
 * Display-only in v1: "+2 pending" consensus bonuses. Your score counts as
 * consensus-aligned when the place has ≥3 reviews and your overall sits
 * within CONSENSUS_TOLERANCE of everyone else's mean. Making these durable
 * needs a scheduled server job — post-v1.
 */
export function pendingConsensusBonuses(userId: string, allReviews: Review[]): { placeId: string; bonus: number }[] {
  const byPlace = new Map<string, Review[]>()
  for (const r of allReviews) {
    const arr = byPlace.get(r.placeId) ?? []
    arr.push(r)
    byPlace.set(r.placeId, arr)
  }
  const out: { placeId: string; bonus: number }[] = []
  for (const [pid, reviews] of byPlace) {
    if (reviews.length < VALIDATION_MIN_REVIEWS) continue
    const mine = reviews.find((r) => r.userId === userId)
    if (!mine) continue
    const others = reviews.filter((r) => r.userId !== userId)
    const mean = others.reduce((s, r) => s + overallScore(r), 0) / others.length
    if (Math.abs(overallScore(mine) - mean) <= CONSENSUS_TOLERANCE) out.push({ placeId: pid, bonus: CONSENSUS_BONUS })
  }
  return out
}
