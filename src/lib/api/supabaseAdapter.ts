import { createClient, type Session as SbSession } from '@supabase/supabase-js'
import type { DataAdapter } from './DataAdapter'
import type {
  City,
  CreditEntry,
  Follow,
  NewPlaceInput,
  NewReviewInput,
  Place,
  Profile,
  Review,
  Session,
  SignUpInput,
} from './types'

import { IMPORTED_PLACES } from '../../seed/imported'

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>

const toCity = (r: Row): City => ({
  id: r.id, name: r.name, country: r.country,
  centerLat: r.center_lat, centerLng: r.center_lng, defaultZoom: r.default_zoom,
})
const toProfile = (r: Row): Profile => ({
  id: r.id, username: r.username, displayName: r.display_name, avatarColor: r.avatar_color,
  bio: r.bio ?? '', interests: r.interests ?? [], homeCity: r.home_city,
  homeLat: r.home_lat, homeLng: r.home_lng,
  isAdmin: r.is_admin, invitedBy: r.invited_by, onboarded: r.onboarded, isSeed: r.is_seed,
  createdAt: r.created_at,
})
const toPlace = (r: Row): Place => ({
  id: r.id, cityId: r.city_id ?? '', locality: r.locality ?? '', name: r.name,
  categories: r.categories ?? [], lat: r.lat, lng: r.lng,
  address: r.address ?? '', description: r.description ?? '', createdBy: r.created_by, createdAt: r.created_at,
})
const toReview = (r: Row): Review => ({
  id: r.id, placeId: r.place_id, userId: r.user_id,
  scores: r.scores ?? {},
  textReview: r.text_review ?? '', isWarning: r.is_warning, warningReason: r.warning_reason,
  createdAt: r.created_at, updatedAt: r.updated_at,
})
const toCredit = (r: Row): CreditEntry => ({
  id: r.id, userId: r.user_id, amount: r.amount, reason: r.reason, refId: r.ref_id, createdAt: r.created_at,
})

const mapSession = (s: SbSession | null): Session | null =>
  s ? { userId: s.user.id, email: s.user.email ?? '' } : null

export function createSupabaseAdapter(url: string, anonKey: string): DataAdapter {
  const sb = createClient(url, anonKey)

  /**
   * Supabase surfaces errors in several shapes — `message`, GoTrue's `msg`,
   * or a raw Postgres error for a failing trigger. Without this, a 500 from
   * a trigger reached the UI as a useless "{}".
   */
  const die = (error: unknown): void => {
    if (!error) return
    const e = error as Record<string, unknown>
    const text =
      (typeof e.message === 'string' && e.message) ||
      (typeof e.msg === 'string' && e.msg) ||
      (typeof e.error_description === 'string' && e.error_description) ||
      (typeof e.error === 'string' && e.error) ||
      ''
    throw new Error(text || `Something went wrong (${e.code ?? e.status ?? 'unknown error'}).`)
  }

  const uid = async (): Promise<string> => {
    const { data } = await sb.auth.getSession()
    if (!data.session) throw new Error('Not signed in')
    return data.session.user.id
  }

  return {
    isDemo: false,

    async getSession() {
      const { data } = await sb.auth.getSession()
      return mapSession(data.session)
    },
    onAuthChange(cb) {
      const { data } = sb.auth.onAuthStateChange((_evt, session) => cb(mapSession(session)))
      return () => data.subscription.unsubscribe()
    },
    async signUp(input: SignUpInput) {
      const { data, error } = await sb.auth.signUp({
        email: input.email.trim(),
        password: input.password,
        options: {
          data: {
            username: input.username.trim().toLowerCase(),
            display_name: input.displayName.trim(),
          },
        },
      })
      die(error)
      if (!data.session) {
        throw new Error(
          'Account created but no session — email confirmation is probably still enabled in Supabase. See README.',
        )
      }
      return mapSession(data.session)!
    },
    async signIn(email, password) {
      const { data, error } = await sb.auth.signInWithPassword({ email: email.trim(), password })
      die(error)
      return mapSession(data.session)!
    },
    async signOut() {
      await sb.auth.signOut()
    },

    async getProfile(userId) {
      const { data, error } = await sb.from('profiles').select('*').eq('id', userId).maybeSingle()
      die(error)
      return data ? toProfile(data) : null
    },
    async updateProfile(patch) {
      const row: Row = {}
      if (patch.displayName !== undefined) row.display_name = patch.displayName
      if (patch.bio !== undefined) row.bio = patch.bio
      if (patch.avatarColor !== undefined) row.avatar_color = patch.avatarColor
      if (patch.interests !== undefined) row.interests = patch.interests
      if (patch.homeCity !== undefined) row.home_city = patch.homeCity
      const { data, error } = await sb.from('profiles').update(row).eq('id', await uid()).select().single()
      die(error)
      return toProfile(data)
    },
    async completeOnboarding(interests, homeCity, homeLat, homeLng, followIds) {
      const me = await uid()
      const { error } = await sb
        .from('profiles')
        .update({ interests, home_city: homeCity, home_lat: homeLat, home_lng: homeLng, onboarded: true })
        .eq('id', me)
      die(error)
      if (followIds.length) {
        const { error: fe } = await sb
          .from('follows')
          .upsert(followIds.map((fid) => ({ follower_id: me, followee_id: fid })), { ignoreDuplicates: true })
        die(fe)
      }
    },
    async listMembers() {
      const { data, error } = await sb.from('profiles').select('*')
      die(error)
      return (data ?? []).map(toProfile)
    },

    async follow(userId) {
      const { error } = await sb
        .from('follows')
        .upsert([{ follower_id: await uid(), followee_id: userId }], { ignoreDuplicates: true })
      die(error)
    },
    async unfollow(userId) {
      const { error } = await sb.from('follows').delete().match({ follower_id: await uid(), followee_id: userId })
      die(error)
    },
    async listFollows(): Promise<Follow[]> {
      const { data, error } = await sb.from('follows').select('follower_id, followee_id')
      die(error)
      return (data ?? []).map((r: Row) => ({ followerId: r.follower_id, followeeId: r.followee_id }))
    },

    async listCities() {
      const { data, error } = await sb.from('cities').select('*').order('name')
      die(error)
      return (data ?? []).map(toCity)
    },
    async listPlaces(cityId) {
      let q = sb.from('places').select('*')
      if (cityId) q = q.eq('city_id', cityId)
      const { data, error } = await q
      die(error)
      // The imported guide locations are read-only reference data shipped in
      // the app bundle, so they never occupy database rows — members' own
      // pins and every review still live in Supabase.
      return [...(data ?? []).map(toPlace), ...IMPORTED_PLACES]
    },
    async getPlace(placeId) {
      const { data, error } = await sb.from('places').select('*').eq('id', placeId).maybeSingle()
      die(error)
      if (data) return toPlace(data)
      return IMPORTED_PLACES.find((p) => p.id === placeId) ?? null
    },
    async addPlace(input: NewPlaceInput) {
      const { data, error } = await sb
        .from('places')
        .insert({
          city_id: input.cityId || null, locality: input.locality, name: input.name,
          categories: input.categories,
          lat: input.lat, lng: input.lng, address: input.address, description: input.description,
          created_by: await uid(),
        })
        .select()
        .single()
      die(error)
      const place = toPlace(data)
      // Credits are written by the DB trigger; fetch what it minted for the toast.
      const { data: credits } = await sb.from('credit_ledger').select('*').eq('ref_id', place.id)
      return { place, creditsAwarded: (credits ?? []).map(toCredit) }
    },

    async listReviewsForPlace(placeId) {
      const { data, error } = await sb.from('reviews').select('*').eq('place_id', placeId)
      die(error)
      return (data ?? []).map(toReview)
    },
    async listAllReviews() {
      const { data, error } = await sb.from('reviews').select('*')
      die(error)
      return (data ?? []).map(toReview)
    },
    async upsertReview(input: NewReviewInput) {
      const me = await uid()
      const { data, error } = await sb
        .from('reviews')
        .upsert(
          {
            place_id: input.placeId, user_id: me,
            scores: input.scores,
            text_review: input.textReview, is_warning: input.isWarning, warning_reason: input.warningReason,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'place_id,user_id' },
        )
        .select()
        .single()
      die(error)
      const review = toReview(data)
      const { data: credits } = await sb.from('credit_ledger').select('*').eq('ref_id', review.id).eq('user_id', me)
      return { review, creditsAwarded: (credits ?? []).map(toCredit) }
    },

    async spendCreditsToUnlock() {
      const { data, error } = await sb.rpc('spend_credits_to_unlock')
      die(error)
      return toCredit(Array.isArray(data) ? data[0] : data)
    },

    async listSavedPlaceIds() {
      // RLS scopes this to the caller.
      const { data, error } = await sb.from('saved_places').select('place_id')
      die(error)
      return (data ?? []).map((r: Row) => r.place_id as string)
    },
    async setPlaceSaved(placeId, saved) {
      if (saved) {
        const { error } = await sb
          .from('saved_places')
          .upsert([{ user_id: await uid(), place_id: placeId }], { ignoreDuplicates: true })
        die(error)
      } else {
        const { error } = await sb.from('saved_places').delete().match({ user_id: await uid(), place_id: placeId })
        die(error)
      }
    },

    async listCreditLedger(userId) {
      const { data, error } = await sb
        .from('credit_ledger')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
      die(error)
      return (data ?? []).map(toCredit)
    },
  }
}
