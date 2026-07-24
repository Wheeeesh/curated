import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { CATEGORIES, type Category } from '../lib/api/types'
import { errorMessage, useAddPlaceMutation } from '../lib/hooks'
import { useUi } from '../lib/session'
import { getCurrentPosition, reverseGeocode, searchPlaces, type GeoResult } from '../lib/geo/geocode'
import { parseLocationInput } from '../lib/geo/parseLink'
import { CATEGORY_META } from '../lib/format'
import { useGoBack } from '../lib/useGoBack'

interface Picked {
  lat: number
  lng: number
  name: string
  locality: string
  address: string
}

/** Coordinates handed over by the map's drop-a-pin mode. */
interface DroppedPin {
  lat: number
  lng: number
}

export function AddPlaceScreen() {
  const navigate = useNavigate()
  const goBack = useGoBack()
  const { state: routerState } = useLocation()
  const view = useUi((s) => s.view)
  const showToast = useUi((s) => s.showToast)
  const requestFlyTo = useUi((s) => s.requestFlyTo)
  const mutation = useAddPlaceMutation()

  const [query, setQuery] = useState('')
  const [results, setResults] = useState<GeoResult[]>([])
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState(false)

  const [picked, setPicked] = useState<Picked | null>(null)
  const [name, setName] = useState('')
  const [categories, setCategories] = useState<Category[]>([])
  const [description, setDescription] = useState('')
  const [submitError, setSubmitError] = useState<string | null>(null)

  const linkResult = useMemo(() => parseLocationInput(query), [query])

  useEffect(() => {
    if (query.trim().length < 2 || linkResult.kind !== 'not-a-link') {
      setResults([])
      setSearching(false)
      return
    }
    setSearching(true)
    setSearchError(false)
    const t = setTimeout(() => {
      searchPlaces(query, { lat: view.lat, lng: view.lng })
        .then(setResults)
        .catch(() => setSearchError(true))
        .finally(() => setSearching(false))
    }, 350)
    return () => clearTimeout(t)
  }, [query, view.lat, view.lng, linkResult.kind])

  /** Fill in the locality for a point we only have coordinates for. */
  const pickCoords = async (lat: number, lng: number, pinName: string) => {
    setPicked({ lat, lng, name: pinName, locality: '', address: '' })
    setName(pinName)
    const { locality, address } = await reverseGeocode(lat, lng)
    setPicked((prev) => (prev && prev.lat === lat && prev.lng === lng ? { ...prev, locality, address } : prev))
  }

  const useMyLocation = async () => {
    try {
      const { lat, lng } = await getCurrentPosition()
      await pickCoords(lat, lng, '')
      showToast('Using your current location')
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Couldn’t get your location.')
    }
  }

  // Arriving from the map's drop-a-pin mode: the spot is already chosen, so
  // skip search entirely and go straight to naming it.
  const dropped = (routerState ?? null) as DroppedPin | null
  const droppedRef = useRef(false)
  useEffect(() => {
    if (droppedRef.current || !dropped) return
    droppedRef.current = true
    void pickCoords(dropped.lat, dropped.lng, '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dropped])

  const submit = async () => {
    if (!picked || categories.length === 0 || !name.trim()) return
    setSubmitError(null)
    try {
      const { place } = await mutation.mutateAsync({
        cityId: '',
        locality: picked.locality,
        name: name.trim(),
        categories,
        lat: picked.lat,
        lng: picked.lng,
        address: picked.address || picked.locality,
        description: description.trim(),
      })
      requestFlyTo({ lat: place.lat, lng: place.lng, zoom: 15 })
      // Straight into reviewing it — you have just been there, so this is the
      // moment you actually remember it. Cancel on that screen returns to the map.
      navigate(`/place/${place.id}/review`, { replace: true })
    } catch (e) {
      // The toast disappears; this stays on screen next to the button that
      // failed, with everything the member typed still filled in.
      setSubmitError(errorMessage(e))
    }
  }

  return (
    <div className="h-full overflow-y-auto bg-bg pb-16">
      <div className="glass sticky top-0 z-20 flex items-center justify-between border-b border-separator px-4 py-2.5">
        <button type="button" onClick={goBack} className="pressable min-h-[44px] pr-3 t-body">
          Cancel
        </button>
        <span className="t-headline">Add a place</span>
        <span className="w-[52px]" />
      </div>

      <div className="px-4 pt-4 land:mx-auto land:max-w-2xl">
        {!picked ? (
          <div>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Name or address, or paste a map link"
              className="field"
              aria-label="Search for a place, or paste a map link"
            />
            {query.trim() === '' && (
              <>
                <p className="ios-section-footer">
                  Search anywhere in the world, or paste a link from Google or Apple Maps.
                </p>
                <button type="button" onClick={useMyLocation} className="pressable btn-secondary mt-4">
                  Use my current location
                </button>
              </>
            )}
            {searching && <p className="ios-section-footer">Searching…</p>}
            {searchError && (
              <p className="ios-section-footer text-danger">
                Search is unavailable — go back and drop a pin on the map instead.
              </p>
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
                  onClick={() => pickCoords(linkResult.value.lat, linkResult.value.lng, linkResult.value.name)}
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
                      setPicked({ lat: r.lat, lng: r.lng, name: r.name, locality: r.locality, address: r.address })
                      setName(r.name)
                    }}
                    className="pressable ios-row"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate t-body">{r.name}</span>
                      <span className="block truncate t-footnote text-label-2">{r.address || r.locality}</span>
                    </span>
                    <span aria-hidden className="text-label-3">›</span>
                  </button>
                ))}
              </div>
            )}
          </div>
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
            <p className="ios-section-footer">
              {picked.address || picked.locality || `${picked.lat.toFixed(4)}, ${picked.lng.toFixed(4)}`}
            </p>

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
            <p className="ios-section-footer">
              Pick every category that fits — they decide what members are asked when they review it.
            </p>

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
            {submitError && (
              <p role="alert" className="ios-section-footer text-danger">
                {submitError}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
