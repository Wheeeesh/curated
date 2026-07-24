import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useGoBack } from '../lib/useGoBack'
import { ScreenLoading, ScreenMessage } from '../components/ui/ScreenMessage'
import {
  useAllReviews,
  useFollowMutation,
  useFollows,
  useMembers,
  useMyProfile,
  usePlaces,
  useTasteEngine,
} from '../lib/hooks'
import { overallScore, primaryCategory } from '../lib/api/types'
import { CATEGORY_META, scoreColor } from '../lib/format'
import { Avatar } from '../components/ui/Avatar'
import { TasteBars } from '../components/profile/TasteBars'

export function UserScreen() {
  const { id } = useParams()
  const goBack = useGoBack()
  const { data: members, isLoading: membersLoading } = useMembers()
  const { data: me } = useMyProfile()
  const { data: follows } = useFollows()
  const { data: places } = usePlaces()
  const { data: reviews } = useAllReviews()
  const engine = useTasteEngine()
  const followMutation = useFollowMutation()

  const member = members?.find((m) => m.id === id)
  const theirVector = id && engine ? engine.vectorFor(id) : null
  const sim = id && engine ? engine.similarityTo(id) : 0
  const following = useMemo(
    () => !!(follows ?? []).find((f) => f.followerId === me?.id && f.followeeId === id),
    [follows, me?.id, id],
  )
  const theirPlaces = useMemo(() => (places ?? []).filter((p) => p.createdBy === id), [places, id])
  const theirReviews = useMemo(
    () => (reviews ?? []).filter((r) => r.userId === id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [reviews, id],
  )
  const placeById = useMemo(() => new Map((places ?? []).map((p) => [p.id, p])), [places])

  if (membersLoading || !me) return <ScreenLoading />
  if (!member) {
    return <ScreenMessage title="Member not found" actionLabel="Back to the atlas" />
  }
  const isSelf = member.id === me.id

  return (
    <div className="h-full overflow-y-auto bg-bg pb-16">
      <div className="glass sticky top-0 z-20 flex items-center border-b border-separator px-2 py-2">
        <button type="button" onClick={goBack} className="pressable flex min-h-[44px] items-center gap-0.5 pl-1 pr-3 t-body">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
            <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Back
        </button>
      </div>

      <div className="px-4 pt-5 land:mx-auto land:max-w-2xl">
        <div className="flex items-center gap-4 px-1">
          <Avatar profile={member} size={64} />
          <div className="min-w-0 flex-1">
            <h1 className="truncate t-title">{member.displayName}</h1>
            <p className="t-subhead text-label-2">
              <span className="font-semibold text-label">{Math.round(sim * 100)}%</span> taste match with you
            </p>
          </div>
          {!isSelf && (
            <button
              type="button"
              disabled={followMutation.isPending}
              onClick={() => followMutation.mutate({ userId: member.id, on: !following })}
              className={`pressable min-h-[34px] shrink-0 rounded-full px-4 text-[14px] font-semibold ${
                following ? 'bg-fill text-label' : 'bg-accent text-white'
              }`}
            >
              {following ? 'Following' : 'Follow'}
            </button>
          )}
        </div>

        {member.bio && <p className="mt-3.5 px-1 text-[17px] leading-snug">{member.bio}</p>}

        {/* taste, with your own level marked on each bar */}
        {theirVector && engine && (
          <>
            <p className="ios-section-header mt-7">{member.displayName.split(' ')[0]}’s taste</p>
            <div className="ios-group p-4">
              <TasteBars vector={theirVector} compareTo={engine.myVector} />
            </div>
          </>
        )}

        {/* their pins */}
        {theirPlaces.length > 0 && (
          <>
            <p className="ios-section-header mt-7">Pinned · {theirPlaces.length}</p>
            <div className="ios-group">
              {theirPlaces.map((p) => (
                <Link key={p.id} to={`/place/${p.id}`} className="pressable ios-row">
                  <span aria-hidden className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: CATEGORY_META[primaryCategory(p)].color }} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate t-body">{p.name}</span>
                    <span className="block t-footnote capitalize text-label-2">{p.cityId}</span>
                  </span>
                  <span aria-hidden className="text-label-3">›</span>
                </Link>
              ))}
            </div>
          </>
        )}

        {/* their reviews */}
        {theirReviews.length > 0 && (
          <>
            <p className="ios-section-header mt-7">Recent scores</p>
            <div className="ios-group">
              {theirReviews.slice(0, 12).map((r) => {
                const p = placeById.get(r.placeId)
                if (!p) return null
                const overall = overallScore(r)
                return (
                  <Link key={r.id} to={`/place/${p.id}`} className="pressable ios-row">
                    <span
                      className="w-8 shrink-0 text-[17px] font-semibold tabular-nums"
                      style={{ color: r.isWarning ? 'var(--color-danger)' : scoreColor(overall) }}
                    >
                      {r.isWarning ? '⚠' : overall.toFixed(1)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate t-body">{p.name}</span>
                      {r.textReview && <span className="block truncate t-footnote text-label-2">{r.textReview}</span>}
                    </span>
                    <span aria-hidden className="text-label-3">›</span>
                  </Link>
                )
              })}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
