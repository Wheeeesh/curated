import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CATEGORIES, overallScore } from '../lib/api/types'
import { useAllReviews, useCities, useFollows, useMembers, useMyProfile, usePlaces, useTasteEngine } from '../lib/hooks'
import { useUi } from '../lib/session'
import { CategoryChip } from '../components/ui/Chip'
import { Sheet } from '../components/ui/Sheet'
import { MapView, type MapPin } from '../components/map/MapView'
import { PinSheet } from '../components/map/PinSheet'

export function MapScreen() {
  const navigate = useNavigate()
  const { data: cities } = useCities()
  const { data: places } = usePlaces()
  const { data: reviews } = useAllReviews()
  const { data: members } = useMembers()
  const { data: follows } = useFollows()
  const { data: me } = useMyProfile()
  const engine = useTasteEngine()

  const activeCity = useUi((s) => s.activeCity)
  const setActiveCity = useUi((s) => s.setActiveCity)
  const mapMode = useUi((s) => s.mapMode)
  const setMapMode = useUi((s) => s.setMapMode)
  const filters = useUi((s) => s.categoryFilters)
  const toggleFilter = useUi((s) => s.toggleCategoryFilter)

  const [citySheetOpen, setCitySheetOpen] = useState(false)
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null)

  const city = cities?.find((c) => c.id === activeCity) ?? cities?.[0]

  const iFollow = useMemo(
    () => new Set((follows ?? []).filter((f) => f.followerId === me?.id).map((f) => f.followeeId)),
    [follows, me?.id],
  )

  const pins: MapPin[] = useMemo(() => {
    if (!places || !reviews || !city) return []
    const reviewsByPlace = new Map<string, typeof reviews>()
    for (const r of reviews) {
      const arr = reviewsByPlace.get(r.placeId) ?? []
      arr.push(r)
      reviewsByPlace.set(r.placeId, arr)
    }
    return places
      .filter((p) => p.cityId === city.id)
      .filter((p) => filters.length === 0 || filters.includes(p.category))
      .filter((p) => {
        if (mapMode === 'foryou') return true
        // Circle: pinned by you or someone you follow, or warmly reviewed
        // (overall ≥ 7) by someone you follow.
        if (p.createdBy === me?.id || iFollow.has(p.createdBy)) return true
        return (reviewsByPlace.get(p.id) ?? []).some((r) => iFollow.has(r.userId) && overallScore(r) >= 7)
      })
      .map((p) => {
        const m = engine?.matchFor(p)
        return {
          ...p,
          matchPct: m?.pct ?? null,
          hasWarning: (reviewsByPlace.get(p.id) ?? []).some((r) => r.isWarning),
        }
      })
  }, [places, reviews, city, filters, mapMode, iFollow, me?.id, engine])

  const selectedPlace = places?.find((p) => p.id === selectedPlaceId) ?? null
  const selectedReviews = useMemo(
    () => (reviews ?? []).filter((r) => r.placeId === selectedPlaceId),
    [reviews, selectedPlaceId],
  )

  if (!city) return null

  return (
    <div className="absolute inset-0">
      <MapView pins={pins} city={city} onPinTap={setSelectedPlaceId} />

      {/* ——— floating chrome ——— */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 space-y-2.5 px-4 pt-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setCitySheetOpen(true)}
            className="pressable glass pointer-events-auto flex min-h-[38px] items-center gap-1.5 rounded-full py-2 pl-4 pr-3 shadow-[0_2px_10px_rgba(0,0,0,0.1)]"
          >
            <span className="t-headline">{city.name}</span>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" className="text-label-3">
              <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          <div className="segmented glass pointer-events-auto ml-auto shadow-[0_2px_10px_rgba(0,0,0,0.1)]">
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

      {/* ——— add a place ——— */}
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

      {/* ——— sheets ——— */}
      <Sheet open={citySheetOpen} onClose={() => setCitySheetOpen(false)}>
        <div className="px-4 pb-6 pt-2">
          <p className="ios-section-header">Choose a city</p>
          <div className="ios-group">
            {(cities ?? []).map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  setActiveCity(c.id)
                  setCitySheetOpen(false)
                }}
                className="pressable ios-row"
              >
                <span className="flex-1">
                  <span className="block t-body">{c.name}</span>
                  <span className="block t-footnote text-label-2">{c.country}</span>
                </span>
                {c.id === city.id && (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                    <path d="m5 12.5 4.5 4.5L19 7" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        </div>
      </Sheet>

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
