import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CATEGORIES, overallScore } from '../lib/api/types'
import { useAllReviews, useFollows, useLedger, useMembers, useMyProfile, usePlaces, useTasteEngine } from '../lib/hooks'
import { computeUnlockState, isPlaceUnlocked } from '../lib/unlock'
import { creditBalance } from '../lib/credits/rules'
import { UnlockSheet } from '../components/map/UnlockSheet'
import { useUi } from '../lib/session'
import { getCurrentPosition, searchPlaces, type GeoResult } from '../lib/geo/geocode'
import { CategoryChip } from '../components/ui/Chip'
import { Sheet } from '../components/ui/Sheet'
import { MapView, type MapPin } from '../components/map/MapView'
import { PinSheet } from '../components/map/PinSheet'

export function MapScreen() {
  const navigate = useNavigate()
  const { data: places } = usePlaces()
  const { data: reviews } = useAllReviews()
  const { data: members } = useMembers()
  const { data: follows } = useFollows()
  const { data: me } = useMyProfile()
  const engine = useTasteEngine()
  const { data: ledger } = useLedger(me?.id)

  const view = useUi((s) => s.view)
  const setView = useUi((s) => s.setView)
  const flyTo = useUi((s) => s.flyTo)
  const requestFlyTo = useUi((s) => s.requestFlyTo)
  const mapMode = useUi((s) => s.mapMode)
  const setMapMode = useUi((s) => s.setMapMode)
  const filters = useUi((s) => s.categoryFilters)
  const toggleFilter = useUi((s) => s.toggleCategoryFilter)
  const showToast = useUi((s) => s.showToast)

  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<GeoResult[]>([])
  const [searching, setSearching] = useState(false)
  const [locating, setLocating] = useState(false)
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null)
  const [unlockOpen, setUnlockOpen] = useState(false)
  // The initial view is read once; afterwards the map owns its own position.
  const [initialView] = useState(view)

  const myReviews = useMemo(() => (reviews ?? []).filter((r) => r.userId === me?.id), [reviews, me?.id])
  const reviewedIds = useMemo(() => new Set(myReviews.map((r) => r.placeId)), [myReviews])
  const unlock = useMemo(() => computeUnlockState(myReviews, ledger ?? []), [myReviews, ledger])
  const balance = useMemo(() => creditBalance(ledger ?? [], me?.id ?? ''), [ledger, me?.id])

  const iFollow = useMemo(
    () => new Set((follows ?? []).filter((f) => f.followerId === me?.id).map((f) => f.followeeId)),
    [follows, me?.id],
  )

  // Debounced place search, biased towards wherever the map is looking.
  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([])
      return
    }
    setSearching(true)
    const t = setTimeout(() => {
      searchPlaces(query, { lat: view.lat, lng: view.lng })
        .then(setResults)
        .catch(() => setResults([]))
        .finally(() => setSearching(false))
    }, 350)
    return () => clearTimeout(t)
  }, [query, view.lat, view.lng])

  const pins: MapPin[] = useMemo(() => {
    if (!places || !reviews) return []
    const reviewsByPlace = new Map<string, typeof reviews>()
    for (const r of reviews) {
      const arr = reviewsByPlace.get(r.placeId) ?? []
      arr.push(r)
      reviewsByPlace.set(r.placeId, arr)
    }
    return places
      .filter((p) => filters.length === 0 || p.categories.some((c) => filters.includes(c)))
      .filter((p) => {
        if (mapMode === 'foryou') return true
        if (p.createdBy === me?.id || iFollow.has(p.createdBy)) return true
        return (reviewsByPlace.get(p.id) ?? []).some((r) => iFollow.has(r.userId) && overallScore(r) >= 7)
      })
      .map((p) => {
        const locked = !isPlaceUnlocked(p, unlock, me?.id ?? '', reviewedIds)
        const m = locked ? undefined : engine?.matchFor(p)
        return {
          ...p,
          matchPct: m?.pct ?? null,
          hasWarning: (reviewsByPlace.get(p.id) ?? []).some((r) => r.isWarning),
          locked,
        }
      })
  }, [places, reviews, filters, mapMode, iFollow, me?.id, engine, unlock, reviewedIds])

  const lockedCount = useMemo(() => pins.filter((p) => p.locked).length, [pins])

  const selectedPlace = places?.find((p) => p.id === selectedPlaceId) ?? null
  const selectedReviews = useMemo(
    () => (reviews ?? []).filter((r) => r.placeId === selectedPlaceId),
    [reviews, selectedPlaceId],
  )

  const goToMyLocation = async () => {
    setLocating(true)
    try {
      const { lat, lng } = await getCurrentPosition()
      requestFlyTo({ lat, lng, zoom: 14 })
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Couldn’t get your location.')
    } finally {
      setLocating(false)
    }
  }

  return (
    <div className="absolute inset-0">
      <MapView
        pins={pins}
        initialView={initialView}
        flyTo={flyTo}
        onPinTap={(id) => {
          const pin = pins.find((p) => p.id === id)
          if (pin?.locked) setUnlockOpen(true)
          else setSelectedPlaceId(id)
        }}
        onMoveEnd={setView}
      />

      {/* ——— floating chrome ——— */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 space-y-2.5 px-4 pt-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="pressable glass pointer-events-auto flex min-h-[38px] flex-1 items-center gap-2 rounded-full py-2 pl-4 pr-4 text-left shadow-[0_2px_10px_rgba(0,0,0,0.1)]"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="text-label-2">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" strokeLinecap="round" />
            </svg>
            <span className="t-subhead text-label-2">Search anywhere</span>
          </button>

          <button
            type="button"
            onClick={goToMyLocation}
            aria-label="Go to my location"
            className="pressable glass pointer-events-auto flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full shadow-[0_2px_10px_rgba(0,0,0,0.1)]"
          >
            {locating ? (
              <span className="t-caption">…</span>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
                <path d="M12 2v3M12 19v3M2 12h3M19 12h3" strokeLinecap="round" />
                <circle cx="12" cy="12" r="6" />
                <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" />
              </svg>
            )}
          </button>
        </div>

        <div className="flex items-center gap-2">
          <div className="segmented glass pointer-events-auto shadow-[0_2px_10px_rgba(0,0,0,0.1)]">
            {(
              [
                ['foryou', 'For you'],
                ['circle', 'Circle'],
              ] as const
            ).map(([mode, label]) => (
              <button key={mode} type="button" data-on={mapMode === mode} onClick={() => setMapMode(mode)}>
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="pointer-events-auto -mx-4 flex gap-2 overflow-x-auto no-scrollbar px-4 pb-1">
          {CATEGORIES.map((c) => (
            <CategoryChip key={c} category={c} active={filters.includes(c)} onClick={() => toggleFilter(c)} />
          ))}
        </div>
      </div>

      {pins.length === 0 && (
        <div className="pointer-events-none absolute inset-x-0 top-1/2 z-10 -translate-y-1/2 px-8">
          <div className="glass mx-auto max-w-[300px] rounded-2xl p-4 text-center shadow-[0_2px_12px_rgba(0,0,0,0.1)]">
            <p className="t-subhead font-semibold">
              {mapMode === 'circle' ? 'Nothing from your circle yet' : 'No places yet'}
            </p>
            <p className="mt-1 t-footnote text-label-2">
              {mapMode === 'circle'
                ? 'Switch to “For you”, or follow members from the Members tab.'
                : filters.length > 0
                  ? 'Try clearing the category filters.'
                  : 'Tap + to pin the first one.'}
            </p>
          </div>
        </div>
      )}

      {lockedCount > 0 && (
        <button
          type="button"
          onClick={() => setUnlockOpen(true)}
          className="pressable glass absolute inset-x-4 bottom-[76px] z-20 mr-20 flex items-center gap-2 rounded-2xl px-4 py-3 text-left shadow-[0_2px_12px_rgba(0,0,0,0.12)]"
        >
          <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-full bg-[#8e8e93] opacity-40 ring-4 ring-[rgba(142,142,147,0.22)]" />
          <span className="min-w-0 flex-1">
            <span className="block t-subhead font-semibold">
              {lockedCount} {lockedCount === 1 ? 'place' : 'places'} to unlock
            </span>
            <span className="block t-footnote text-label-2">
              {unlock.needed === 1 ? 'One review opens them' : `${Math.max(0, unlock.needed - unlock.progress)} reviews to open them`}
            </span>
          </span>
        </button>
      )}

      <button
        type="button"
        aria-label="Add a place"
        onClick={() => navigate('/add')}
        className="pressable absolute bottom-[76px] right-4 z-20 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-white shadow-[0_4px_16px_rgba(0,0,0,0.24)]"
      >
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 5v14M5 12h14" strokeLinecap="round" />
        </svg>
      </button>

      {/* ——— search anywhere ——— */}
      <Sheet
        open={searchOpen}
        onClose={() => {
          setSearchOpen(false)
          setQuery('')
        }}
        tall
      >
        <div className="px-4 pb-8 pt-2">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="City, neighbourhood or venue"
            className="field bg-bg"
            aria-label="Search anywhere"
          />
          {searching && <p className="ios-section-footer">Searching…</p>}
          {!searching && query.trim().length >= 2 && results.length === 0 && (
            <p className="ios-section-footer">Nothing found. Try a different spelling.</p>
          )}
          {results.length > 0 && (
            <div className="ios-group mt-4">
              {results.map((r, i) => (
                <button
                  key={`${r.lat}-${r.lng}-${i}`}
                  type="button"
                  onClick={() => {
                    requestFlyTo({ lat: r.lat, lng: r.lng, zoom: 14 })
                    setSearchOpen(false)
                    setQuery('')
                  }}
                  className="pressable ios-row"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate t-body">{r.name}</span>
                    <span className="block truncate t-footnote text-label-2">{r.locality || r.address}</span>
                  </span>
                  <span aria-hidden className="text-label-3">›</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </Sheet>

      <UnlockSheet
        open={unlockOpen}
        onClose={() => setUnlockOpen(false)}
        state={unlock}
        lockedCount={lockedCount}
        balance={balance}
      />

      <PinSheet
        place={selectedPlace}
        reviews={selectedReviews}
        members={members ?? []}
        match={selectedPlace && engine ? engine.matchFor(selectedPlace) : null}
        onClose={() => setSelectedPlaceId(null)}
      />
    </div>
  )
}
