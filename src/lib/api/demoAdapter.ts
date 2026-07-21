import type { DataAdapter } from './DataAdapter'
import type {
  Category,
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
import { creditsForPlaceAdd, creditsForReview, creditsForSignup, type PendingCredit } from '../credits/rules'
import { SEED_CITIES } from '../../seed/cities'
import { SEED_MEMBERS, SEED_FOLLOWS } from '../../seed/members'
import { SEED_PLACES } from '../../seed/places'
import { SEED_REVIEWS } from '../../seed/reviews'
import { buildSeedLedger } from '../../seed/ledger'

const STORAGE_KEY = 'curated-demo-v1'

interface DemoState {
  session: Session | null
  profiles: Profile[]
  follows: Follow[]
  places: Place[]
  reviews: Review[]
  ledger: CreditEntry[]
  /** email → { userId, password } for demo sign-in */
  accounts: Record<string, { userId: string; password: string }>
}

function freshState(): DemoState {
  const profiles: Profile[] = SEED_MEMBERS.map(({ bias: _b, follows: _f, voice: _v, ...profile }) => profile)
  const places: Place[] = SEED_PLACES.map(({ baseQuality: _q, ...place }) => place)
  return {
    session: null,
    profiles,
    follows: [...SEED_FOLLOWS],
    places,
    reviews: [...SEED_REVIEWS],
    ledger: buildSeedLedger(),
    accounts: {},
  }
}

function load(): DemoState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as DemoState
  } catch {
    // corrupted state → rebuild
  }
  return freshState()
}

export function createDemoAdapter(): DataAdapter {
  let state = load()
  const listeners = new Set<(s: Session | null) => void>()

  const persist = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  }
  const notify = () => listeners.forEach((cb) => cb(state.session))

  const requireUser = (): string => {
    if (!state.session) throw new Error('Not signed in')
    return state.session.userId
  }

  const commitCredits = (pending: PendingCredit[]): CreditEntry[] => {
    const entries: CreditEntry[] = pending.map((pc) => ({
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      ...pc,
    }))
    state.ledger.push(...entries)
    return entries
  }

  return {
    isDemo: true,

    async getSession() {
      return state.session
    },
    onAuthChange(cb) {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    async signUp(input: SignUpInput) {
      const email = input.email.trim().toLowerCase()
      if (state.accounts[email]) throw new Error('An account with this email already exists — sign in instead.')
      const username = input.username.trim().toLowerCase()
      if (!/^[a-z0-9_]{3,20}$/.test(username)) throw new Error('Username: 3–20 chars, letters/numbers/underscore.')
      if (state.profiles.some((p) => p.username === username)) throw new Error('That username is taken.')

      const userId = crypto.randomUUID()
      const now = new Date().toISOString()
      const profile: Profile = {
        id: userId,
        username,
        displayName: input.displayName.trim() || username,
        avatarColor: '#d0a75f',
        bio: '',
        interests: [],
        homeCity: null,
        // Demo mode: you are the admin, so every admin surface is visible.
        isAdmin: true,
        invitedBy: null,
        onboarded: false,
        isSeed: false,
        createdAt: now,
      }
      state.profiles.push(profile)
      state.accounts[email] = { userId, password: input.password }
      commitCredits(creditsForSignup(userId, null))
      state.session = { userId, email }
      persist()
      notify()
      return state.session
    },
    async signIn(email, password) {
      const acc = state.accounts[email.trim().toLowerCase()]
      if (!acc || acc.password !== password) throw new Error('Wrong email or password.')
      state.session = { userId: acc.userId, email: email.trim().toLowerCase() }
      persist()
      notify()
      return state.session
    },
    async signOut() {
      state.session = null
      persist()
      notify()
    },

    async getProfile(userId) {
      return state.profiles.find((p) => p.id === userId) ?? null
    },
    async updateProfile(patch) {
      const me = state.profiles.find((p) => p.id === requireUser())!
      Object.assign(me, patch)
      persist()
      return me
    },
    async completeOnboarding(interests: Category[], homeCity: string, followIds: string[]) {
      const uid = requireUser()
      const me = state.profiles.find((p) => p.id === uid)!
      me.interests = interests
      me.homeCity = homeCity
      me.onboarded = true
      for (const fid of followIds) {
        if (fid !== uid && !state.follows.some((f) => f.followerId === uid && f.followeeId === fid)) {
          state.follows.push({ followerId: uid, followeeId: fid })
        }
      }
      persist()
    },
    async listMembers() {
      return [...state.profiles]
    },

    async follow(userId) {
      const uid = requireUser()
      if (userId === uid) return
      if (!state.follows.some((f) => f.followerId === uid && f.followeeId === userId)) {
        state.follows.push({ followerId: uid, followeeId: userId })
        persist()
      }
    },
    async unfollow(userId) {
      const uid = requireUser()
      state.follows = state.follows.filter((f) => !(f.followerId === uid && f.followeeId === userId))
      persist()
    },
    async listFollows() {
      return [...state.follows]
    },

    async listCities(): Promise<City[]> {
      return SEED_CITIES
    },
    async listPlaces(cityId) {
      return cityId ? state.places.filter((p) => p.cityId === cityId) : [...state.places]
    },
    async getPlace(placeId) {
      return state.places.find((p) => p.id === placeId) ?? null
    },
    async addPlace(input: NewPlaceInput) {
      const uid = requireUser()
      const place: Place = {
        id: crypto.randomUUID(),
        ...input,
        createdBy: uid,
        createdAt: new Date().toISOString(),
      }
      state.places.push(place)
      const creditsAwarded = commitCredits(
        creditsForPlaceAdd({ place, ledger: state.ledger, nowIso: place.createdAt }),
      )
      persist()
      return { place, creditsAwarded }
    },

    async listReviewsForPlace(placeId) {
      return state.reviews.filter((r) => r.placeId === placeId)
    },
    async listAllReviews() {
      return [...state.reviews]
    },
    async upsertReview(input: NewReviewInput) {
      const uid = requireUser()
      const place = state.places.find((p) => p.id === input.placeId)
      if (!place) throw new Error('Place not found')
      const now = new Date().toISOString()
      let review = state.reviews.find((r) => r.placeId === input.placeId && r.userId === uid)
      if (review) {
        Object.assign(review, input, { updatedAt: now })
      } else {
        review = { id: crypto.randomUUID(), userId: uid, createdAt: now, updatedAt: now, ...input }
        state.reviews.push(review)
      }
      const allPlaceReviews = state.reviews.filter((r) => r.placeId === input.placeId)
      const creditsAwarded = commitCredits(
        creditsForReview({ review, place, allPlaceReviews, ledger: state.ledger, nowIso: now }),
      )
      persist()
      return { review, creditsAwarded }
    },

    async listCreditLedger(userId) {
      return state.ledger.filter((e) => e.userId === userId)
    },

    async resetDemo() {
      localStorage.removeItem(STORAGE_KEY)
      state = freshState()
      notify()
    },
  }
}
