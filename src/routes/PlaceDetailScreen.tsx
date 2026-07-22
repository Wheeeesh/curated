import { useMemo } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useGoBack } from '../lib/useGoBack'
import { ScreenLoading, ScreenMessage } from '../components/ui/ScreenMessage'
import { useAllReviews, useMembers, useMyProfile, usePlaces, useTasteEngine } from '../lib/hooks'
import { overallScore, type Profile, type Review } from '../lib/api/types'
import { aggregateReviews } from '../lib/aggregate'
import { ASPECT_META, formatDate, scoreColor } from '../lib/format'
import { Avatar } from '../components/ui/Avatar'
import { CategoryBadge } from '../components/ui/Chip'
import { ScoreBar } from '../components/ui/ScoreBar'
import { MatchRing } from '../components/place/MatchBadge'

function ReviewCard({ review, author }: { review: Review; author: Profile | undefined }) {
  const overall = overallScore(review)
  return (
    <div className={`p-4 ${review.isWarning ? 'bg-[rgba(255,59,48,0.07)]' : ''}`}>
      <div className="flex items-center gap-3">
        {author ? (
          <Link to={`/user/${author.id}`}>
            <Avatar profile={author} size={36} />
          </Link>
        ) : (
          <div className="h-9 w-9 rounded-full bg-fill" />
        )}
        <div className="min-w-0 flex-1">
          <div className="t-subhead font-semibold">{author?.displayName ?? 'Member'}</div>
          <div className="t-caption text-label-2">{formatDate(review.createdAt)}</div>
        </div>
        <span
          className="text-[19px] font-semibold tabular-nums"
          style={{ color: review.isWarning ? 'var(--color-danger)' : scoreColor(overall) }}
        >
          {overall.toFixed(1)}
        </span>
      </div>

      <div className="mt-2.5 flex flex-wrap gap-x-3 gap-y-1 t-caption text-label-2">
        {(['quality', 'vibe', 'service', 'value'] as const).map((a) => (
          <span key={a}>
            {ASPECT_META[a].label} <span className="font-semibold text-label">{review[a]}</span>
          </span>
        ))}
      </div>

      {review.isWarning ? (
        <p className="mt-2.5 t-subhead leading-relaxed">
          <span className="font-semibold text-danger">⚠ Warning · </span>
          {review.warningReason}
        </p>
      ) : (
        review.textReview && <p className="mt-2.5 t-subhead leading-relaxed">{review.textReview}</p>
      )}
    </div>
  )
}

export function PlaceDetailScreen() {
  const { id } = useParams()
  const navigate = useNavigate()
  const goBack = useGoBack()
  const { data: places, isLoading: placesLoading } = usePlaces()
  const { data: reviews } = useAllReviews()
  const { data: members } = useMembers()
  const { data: me } = useMyProfile()
  const engine = useTasteEngine()

  const place = places?.find((p) => p.id === id)
  const placeReviews = useMemo(
    () => (reviews ?? []).filter((r) => r.placeId === id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [reviews, id],
  )

  if (placesLoading) return <ScreenLoading />
  if (!place) {
    return <ScreenMessage title="Place not found" body="It may have been removed." actionLabel="Back to the atlas" />
  }
  const agg = aggregateReviews(placeReviews)
  const match = engine?.matchFor(place)
  const warnings = placeReviews.filter((r) => r.isWarning)
  const regular = placeReviews.filter((r) => !r.isWarning)
  const memberById = new Map((members ?? []).map((m) => [m.id, m]))
  const addedBy = memberById.get(place.createdBy)
  const myReview = placeReviews.find((r) => r.userId === me?.id)
  const influencer = match?.topInfluence ? memberById.get(match.topInfluence.userId) : undefined

  return (
    <div className="h-full overflow-y-auto bg-bg pb-32">
      {/* nav bar */}
      <div className="glass sticky top-0 z-20 flex items-center border-b border-separator px-2 py-2">
        <button type="button" onClick={goBack} className="pressable flex min-h-[44px] items-center gap-0.5 pl-1 pr-3 t-body">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
            <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Back
        </button>
      </div>

      <div className="px-4 pt-4">
        {/* title block */}
        <div className="flex items-start gap-4">
          <div className="min-w-0 flex-1">
            <CategoryBadge category={place.category} />
            <h1 className="mt-2.5 t-large-title">{place.name}</h1>
            <p className="mt-1 t-subhead text-label-2">{place.address}</p>
          </div>
          <div className="flex flex-col items-center gap-1 pt-1">
            <MatchRing pct={match?.pct ?? null} size={64} />
            {match?.pct != null && <span className="t-caption text-label-2">match</span>}
          </div>
        </div>

        {place.description && <p className="mt-3.5 text-[17px] leading-snug">{place.description}</p>}

        {match?.pct != null && influencer && (
          <p className="mt-2 t-footnote text-label-2">
            Loved by {influencer.displayName.split(' ')[0]}, {Math.round((match.topInfluence?.sim ?? 0) * 100)}% like you
          </p>
        )}

        {addedBy && (
          <Link to={`/user/${addedBy.id}`} className="pressable mt-3 flex items-center gap-2 t-footnote text-label-2">
            <Avatar profile={addedBy} size={20} />
            Pinned by {addedBy.displayName}
          </Link>
        )}

        {/* warnings — always first */}
        {warnings.length > 0 && (
          <div className="mt-6">
            <p className="ios-section-header font-semibold text-danger">
              {warnings.length === 1 ? 'Warning from a member' : `${warnings.length} warnings from members`}
            </p>
            <div className="ios-group divide-y divide-separator">
              {warnings.map((w) => (
                <ReviewCard key={w.id} review={w} author={memberById.get(w.userId)} />
              ))}
            </div>
          </div>
        )}

        {/* scores */}
        {agg ? (
          <div className="mt-6">
            <p className="ios-section-header">
              Member scores · {agg.count} {agg.count === 1 ? 'review' : 'reviews'}
            </p>
            <div className="ios-group space-y-3 p-4">
              {(['quality', 'vibe', 'service', 'value'] as const).map((a) => (
                <ScoreBar key={a} label={ASPECT_META[a].label} score={agg[a]} />
              ))}
            </div>
          </div>
        ) : (
          <p className="mt-6 t-subhead text-label-2">No reviews yet — you could be the first.</p>
        )}

        {/* reviews */}
        {regular.length > 0 && (
          <div className="mt-6">
            <p className="ios-section-header">Reviews</p>
            <div className="ios-group divide-y divide-separator">
              {regular.map((r) => (
                <ReviewCard key={r.id} review={r} author={memberById.get(r.userId)} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* sticky CTA */}
      <div className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-md">
        <div className="glass border-t border-separator p-4 pb-safe">
          <button type="button" onClick={() => navigate(`/place/${place.id}/review`)} className="pressable btn-primary">
            {myReview ? 'Update your score' : 'Been here? Score it'}
          </button>
        </div>
      </div>
    </div>
  )
}
