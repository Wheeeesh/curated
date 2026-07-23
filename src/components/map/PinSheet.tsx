import { useNavigate } from 'react-router-dom'
import type { Place, Profile, Review } from '../../lib/api/types'
import { aggregateReviews } from '../../lib/aggregate'
import { ASPECT_META } from '../../lib/format'
import type { MatchResult } from '../../lib/taste/match'
import { Avatar } from '../ui/Avatar'
import { CategoryBadge } from '../ui/Chip'
import { Sheet } from '../ui/Sheet'
import { SaveButton } from '../place/SaveButton'
import { ScoreBar } from '../ui/ScoreBar'
import { MatchRing } from '../place/MatchBadge'

export function PinSheet({
  place,
  reviews,
  members,
  match,
  onClose,
}: {
  place: Place | null
  reviews: Review[]
  members: Profile[]
  match: MatchResult | null
  onClose: () => void
}) {
  const navigate = useNavigate()
  if (!place) return null
  const agg = aggregateReviews(reviews)
  const reviewers = reviews
    .map((r) => members.find((m) => m.id === r.userId))
    .filter((m): m is Profile => !!m)
  const warnings = reviews.filter((r) => r.isWarning)

  return (
    <Sheet open onClose={onClose}>
      <div className="px-5 pb-6 pt-1">
        <div className="flex items-start gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap gap-1.5">
              {place.categories.map((c) => (
                <CategoryBadge key={c} category={c} />
              ))}
            </div>
            <h2 className="mt-2 t-title">{place.name}</h2>
            <p className="mt-0.5 truncate t-subhead text-label-2">{place.address}</p>
          </div>
          <div className="flex flex-col items-center gap-1">
            <MatchRing pct={match?.pct ?? null} />
            {match?.pct != null && <span className="t-caption text-label-2">match</span>}
          </div>
        </div>

        {warnings.length > 0 && (
          <div className="mt-4 flex items-center gap-2.5 rounded-xl bg-[rgba(255,59,48,0.1)] px-3.5 py-3">
            <span aria-hidden className="text-[15px] text-danger">⚠</span>
            <span className="t-subhead font-semibold text-danger">
              {warnings.length === 1 ? 'A member flagged this place' : `${warnings.length} members flagged this place`}
            </span>
          </div>
        )}

        {agg ? (
          <div className="mt-4 space-y-2.5">
            {agg.byAspect.slice(0, 4).map(({ aspect, mean }) => (
              <ScoreBar key={aspect} label={ASPECT_META[aspect].label} score={mean} />
            ))}
          </div>
        ) : (
          <p className="mt-4 t-subhead text-label-2">No scores yet — be the first to rate it.</p>
        )}

        <div className="mt-4 flex items-center justify-between">
          <div className="flex -space-x-2">
            {reviewers.slice(0, 5).map((m) => (
              <div key={m.id} className="rounded-full ring-2 ring-white">
                <Avatar profile={m} size={28} />
              </div>
            ))}
          </div>
          {agg && (
            <span className="t-footnote text-label-2">
              {agg.count} {agg.count === 1 ? 'review' : 'reviews'}
            </span>
          )}
        </div>

        <div className="mt-5 flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => navigate(`/place/${place.id}`)}
            className="pressable btn-primary flex-1"
          >
            Open
          </button>
          <SaveButton placeId={place.id} variant="icon" />
        </div>
      </div>
    </Sheet>
  )
}
