import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ASPECTS, type Aspect, type Place, type Review } from '../lib/api/types'
import { useAllReviews, useMyProfile, usePlaces, useReviewMutation } from '../lib/hooks'
import { ASPECT_META } from '../lib/format'
import { FULL_REVIEW_MIN_CHARS, WARNING_MIN_CHARS } from '../lib/credits/rules'
import { useGoBack } from '../lib/useGoBack'
import { ScreenLoading, ScreenMessage } from '../components/ui/ScreenMessage'

function AspectSlider({ aspect, value, onChange }: { aspect: Aspect; value: number; onChange: (v: number) => void }) {
  const meta = ASPECT_META[aspect]
  return (
    <div className="px-4 py-3.5">
      <div className="flex items-baseline justify-between">
        <span className="t-body font-medium">{meta.label}</span>
        <span className="text-[22px] font-semibold tabular-nums">{value}</span>
      </div>
      <p className="t-footnote text-label-2">{meta.hint}</p>
      <input
        type="range"
        min={1}
        max={10}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={meta.label}
        className="aspect mt-1"
        style={{ '--pct': `${((value - 1) / 9) * 100}%` } as React.CSSProperties}
      />
    </div>
  )
}

/**
 * Mounted only once reviews have loaded, so the initial slider and text
 * values are the member's actual saved review. Initialising this state
 * while the query was still in flight silently reset an existing review to
 * 7/7/7/7 with empty text on a hard refresh.
 */
function ReviewForm({ place, existing, isOwnPlace }: { place: Place; existing: Review | undefined; isOwnPlace: boolean }) {
  const navigate = useNavigate()
  const goBack = useGoBack()
  const mutation = useReviewMutation()

  const [scores, setScores] = useState<Record<Aspect, number>>({
    quality: existing?.quality ?? 7,
    vibe: existing?.vibe ?? 7,
    service: existing?.service ?? 7,
    value: existing?.value ?? 7,
  })
  const [text, setText] = useState(existing?.textReview ?? '')
  const [isWarning, setIsWarning] = useState(existing?.isWarning ?? false)
  const [warningReason, setWarningReason] = useState(existing?.warningReason ?? '')

  const chars = text.trim().length
  const warningOk = !isWarning || warningReason.trim().length >= WARNING_MIN_CHARS

  const submit = async () => {
    await mutation.mutateAsync({
      placeId: place.id,
      ...scores,
      textReview: text.trim(),
      isWarning,
      warningReason: isWarning ? warningReason.trim() : null,
    })
    navigate(`/place/${place.id}`, { replace: true })
  }

  return (
    <div className="h-full overflow-y-auto bg-bg pb-16">
      <div className="glass sticky top-0 z-20 flex items-center justify-between border-b border-separator px-4 py-2.5">
        <button type="button" onClick={goBack} className="pressable min-h-[44px] pr-3 t-body">
          Cancel
        </button>
        <span className="max-w-[190px] truncate t-headline">{place.name}</span>
        <span className="w-[52px]" />
      </div>

      <div className="px-4 pt-5">
        <p className="ios-section-header">Your scores</p>
        <div className="ios-group divide-y divide-separator">
          {ASPECTS.map((a) => (
            <AspectSlider key={a} aspect={a} value={scores[a]} onChange={(v) => setScores((s) => ({ ...s, [a]: v }))} />
          ))}
        </div>

        <p className="ios-section-header mt-7">In your words</p>
        <div className="ios-group">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={4}
            placeholder="What should a member with your taste know before going?"
            className="w-full resize-none bg-transparent px-4 py-3.5 text-[17px] leading-snug outline-none placeholder:text-label-3"
          />
        </div>
        <p className={`ios-section-footer ${chars >= FULL_REVIEW_MIN_CHARS ? 'font-medium text-label' : ''}`}>
          {chars >= FULL_REVIEW_MIN_CHARS
            ? '✓ Long enough for full credits'
            : `${chars} of ${FULL_REVIEW_MIN_CHARS} characters for full credits`}
          {isOwnPlace && ' · You pinned this place, so it earns no credits.'}
        </p>

        <div className="mt-7">
          <div className="ios-group">
            <div className="ios-row">
              <span className="flex-1">
                <span className="block t-body">Flag as a warning</span>
                <span className="block t-footnote text-label-2">For genuinely bad experiences</span>
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={isWarning}
                aria-label="Flag as a warning"
                onClick={() => setIsWarning(!isWarning)}
                className={`relative inline-flex h-[31px] w-[51px] shrink-0 items-center rounded-full transition-colors ${
                  isWarning ? 'bg-danger' : 'bg-[rgba(120,120,128,0.16)]'
                }`}
              >
                <span
                  className={`absolute h-[27px] w-[27px] rounded-full bg-white shadow-[0_3px_8px_rgba(0,0,0,0.15)] transition-transform ${
                    isWarning ? 'translate-x-[22px]' : 'translate-x-[2px]'
                  }`}
                />
              </button>
            </div>
            {isWarning && (
              <div className="anim-fade-up border-t border-separator">
                <textarea
                  value={warningReason}
                  onChange={(e) => setWarningReason(e.target.value)}
                  rows={3}
                  placeholder="Tell members what went wrong"
                  className="w-full resize-none bg-transparent px-4 py-3.5 text-[17px] leading-snug outline-none placeholder:text-label-3"
                />
              </div>
            )}
          </div>
          <p className="ios-section-footer">
            {isWarning
              ? `${warningReason.trim().length} of ${WARNING_MIN_CHARS} characters minimum. Honest warnings earn full credits.`
              : 'Warnings show in red at the top of the place, for every member.'}
          </p>
        </div>

        <button
          type="button"
          disabled={!warningOk || mutation.isPending}
          onClick={submit}
          className={`pressable btn-primary mt-7 ${isWarning && warningOk ? '!bg-danger' : ''}`}
        >
          {mutation.isPending ? '…' : isWarning ? 'Post warning' : existing ? 'Update score' : 'Post score'}
        </button>
      </div>
    </div>
  )
}

export function ReviewScreen() {
  const { id } = useParams()
  const { data: places, isLoading: placesLoading } = usePlaces()
  const { data: reviews, isLoading: reviewsLoading } = useAllReviews()
  const { data: me, isLoading: meLoading } = useMyProfile()

  if (placesLoading || reviewsLoading || meLoading) return <ScreenLoading />

  const place = places?.find((p) => p.id === id)
  if (!place) {
    return <ScreenMessage title="Place not found" body="It may have been removed." actionLabel="Back to the atlas" />
  }

  const existing = (reviews ?? []).find((r) => r.placeId === id && r.userId === me?.id)
  // Remount when the saved review arrives so the form initialises from it.
  return <ReviewForm key={existing?.id ?? 'new'} place={place} existing={existing} isOwnPlace={place.createdBy === me?.id} />
}
