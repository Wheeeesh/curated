import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { api } from '../../lib/api'
import { useUi } from '../../lib/session'
import { PERMANENT_AT_REVIEWS, UNLOCK_COST_CREDITS, unlockHeadline, type UnlockState } from '../../lib/unlock'
import { Sheet } from '../ui/Sheet'

/**
 * Shown when a member taps a place they have not opened yet. The tone is
 * deliberately encouraging: it says what one more review gets them, never
 * what they have failed to do.
 */
export function UnlockSheet({
  open,
  onClose,
  state,
  lockedCount,
  balance,
}: {
  open: boolean
  onClose: () => void
  state: UnlockState
  lockedCount: number
  balance: number
}) {
  const qc = useQueryClient()
  const showToast = useUi((s) => s.showToast)
  const [busy, setBusy] = useState(false)

  const { title, body } = unlockHeadline(state, lockedCount)
  const target = state.needed
  const done = Math.min(state.progress, target)
  const canAfford = balance >= UNLOCK_COST_CREDITS
  const toVeteran = PERMANENT_AT_REVIEWS - state.reviewCount

  const buy = async () => {
    setBusy(true)
    try {
      await api.spendCreditsToUnlock()
      await qc.invalidateQueries()
      showToast(`Unlocked — ${UNLOCK_COST_CREDITS} credits spent`, true)
      onClose()
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not unlock just now.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet open={open} onClose={onClose}>
      <div className="px-5 pb-7 pt-2">
        <h2 className="t-title">{title}</h2>
        <p className="mt-2 text-[15px] leading-snug text-label-2">{body}</p>

        {/* progress towards the next unlock */}
        <div className="mt-5 flex items-center gap-2">
          {Array.from({ length: target }, (_, i) => (
            <span
              key={i}
              className={`h-2 flex-1 rounded-full ${i < done ? 'bg-accent' : 'bg-fill'}`}
              aria-hidden
            />
          ))}
        </div>
        <p className="mt-2 t-footnote text-label-2">
          {done} of {target} {target === 1 ? 'review' : 'reviews'}
          {state.reviewCount > 0 && ` · ${state.reviewCount} in total`}
        </p>

        <button
          type="button"
          onClick={onClose}
          className="pressable btn-primary mt-6"
        >
          Find somewhere to review
        </button>

        <button
          type="button"
          disabled={!canAfford || busy}
          onClick={buy}
          className="pressable btn-secondary mt-2.5"
        >
          {busy
            ? '…'
            : canAfford
              ? `Unlock now for ${UNLOCK_COST_CREDITS} credits`
              : `${UNLOCK_COST_CREDITS} credits to unlock — you have ${balance}`}
        </button>

        {!state.permanent && toVeteran <= 25 && toVeteran > 0 && (
          <p className="ios-section-footer mt-3 text-center">
            {toVeteran} more {toVeteran === 1 ? 'review' : 'reviews'} and the atlas stays open permanently.
          </p>
        )}
        {!state.permanent && toVeteran > 25 && (
          <p className="ios-section-footer mt-3 text-center">
            At {PERMANENT_AT_REVIEWS} reviews the atlas stays open for good, and every review after that earns credits.
          </p>
        )}
      </div>
    </Sheet>
  )
}
