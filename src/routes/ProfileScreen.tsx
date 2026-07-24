import { useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import {
  useAllReviews,
  useFollows,
  useLedger,
  useMyProfile,
  usePlaces,
  useTasteEngine,
} from '../lib/hooks'
import { creditBalance, pendingConsensusBonuses } from '../lib/credits/rules'
import { computeUnlockState, isPlaceUnlocked, PERMANENT_AT_REVIEWS, unlockHeadline } from '../lib/unlock'
import { formatDate } from '../lib/format'
import { Link } from 'react-router-dom'
import { CATEGORY_META } from '../lib/format'
import { primaryCategory } from '../lib/api/types'
import { useSavedPlaceIds } from '../lib/hooks'
import { Avatar } from '../components/ui/Avatar'
import { ScreenLoading } from '../components/ui/ScreenMessage'
import { Sheet } from '../components/ui/Sheet'
import { TasteBars } from '../components/profile/TasteBars'

const REASON_LABELS: Record<string, string> = {
  SIGNUP: 'Joined Curated',
  INVITE_JOINED: 'Your invitee joined',
  REVIEW_FULL: 'Full review',
  REVIEW_BASIC: 'Quick review',
  PLACE_ADDED: 'Pinned a place',
  PLACE_VALIDATED: 'Your pin was validated',
}

export function ProfileScreen() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { data: me } = useMyProfile()
  const { data: reviews } = useAllReviews()
  const { data: places } = usePlaces()
  const { data: follows } = useFollows()
  const { data: ledger } = useLedger(me?.id)
  const engine = useTasteEngine()
  const { data: savedIds } = useSavedPlaceIds()

  const [ledgerOpen, setLedgerOpen] = useState(false)

  const myReviews = useMemo(() => (reviews ?? []).filter((r) => r.userId === me?.id), [reviews, me?.id])
  const myPlaces = useMemo(() => (places ?? []).filter((p) => p.createdBy === me?.id), [places, me?.id])
  const followers = useMemo(() => (follows ?? []).filter((f) => f.followeeId === me?.id).length, [follows, me?.id])
  const balance = creditBalance(ledger ?? [], me?.id ?? '')
  const pending = useMemo(() => (me && reviews ? pendingConsensusBonuses(me.id, reviews) : []), [me, reviews])
  const pendingTotal = pending.reduce((s, p) => s + p.bonus, 0)
  const placeName = (id: string | null) => (places ?? []).find((p) => p.id === id)?.name
  const unlock = useMemo(() => computeUnlockState(myReviews, ledger ?? []), [myReviews, ledger])
  const savedPlaces = useMemo(
    () => (places ?? []).filter((p) => (savedIds ?? []).includes(p.id)),
    [places, savedIds],
  )
  const lockedCount = useMemo(() => {
    if (!places || !me) return 0
    const reviewed = new Set(myReviews.map((r) => r.placeId))
    if (unlock.permanent) return 0
    return places.filter(
      (p) => !isPlaceUnlocked(p, unlock, me.id, reviewed, { lat: me.homeLat, lng: me.homeLng }),
    ).length
  }, [places, me, myReviews, unlock])

  if (!me) return <ScreenLoading />

  return (
    <div className="h-full overflow-y-auto bg-bg pb-24 land:pb-8 land:pl-[72px]">
      <div className="px-4 pt-14 land:mx-auto land:max-w-2xl land:pt-6">
        {/* identity */}
        <div className="flex items-center gap-4 px-1">
          <Avatar profile={me} size={64} />
          <div className="min-w-0 flex-1">
            <h1 className="truncate t-title">{me.displayName}</h1>
            <p className="t-subhead text-label-2">
              @{me.username}
              {me.isAdmin ? ' · admin' : ''}
            </p>
          </div>
        </div>

        {/* credits */}
        <button type="button" onClick={() => setLedgerOpen(true)} className="pressable ios-group mt-6 w-full">
          <div className="ios-row">
            <span className="flex-1">
              <span className="block t-footnote text-label-2">Credits</span>
              <span className="block text-[34px] font-semibold leading-tight tracking-tight">{balance}</span>
              {pendingTotal > 0 && (
                <span className="block t-footnote text-label-2">+{pendingTotal} pending consensus bonus</span>
              )}
            </span>
            <span aria-hidden className="text-label-3">›</span>
          </div>
        </button>

        {/* stats */}
        <div className="ios-group mt-4 flex divide-x divide-separator">
          {(
            [
              [myPlaces.length, 'pinned'],
              [myReviews.length, 'reviews'],
              [followers, 'followers'],
            ] as const
          ).map(([num, label]) => (
            <div key={label} className="flex-1 py-3.5 text-center">
              <div className="text-[22px] font-semibold tabular-nums">{num}</div>
              <div className="t-footnote text-label-2">{label}</div>
            </div>
          ))}
        </div>

        {/* saved */}
        {savedPlaces.length > 0 && (
          <>
            <p className="ios-section-header mt-7">Want to go · {savedPlaces.length}</p>
            <div className="ios-group">
              {savedPlaces.map((p) => (
                <Link key={p.id} to={`/place/${p.id}`} className="pressable ios-row">
                  <span
                    aria-hidden
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: CATEGORY_META[primaryCategory(p)].color }}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate t-body">{p.name}</span>
                    <span className="block truncate t-footnote text-label-2">{p.locality || p.address}</span>
                  </span>
                  <span aria-hidden className="text-label-3">›</span>
                </Link>
              ))}
            </div>
          </>
        )}

        {/* atlas access */}
        <p className="ios-section-header mt-7">Atlas access</p>
        <div className="ios-group p-4">
          <p className="t-body font-medium">{unlockHeadline(unlock, lockedCount).title}</p>
          <div className="mt-3 flex items-center gap-2">
            {Array.from({ length: unlock.permanent ? 1 : unlock.needed }, (_, i) => (
              <span
                key={i}
                aria-hidden
                className={`h-2 flex-1 rounded-full ${unlock.permanent || i < unlock.progress ? 'bg-accent' : 'bg-fill'}`}
              />
            ))}
          </div>
          <p className="mt-2 t-footnote text-label-2">
            {unlock.permanent
              ? `${unlock.reviewCount} reviews — open for good`
              : `${unlock.reviewCount} of ${PERMANENT_AT_REVIEWS} reviews towards permanent access`}
          </p>
        </div>

        {/* taste */}
        <p className="ios-section-header mt-7">Your taste</p>
        <div className="ios-group p-4">
          {engine && <TasteBars vector={engine.myVector} />}
        </div>
        <p className="ios-section-footer">Sharpens with every review you post.</p>


        {/* account */}
        <div className="ios-group mt-7">
          {api.isDemo && (
            <button
              type="button"
              onClick={async () => {
                await api.resetDemo?.()
                await qc.invalidateQueries()
                navigate('/welcome', { replace: true })
              }}
              className="pressable ios-row t-body"
            >
              Reset demo data
            </button>
          )}
          <button
            type="button"
            onClick={async () => {
              await api.signOut()
              navigate('/welcome', { replace: true })
            }}
            className="pressable ios-row t-body text-danger"
          >
            Sign out
          </button>
        </div>
      </div>

      {/* ledger */}
      <Sheet open={ledgerOpen} onClose={() => setLedgerOpen(false)} tall>
        <div className="px-4 pb-8 pt-2">
          <p className="ios-section-header">Credits</p>
          <div className="ios-group px-4 py-3.5">
            <div className="text-[34px] font-semibold leading-tight tracking-tight">{balance}</div>
            {pendingTotal > 0 && (
              <p className="mt-1 t-footnote text-label-2">
                +{pendingTotal} pending — your scores agree with the club’s on {pending.length}{' '}
                {pending.length === 1 ? 'place' : 'places'}. Paid out in a future version.
              </p>
            )}
          </div>

          <p className="ios-section-header mt-6">History</p>
          <div className="ios-group">
            {(ledger ?? [])
              .slice()
              .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
              .map((e) => (
                <div key={e.id} className="ios-row">
                  <span className="min-w-0 flex-1">
                    <span className="block t-body">{REASON_LABELS[e.reason] ?? e.reason}</span>
                    <span className="block truncate t-footnote text-label-2">
                      {(e.reason === 'PLACE_ADDED' || e.reason === 'PLACE_VALIDATED') && placeName(e.refId)
                        ? placeName(e.refId)
                        : formatDate(e.createdAt)}
                    </span>
                  </span>
                  <span className="t-body font-semibold tabular-nums">+{e.amount}</span>
                </div>
              ))}
          </div>
        </div>
      </Sheet>
    </div>
  )
}
