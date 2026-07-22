import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGoBack } from '../lib/useGoBack'
import { ScreenLoading, ScreenMessage } from '../components/ui/ScreenMessage'
import maplibregl from 'maplibre-gl'
import { CATEGORIES, type Category, type City } from '../lib/api/types'
import { useAddPlaceMutation, useCities } from '../lib/hooks'
import { useUi } from '../lib/session'
import { searchPlaces, type GeoResult } from '../lib/geo/nominatim'
import { parseLocationInput } from '../lib/geo/parseLink'
import { CATEGORY_META } from '../lib/format'
import { MAP_STYLE_URL } from '../lib/mapStyle'

function PinDropMap({ city, onPick }: { city: City; onPick: (lat: number, lng: number) => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)

  useEffect(() => {
    if (!ref.current || mapRef.current) return
    const map = new maplibregl.Map({
      container: ref.current,
      style: MAP_STYLE_URL,
      center: [city.centerLng, city.centerLat],
      zoom: city.defaultZoom + 1,
      attributionControl: false,
    })
    mapRef.current = map
    const ro = new ResizeObserver(() => map.resize())
    ro.observe(ref.current)
    return () => {
      ro.disconnect()
      map.remove()
      mapRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="relative h-[46dvh] overflow-hidden rounded-xl">
      <div ref={ref} className="h-full w-full" />
      <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-full">
        <svg width="30" height="38" viewBox="0 0 30 38" fill="none">
          <path d="M15 37C15 37 28 22.5 28 13.5C28 6 22 1 15 1C8 1 2 6 2 13.5C2 22.5 15 37 15 37Z" fill="#1c1c1e" stroke="#fff" strokeWidth="2" />
          <circle cx="15" cy="13.5" r="4.5" fill="#fff" />
        </svg>
      </div>
      <button
        type="button"
        onClick={() => {
          const c = mapRef.current?.getCenter()
          if (c) onPick(c.lat, c.lng)
        }}
        className="pressable btn-primary absolute inset-x-4 bottom-4 !w-auto shadow-[0_4px_16px_rgba(0,0,0,0.2)]"
      >
        Pin this spot
      </button>
    </div>
  )
}

export function AddPlaceScreen() {
  const navigate = useNavigate()
  const goBack = useGoBack()
  const { data: cities, isLoading: citiesLoading } = useCities()
  const activeCity = useUi((s) => s.activeCity)
  const showToast = useUi((s) => s.showToast)
  const mutation = useAddPlaceMutation()

  const city = cities?.find((c) => c.id === activeCity) ?? cities?.[0]

  const [tab, setTab] = useState<'search' | 'pin'>('search')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<GeoResult[]>([])
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState(false)

  const [picked, setPicked] = useState<{ lat: number; lng: number; name: string; address: string } | null>(null)
  const [name, setName] = useState('')
  const [categories, setCategories] = useState<Category[]>([])
  const [description, setDescription] = useState('')

  // A pasted map link or coordinate pair short-circuits the search entirely.
  const linkResult = useMemo(() => parseLocationInput(query), [query])

  // Debounced Nominatim search (400 ms, min 3 chars, cached per query).
  useEffect(() => {
    if (!city || query.trim().length < 3 || linkResult.kind !== 'not-a-link') {
      setResults([])
      setSearching(false)
      return
    }
    setSearching(true)
    setSearchError(false)
    const t = setTimeout(() => {
      searchPlaces(query, city)
        .then(setResults)
        .catch(() => setSearchError(true))
        .finally(() => setSearching(false))
    }, 400)
    return () => clearTimeout(t)
  }, [query, city, linkResult.kind])

  if (citiesLoading) return <ScreenLoading />
  if (!city) {
    return (
      <ScreenMessage
        title="No cities yet"
        body="A place has to belong to a city, and none are set up yet."
        actionLabel="Back to the atlas"
      />
    )
  }

  const submit = async () => {
    if (!picked || categories.length === 0 || !name.trim()) return
    await mutation.mutateAsync({
      cityId: city.id,
      locality: `${city.name}, ${city.country}`,
      name: name.trim(),
      categories,
      lat: picked.lat,
      lng: picked.lng,
      address: picked.address,
      description: description.trim(),
    })
    navigate('/', { replace: true })
  }

  return (
    <div className="h-full overflow-y-auto bg-bg pb-16">
      <div className="glass sticky top-0 z-20 flex items-center justify-between border-b border-separator px-4 py-2.5">
        <button type="button" onClick={goBack} className="pressable min-h-[44px] pr-3 t-body">
          Cancel
        </button>
        <span className="t-headline">Add to {city.name}</span>
        <span className="w-[52px]" />
      </div>

      <div className="px-4 pt-4">
        {!picked ? (
          <>
            <div className="segmented mb-4">
              {(
                [
                  ['search', 'Search'],
                  ['pin', 'Drop a pin'],
                ] as const
              ).map(([t, label]) => (
                <button key={t} type="button" data-on={tab === t} onClick={() => setTab(t)}>
                  {label}
                </button>
              ))}
            </div>

            {tab === 'search' ? (
              <div>
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={`Search ${city.name}, or paste a map link`}
                  className="field"
                  aria-label="Search for a place, or paste a map link"
                />
                {query.trim() === '' && (
                  <p className="ios-section-footer">
                    Found it in Google or Apple Maps? Paste the link here and we’ll take the location from it.
                  </p>
                )}
                {searching && <p className="ios-section-footer">Searching…</p>}
                {searchError && (
                  <p className="ios-section-footer text-danger">Address search is unavailable — drop a pin instead.</p>
                )}

                {linkResult.kind === 'needs-expanding' && (
                  <p className="ios-section-footer text-danger">
                    That’s a shortened link, which we can’t open from here. Tap it once to let it open in Maps or your
                    browser, then copy the full link from the address bar and paste that.
                  </p>
                )}

                {linkResult.kind === 'location' && (
                  <div className="ios-group mt-4">
                    <button
                      type="button"
                      onClick={() => {
                        const { lat, lng, name: pinName } = linkResult.value
                        setPicked({ lat, lng, name: pinName, address: city.name })
                        setName(pinName)
                      }}
                      className="pressable ios-row"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate t-body">{linkResult.value.name || 'Location from link'}</span>
                        <span className="block truncate t-footnote text-label-2">
                          {linkResult.value.lat.toFixed(5)}, {linkResult.value.lng.toFixed(5)}
                        </span>
                      </span>
                      <span aria-hidden className="text-label-3">›</span>
                    </button>
                  </div>
                )}
                {results.length > 0 && (
                  <div className="ios-group mt-4">
                    {results.map((r, i) => (
                      <button
                        key={`${r.lat}-${r.lng}-${i}`}
                        type="button"
                        onClick={() => {
                          setPicked({ lat: r.lat, lng: r.lng, name: r.name, address: r.displayName.split(',').slice(0, 2).join(',') })
                          setName(r.name)
                        }}
                        className="pressable ios-row"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate t-body">{r.name}</span>
                          <span className="block truncate t-footnote text-label-2">{r.displayName}</span>
                        </span>
                        <span aria-hidden className="text-label-3">›</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <PinDropMap
                city={city}
                onPick={(lat, lng) => {
                  setPicked({ lat, lng, name: '', address: city.name })
                  showToast('Spot pinned — now the details')
                }}
              />
            )}
          </>
        ) : (
          <div className="anim-fade-up">
            <button type="button" onClick={() => setPicked(null)} className="pressable -ml-1 min-h-[44px] pr-3 t-body">
              ‹ Choose a different spot
            </button>

            <p className="ios-section-header mt-3">Name</p>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="What is this place called?"
              className="field"
              aria-label="Place name"
            />
            <p className="ios-section-footer">{picked.address}</p>

            <p className="ios-section-header mt-7">Categories</p>
            <div className="ios-group">
              {CATEGORIES.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() =>
                    setCategories((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]))
                  }
                  className="pressable ios-row"
                >
                  <span aria-hidden className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: CATEGORY_META[c].color }} />
                  <span className="flex-1 t-body">{CATEGORY_META[c].label}</span>
                  {categories.includes(c) && (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                      <path d="m5 12.5 4.5 4.5L19 7" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>
              ))}
            </div>

            <p className="ios-section-header mt-7">Why does it belong here?</p>
            <div className="ios-group">
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                placeholder="One line for the atlas"
                className="w-full resize-none bg-transparent px-4 py-3.5 text-[17px] leading-snug outline-none placeholder:text-label-3"
              />
            </div>

            <button
              type="button"
              disabled={!name.trim() || categories.length === 0 || mutation.isPending}
              onClick={submit}
              className="pressable btn-primary mt-7"
            >
              {mutation.isPending ? '…' : 'Add to the atlas'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
