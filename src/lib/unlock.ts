import type { CreditEntry, Place, Review } from './api/types'

/**
 * "Contribute to see." Members open the atlas by reviewing, and keep it open
 * by staying active — or pay credits instead if they would rather not write.
 *
 * Deliberately generous: unlocking is monotonic, so a place you can already
 * see never goes dark again. Falling behind only hides what has been added
 * since.
 */
export const REVIEWS_TO_OPEN = 5
export const REVIEWS_TO_KEEP_OPEN = 1
export const LAPSE_WEEKS = 5
export const PERMANENT_AT_REVIEWS = 100
export const UNLOCK_COST_CREDITS = 20

const WEEK_MS = 7 * 24 * 60 * 60 * 1000
const LAPSE_MS = LAPSE_WEEKS * WEEK_MS

export interface UnlockState {
  /** Places created at or before this moment are visible. null = none yet. */
  unlockedThrough: string | null
  /** Reviews written toward the next unlock. */
  progress: number
  /** Reviews needed for the next unlock. */
  needed: number
  /** Every place, forever — earned at 100 reviews. */
  permanent: boolean
  reviewCount: number
  /** True when the member has never opened the atlas. */
  neverOpened: boolean
  /** True when more than LAPSE_WEEKS have passed since the last review. */
  lapsed: boolean
}

/**
 * Derived from the member's own reviews and any credits they spent, so the
 * rule is verifiable from data rather than a stored flag that can drift.
 */
export function computeUnlockState(
  myReviews: Review[],
  myLedger: CreditEntry[],
  now: number = Date.now(),
): UnlockState {
  const sorted = [...myReviews].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  const reviewCount = sorted.length

  let unlockedThrough: string | null = null
  let streak = 0
  let prev: number | null = null

  for (const r of sorted) {
    const t = Date.parse(r.createdAt)
    if (prev !== null && t - prev > LAPSE_MS) streak = 0
    streak += 1
    const needed = unlockedThrough === null ? REVIEWS_TO_OPEN : REVIEWS_TO_KEEP_OPEN
    if (streak >= needed) {
      unlockedThrough = r.createdAt
      streak = 0
    }
    prev = t
  }

  // Credits spent on an unlock count exactly like a qualifying review.
  for (const e of myLedger) {
    if (e.reason === 'UNLOCK_SPEND' && (!unlockedThrough || e.createdAt > unlockedThrough)) {
      unlockedThrough = e.createdAt
      streak = 0
    }
  }

  const lastAt = prev
  const lapsed = unlockedThrough !== null && lastAt !== null && now - lastAt > LAPSE_MS
  const neverOpened = unlockedThrough === null
  const permanent = reviewCount >= PERMANENT_AT_REVIEWS

  return {
    unlockedThrough,
    progress: streak,
    needed: neverOpened || lapsed ? REVIEWS_TO_OPEN : REVIEWS_TO_KEEP_OPEN,
    permanent,
    reviewCount,
    neverOpened,
    lapsed,
  }
}

/**
 * Whether a member can see a place. Your own pins and anything you have
 * already reviewed are always visible — you cannot be locked out of your
 * own contributions.
 */
export function isPlaceUnlocked(
  place: Place,
  state: UnlockState,
  myUserId: string,
  reviewedPlaceIds: Set<string>,
): boolean {
  if (state.permanent) return true
  if (place.createdBy === myUserId) return true
  if (reviewedPlaceIds.has(place.id)) return true
  if (!state.unlockedThrough) return false
  return place.createdAt <= state.unlockedThrough
}

/** One line explaining what to do next, written to encourage rather than scold. */
export function unlockHeadline(state: UnlockState, lockedCount: number): { title: string; body: string } {
  if (state.permanent) {
    return {
      title: 'Everything is open to you',
      body: `${state.reviewCount} reviews. The whole atlas is yours for good, and every review from here earns credits.`,
    }
  }
  if (state.neverOpened) {
    const left = Math.max(0, REVIEWS_TO_OPEN - state.progress)
    return {
      title: `${left} more ${left === 1 ? 'review' : 'reviews'} opens the atlas`,
      body: 'Score any place you have actually been. Five reviews and every pin members have shared opens up to you.',
    }
  }
  if (state.lapsed) {
    return {
      title: `${Math.max(0, REVIEWS_TO_OPEN - state.progress)} reviews to catch up`,
      body: `It has been a while. ${lockedCount} new ${lockedCount === 1 ? 'place has' : 'places have'} been added since you last shared one — five reviews brings them all in.`,
    }
  }
  return {
    title: 'One review opens these',
    body: `${lockedCount} new ${lockedCount === 1 ? 'place' : 'places'} since your last review. Score somewhere you have been and they all appear.`,
  }
}
