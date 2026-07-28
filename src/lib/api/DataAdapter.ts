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
  /**
   * `event` is only supplied for the one case the app has to react to: the
   * member arriving back from a password-reset email, where they are signed
   * in but must be sent to set a new password rather than into the atlas.
   */
  onAuthChange(cb: (s: Session | null, event?: 'password-recovery') => void): () => void
  signUp(input: SignUpInput): Promise<Session>
  signIn(email: string, password: string): Promise<Session>
  signOut(): Promise<void>
  /** Emails a link back to the app. Resolves even if the address is unknown. */
  sendPasswordReset(email: string): Promise<void>
  /** Sets a new password for the member the recovery link signed in. */
  updatePassword(newPassword: string): Promise<void>

  // profiles & onboarding
  getProfile(userId: string): Promise<Profile | null>
  updateProfile(
    patch: Partial<Pick<Profile, 'displayName' | 'bio' | 'avatarColor' | 'avatarUrl' | 'interests' | 'homeCity'>>,
  ): Promise<Profile>
  /** Stores an already-resized image and returns the URL to display it from. */
  uploadAvatar(image: Blob): Promise<string>
  completeOnboarding(interests: Category[], homeCity: string | null, homeLat: number | null, homeLng: number | null, followIds: string[]): Promise<void>
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

  // saved places ("want to go")
  listSavedPlaceIds(): Promise<string[]>
  setPlaceSaved(placeId: string, saved: boolean): Promise<void>

  // credits
  listCreditLedger(userId: string): Promise<CreditEntry[]>
  /** Spend credits to unlock everything added so far. */
  spendCreditsToUnlock(): Promise<CreditEntry>

  // demo-only helper (no-op on Supabase)
  resetDemo?(): Promise<void>
}
