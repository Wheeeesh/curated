import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Map as MapLibreMap } from 'maplibre-gl'
import { CATEGORIES, overallScore, type Place } from '../lib/api/types'
import {
  useAllReviews,
  useFollows,
  useLedger,
  useMembers,
  useMyProfile,
  usePlaces,
  useSavedPlaceIds,
  useTasteEngine,
} from '../lib/hooks'
import { computeUnlockState, isPlaceUnlocked } from '../lib/unlock'
import { creditBalance } from '../lib/credits/rules'
import { UnlockSheet } from '../components/map/UnlockSheet'
import { useUi } from '../lib/session'
import { getCurrentPosition, searchPlaces, type GeoResult } from '../lib/geo/geocode'
import { findExistingPlace } from '../lib/geo/matchPlace'
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
  const { data: savedIds } = useSavedPlaceIds()

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
  const [myLocation, setMyLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [pinDropping, setPinDropping] = useState(false)
  // The initial view is read once; afterwards the map owns its own position.
  const [initialView] = useState(view)
  // Held so "Pin this spot" can read the exact centre the member settled on.
  const mapRef = useRef<MapLibreMap | null>(null)

  const myReviews = useMemo(() => (reviews ?? []).filter((r) => r.userId === me?.id), [reviews, me?.id])
  const reviewedIds = useMemo(() => new Set(myReviews.map((r) => r.placeId)), [myReviews])
  const unlock = useMemo(() => computeUnlockState(myReviews, ledger ?? []), [myReviews, ledger])
  const balance = useMemo(() => creditBalance(ledger ?? [], me?.id ?? ''), [ledger, me?.id])
  const savedSet = useMemo(() => new Set(savedIds ?? []), [savedIds])

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
        if (mapMode === 'saved') return savedSet.has(p.id)
        if (mapMode === 'foryou') return true
        if (p.createdBy === me?.id || iFollow.has(p.createdBy)) return true
        return (reviewsByPlace.get(p.id) ?? []).some((r) => iFollow.has(r.userId) && overallScore(r) >= 7)
      })
      .map((p) => {
        const locked = !isPlaceUnlocked(p, unlock, me?.id ?? '', reviewedIds, {
          lat: me?.homeLat ?? null,
          lng: me?.homeLng ?? null,
        })
        const m = locked ? undefined : engine?.matchFor(p)
        return {
          ...p,
          matchPct: m?.pct ?? null,
          hasWarning: (reviewsByPlace.get(p.id) ?? []).some((r) => r.isWarning),
          locked,
          saved: savedSet.has(p.id),
        }
      })
  }, [places, reviews, filters, mapMode, iFollow, me?.id, me?.homeLat, me?.homeLng, engine, unlock, reviewedIds, savedSet])

  const lockedCount = useMemo(() => pins.filter((p) => p.locked).length, [pins])

  /**
   * Whether each search result is somewhere the atlas already knows. Resolved
   * against every place, not just the pins currently drawn, so a result is not
   * offered as new merely because a category filter is hiding it.
   */
  const matchedResults = useMemo(
    () => results.map((result) => ({ result, existing: findExistingPlace(result, places ?? []) })),
    [results, places],
  )

  const selectedPlace = places?.find((p) => p.id === selectedPlaceId) ?? null
  const selectedReviews = useMemo(
    () => (reviews ?? []).filter((r) => r.placeId === selectedPlaceId),
    [reviews, selectedPlaceId],
  )

  const closeSearch = () => {
    setSearchOpen(false)
    setQuery('')
  }

  /**
   * A search result is either somewhere already pinned — in which case take
   * the member to it — or somewhere new, in which case start adding it with
   * everything the geocoder already told us filled in.
   */
  const openSearchResult = (result: GeoResult, existing: Place | null) => {
    closeSearch()
    if (!existing) {
      navigate('/add', {
        state: {
          lat: result.lat,
          lng: result.lng,
          name: result.name,
          locality: result.locality,
          address: result.address,
        },
      })
      return
    }
    requestFlyTo({ lat: existing.lat, lng: existing.lng, zoom: 16 })
    // Same rule as tapping the pin itself: locked places reveal nothing.
    const locked = !isPlaceUnlocked(existing, unlock, me?.id ?? '', reviewedIds, {
      lat: me?.homeLat ?? null,
      lng: me?.homeLng ?? null,
    })
    if (locked) setUnlockOpen(true)
    else setSelectedPlaceId(existing.id)
  }

  /** Hand the spot under the crosshair to the add screen, already located. */
  const confirmDroppedPin = () => {
    const c = mapRef.current?.getCenter()
    if (!c) return
    setPinDropping(false)
    navigate('/add', { state: { lat: c.lat, lng: c.lng } })
  }

  const goToMyLocation = async () => {
    setLocating(true)
    try {
      const { lat, lng } = await getCurrentPosition()
      setMyLocation({ lat, lng })
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
        myLocation={myLocation}
        onPinTap={(id) => {
          // While placing a pin the map is a positioning surface, not a list.
          if (pinDropping) return
          const pin = pins.find((p) => p.id === id)
          if (pin?.locked) setUnlockOpen(true)
          else setSelectedPlaceId(id)
        }}
        onMoveEnd={setView}
        onMapReady={(map) => {
          mapRef.current = map
        }}
      />

      {/* ——— floating chrome ——— */}
      {/* Unmounted rather than hidden while placing a pin: a `hidden` class
          loses to the landscape `display` utilities in the same rule set. */}
      {!pinDropping && (
        <div className="pointer-events-none absolute inset-x-0 top-0 z-20 space-y-2.5 px-4 pt-4 land:flex land:flex-wrap land:items-center land:gap-x-2 land:gap-y-1.5 land:space-y-0 land:pl-[84px] land:pt-2.5">
          {/* Sideways the search row and the segmented control share one line,
              so the map keeps the vertical space it no longer has to spare. */}
          <div className="flex items-center gap-2 land:min-w-[200px] land:flex-1">
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
                  ['saved', 'Saved'],
                ] as const
              ).map(([mode, label]) => (
                <button key={mode} type="button" data-on={mapMode === mode} onClick={() => setMapMode(mode)}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="pointer-events-auto -mx-4 flex gap-2 overflow-x-auto no-scrollbar px-4 pb-1 land:mx-0 land:w-full land:px-0">
            {CATEGORIES.map((c) => (
              <CategoryChip key={c} category={c} active={filters.includes(c)} onClick={() => toggleFilter(c)} />
            ))}
          </div>
        </div>
      )}

      {pins.length === 0 && (
        <div className="pointer-events-none absolute inset-x-0 top-1/2 z-10 -translate-y-1/2 px-8 land:pl-[88px]">
          <div className="glass mx-auto max-w-[300px] rounded-2xl p-4 text-center shadow-[0_2px_12px_rgba(0,0,0,0.1)]">
            <p className="t-subhead font-semibold">
              {mapMode === 'saved'
                ? 'Nothing saved yet'
                : mapMode === 'circle'
                  ? 'Nothing from your circle yet'
                  : 'No places yet'}
            </p>
            <p className="mt-1 t-footnote text-label-2">
              {mapMode === 'saved'
                ? 'Open a place and tap Save to keep it here.'
                : mapMode === 'circle'
                  ? 'Switch to “For you”, or follow members from the Members tab.'
                  : filters.length > 0
                    ? 'Try clearing the category filters.'
                    : 'Search at the top to add the first one.'}
            </p>
          </div>
        </div>
      )}

      {lockedCount > 0 && !pinDropping && (
        <button
          type="button"
          onClick={() => setUnlockOpen(true)}
          className="pressable glass absolute inset-x-4 bottom-[76px] z-20 flex items-center gap-2 rounded-2xl px-4 py-3 text-left shadow-[0_2px_12px_rgba(0,0,0,0.12)] land:bottom-4 land:left-[84px] land:max-w-sm"
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

      {/* ——— dropping a pin: the map itself is the picker ——— */}
      {pinDropping && (
        <>
          <div className="pointer-events-none absolute inset-x-0 top-0 z-20 px-4 pt-4 land:pl-[84px] land:pt-2.5">
            <div className="glass mx-auto w-fit rounded-full px-4 py-2 shadow-[0_2px_10px_rgba(0,0,0,0.1)]">
              <p className="t-subhead font-semibold">Move the map to place the pin</p>
            </div>
          </div>

          {/* The glyph's tip sits exactly on the map's centre point. */}
          <div className="pointer-events-none absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-full">
            <svg width="30" height="38" viewBox="0 0 30 38" fill="none">
              <path
                d="M15 37C15 37 28 22.5 28 13.5C28 6 22 1 15 1C8 1 2 6 2 13.5C2 22.5 15 37 15 37Z"
                fill="#1c1c1e"
                stroke="#fff"
                strokeWidth="2"
              />
              <circle cx="15" cy="13.5" r="4.5" fill="#fff" />
            </svg>
          </div>

          <div className="absolute inset-x-4 bottom-[76px] z-20 flex gap-2 land:bottom-4 land:left-[84px] land:max-w-md">
            <button
              type="button"
              onClick={() => setPinDropping(false)}
              className="pressable btn-secondary glass !w-auto flex-1 shadow-[0_2px_12px_rgba(0,0,0,0.12)]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirmDroppedPin}
              className="pressable btn-primary !w-auto flex-[2] shadow-[0_4px_16px_rgba(0,0,0,0.2)]"
            >
              Pin this spot
            </button>
          </div>
        </>
      )}

      {/* ——— search anywhere ——— */}
      <Sheet open={searchOpen} onClose={closeSearch} tall>
        <div className="px-4 pb-8 pt-2">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="City, neighbourhood or venue"
            className="field bg-bg"
            aria-label="Search anywhere"
          />

          {/* Searching is also how you add: a result already in the atlas
              takes you to it, one we do not have starts adding it. */}
          {query.trim() === '' && (
            <div className="ios-group mt-4">
              <button
                type="button"
                onClick={() => {
                  closeSearch()
                  navigate('/add')
                }}
                className="pressable ios-row"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0">
                  <path d="M12 5v14M5 12h14" strokeLinecap="round" />
                </svg>
                <span className="flex-1 t-body">Add a place</span>
                <span aria-hidden className="text-label-3">›</span>
              </button>
            </div>
          )}

          {searching && <p className="ios-section-footer">Searching…</p>}

          {/* Dropping a pin is the fallback for somewhere no geocoder knows,
              so it is offered exactly when the search comes back empty. */}
          {!searching && query.trim().length >= 2 && results.length === 0 && (
            <>
              <p className="ios-section-footer">
                Nothing found. Check the spelling, or place it on the map yourself.
              </p>
              <div className="ios-group mt-4">
                <button
                  type="button"
                  onClick={() => {
                    closeSearch()
                    setPinDropping(true)
                  }}
                  className="pressable ios-row"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className="shrink-0">
                    <path d="M12 21s7-7.2 7-12a7 7 0 1 0-14 0c0 4.8 7 12 7 12Z" strokeLinejoin="round" />
                    <circle cx="12" cy="9" r="2.4" />
                  </svg>
                  <span className="flex-1 t-body">Drop a pin</span>
                  <span aria-hidden className="text-label-3">›</span>
                </button>
              </div>
            </>
          )}

          {matchedResults.length > 0 && (
            <div className="ios-group mt-4">
              {matchedResults.map(({ result: r, existing }, i) => (
                <button
                  key={`${r.lat}-${r.lng}-${i}`}
                  type="button"
                  onClick={() => openSearchResult(r, existing)}
                  className="pressable ios-row"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate t-body">{r.name}</span>
                    <span className="block truncate t-footnote text-label-2">{r.locality || r.address}</span>
                  </span>
                  <span className={`shrink-0 t-footnote font-semibold ${existing ? 'text-label-2' : 'text-accent'}`}>
                    {existing ? 'In the atlas' : 'Add'}
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
