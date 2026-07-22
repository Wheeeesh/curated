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

/**
 * The single contract both the zero-setup demo adapter and the Supabase
 * adapter implement. Aggregates (averages, Match %, credit balances shown on
 * other profiles) are computed client-side from these primitives.
 */
export interface DataAdapter {
  /** True when running against the local demo dataset (no Supabase env). */
  readonly isDemo: boolean

  // session
  getSession(): Promise<Session | null>
  onAuthChange(cb: (s: Session | null) => void): () => void
  signUp(input: SignUpInput): Promise<Session>
  signIn(email: string, password: string): Promise<Session>
  signOut(): Promise<void>

  // profiles & onboarding
  getProfile(userId: string): Promise<Profile | null>
  updateProfile(patch: Partial<Pick<Profile, 'displayName' | 'bio' | 'avatarColor' | 'interests' | 'homeCity'>>): Promise<Profile>
  completeOnboarding(interests: Category[], homeCity: string | null, followIds: string[]): Promise<void>
  listMembers(): Promise<Profile[]>

  // follows
  follow(userId: string): Promise<void>
  unfollow(userId: string): Promise<void>
  listFollows(): Promise<Follow[]>

  // cities & places
  listCities(): Promise<City[]>
  listPlaces(cityId?: string): Promise<Place[]>
  getPlace(placeId: string): Promise<Place | null>
  addPlace(input: NewPlaceInput): Promise<{ place: Place; creditsAwarded: CreditEntry[] }>

  // reviews
  listReviewsForPlace(placeId: string): Promise<Review[]>
  listAllReviews(): Promise<Review[]>
  upsertReview(input: NewReviewInput): Promise<{ review: Review; creditsAwarded: CreditEntry[] }>

  // credits
  listCreditLedger(userId: string): Promise<CreditEntry[]>
  /** Spend credits to unlock everything added so far. */
  spendCreditsToUnlock(): Promise<CreditEntry>

  // demo-only helper (no-op on Supabase)
  resetDemo?(): Promise<void>
}
