import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { CATEGORIES, type Category, type Place } from '../lib/api/types'
import { useMembers, useMyProfile } from '../lib/hooks'
import { getCurrentPosition, reverseGeocode, searchPlaces, type GeoResult } from '../lib/geo/geocode'
import { useUi } from '../lib/session'
import { CATEGORY_META } from '../lib/format'
import { buildTasteVector, cosine } from '../lib/taste/tasteVector'
import { Avatar } from '../components/ui/Avatar'

const Check = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" className="shrink-0">
    <path d="m5 12.5 4.5 4.5L19 7" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

export function OnboardingScreen() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { data: me } = useMyProfile()
  const requestFlyTo = useUi((s) => s.requestFlyTo)
  const { data: members } = useMembers()

  const [step, setStep] = useState(0)
  const [interests, setInterests] = useState<Category[]>([])
  const [homeCity, setHomeCity] = useState<string | null>(null)
  const [homeCoords, setHomeCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [cityQuery, setCityQuery] = useState('')
  const [cityResults, setCityResults] = useState<GeoResult[]>([])
  const [locating, setLocating] = useState(false)
  const [followIds, setFollowIds] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)

  const toggleInterest = (c: Category) =>
    setInterests((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]))

  // Follow suggestions ranked by taste-prior similarity to the picked interests.
  const suggestions = useMemo(() => {
    if (!members || !me) return []
    const placeById = new Map<string, Place>()
    const myPrior = buildTasteVector({ ...me, interests }, [], [], placeById)
    return members
      .filter((m) => m.id !== me.id && m.onboarded)
      .map((m) => ({ member: m, sim: cosine(myPrior, buildTasteVector(m, [], [], placeById)) }))
      .sort((a, b) => b.sim - a.sim)
      .slice(0, 6)
  }, [members, me, interests])

  useEffect(() => {
    if (cityQuery.trim().length < 2) {
      setCityResults([])
      return
    }
    const t = setTimeout(() => {
      searchPlaces(cityQuery).then(setCityResults).catch(() => setCityResults([]))
    }, 350)
    return () => clearTimeout(t)
  }, [cityQuery])

  const useMyLocation = async () => {
    setLocating(true)
    try {
      const { lat, lng } = await getCurrentPosition()
      const { locality } = await reverseGeocode(lat, lng)
      setHomeCity(locality || `${lat.toFixed(3)}, ${lng.toFixed(3)}`)
      setHomeCoords({ lat, lng })
      requestFlyTo({ lat, lng, zoom: 13 })
    } catch {
      // leave it to the member to type somewhere instead
    } finally {
      setLocating(false)
    }
  }

  const finish = async () => {
    setBusy(true)
    try {
      await api.completeOnboarding(interests, homeCity, homeCoords?.lat ?? null, homeCoords?.lng ?? null, [...followIds])
      await qc.invalidateQueries()
      navigate('/', { replace: true })
    } finally {
      setBusy(false)
    }
  }

  const steps = [
    // ——— 1 · interests ———
    <div key="interests">
      <h2 className="t-large-title">What do you go out for?</h2>
      <p className="mt-2.5 text-[17px] leading-snug text-label-2">
        Pick at least three. Your reviews refine this over time.
      </p>
      <div className="ios-group mt-7">
        {CATEGORIES.map((c) => {
          const on = interests.includes(c)
          return (
            <button key={c} type="button" onClick={() => toggleInterest(c)} className="pressable ios-row">
              <span aria-hidden className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: CATEGORY_META[c].color }} />
              <span className="flex-1 t-body">{CATEGORY_META[c].label}</span>
              {on && <Check />}
            </button>
          )
        })}
      </div>
      <button
        type="button"
        disabled={interests.length < 3}
        onClick={() => setStep(1)}
        className="pressable btn-primary mt-7"
      >
        {interests.length < 3 ? `Pick ${3 - interests.length} more` : 'Continue'}
      </button>
    </div>,

    // ——— 2 · home base, anywhere in the world ———
    <div key="city">
      <h2 className="t-large-title">Where are you based?</h2>
      <p className="mt-2.5 text-[17px] leading-snug text-label-2">
        Just so the map opens somewhere useful. You can roam anywhere.
      </p>

      {homeCity ? (
        <div className="ios-group mt-7">
          <div className="ios-row">
            <span className="flex-1 t-body">{homeCity}</span>
            <button type="button" onClick={() => setHomeCity(null)} className="pressable t-subhead font-semibold text-label-2">
              Change
            </button>
          </div>
        </div>
      ) : (
        <>
          <input
            value={cityQuery}
            onChange={(e) => setCityQuery(e.target.value)}
            placeholder="Search any city"
            className="field mt-7 bg-surface"
            aria-label="Search any city"
          />
          <button type="button" onClick={useMyLocation} className="pressable btn-secondary mt-3">
            {locating ? '…' : 'Use my current location'}
          </button>
          {cityResults.length > 0 && (
            <div className="ios-group mt-4">
              {cityResults.slice(0, 6).map((r, i) => (
                <button
                  key={`${r.lat}-${r.lng}-${i}`}
                  type="button"
                  onClick={() => {
                    setHomeCity(r.locality || r.name)
                    setHomeCoords({ lat: r.lat, lng: r.lng })
                    requestFlyTo({ lat: r.lat, lng: r.lng, zoom: 13 })
                  }}
                  className="pressable ios-row"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate t-body">{r.name}</span>
                    <span className="block truncate t-footnote text-label-2">{r.locality}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </>
      )}

      <button type="button" onClick={() => setStep(2)} className="pressable btn-primary mt-7">
        {homeCity ? 'Continue' : 'Skip'}
      </button>
    </div>,

    // ——— 3 · follow suggestions ———
    <div key="follow">
      <h2 className="t-large-title">Members who match your taste</h2>
      <p className="mt-2.5 text-[17px] leading-snug text-label-2">
        Their pins appear on your map. Change this any time.
      </p>
      <div className="ios-group mt-7">
        {suggestions.map(({ member, sim }) => {
          const on = followIds.has(member.id)
          return (
            <button
              key={member.id}
              type="button"
              onClick={() =>
                setFollowIds((prev) => {
                  const next = new Set(prev)
                  if (next.has(member.id)) next.delete(member.id)
                  else next.add(member.id)
                  return next
                })
              }
              className="pressable ios-row ios-row-inset-avatar"
            >
              <Avatar profile={member} size={40} />
              <span className="min-w-0 flex-1">
                <span className="block truncate t-body font-medium">{member.displayName}</span>
                <span className="block truncate t-footnote text-label-2">{Math.round(sim * 100)}% taste match</span>
              </span>
              {on ? <Check /> : <span className="t-subhead font-semibold text-label-2">Follow</span>}
            </button>
          )
        })}
      </div>
      <button type="button" disabled={busy} onClick={finish} className="pressable btn-primary mt-7">
        {busy ? '…' : 'Enter the atlas'}
      </button>
    </div>,
  ]

  return (
    <div className="h-full overflow-y-auto bg-bg px-4 pb-12 pt-14">
      <div className="flex items-center justify-between px-1">
        {step > 0 ? (
          <button type="button" onClick={() => setStep(step - 1)} className="pressable -ml-1 min-h-[44px] pr-3 t-body">
            ‹ Back
          </button>
        ) : (
          <span />
        )}
        <span className="t-footnote text-label-2">Step {step + 1} of 3</span>
      </div>
      <div className="anim-fade-up mt-2 px-1" key={step}>
        {steps[step]}
      </div>
    </div>
  )
}
