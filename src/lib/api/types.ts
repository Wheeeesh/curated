export const CATEGORIES = [
  'food',
  'coffee',
  'bars',
  'nightlife',
  'music',
  'culture',
  'art',
  'nature',
  'sport',
  'shopping',
  'artisan',
] as const

export type Category = (typeof CATEGORIES)[number]

/**
 * Rating criteria. A place is rated on the union of its categories'
 * criteria, deduplicated — so a bar that also serves food asks about the
 * food and the drinks, but only once about atmosphere, service and value.
 */
export const ASPECTS = [
  'food',
  'coffee',
  'drinks',
  'sound',
  'lineup',
  'crowd',
  'curation',
  'scenery',
  'quiet',
  'selection',
  'craft',
  'facilities',
  'atmosphere',
  'service',
  'value',
  'upkeep',
] as const

export type Aspect = (typeof ASPECTS)[number]

/** Which criteria each category asks about, in the order they're shown. */
export const CATEGORY_ASPECTS: Record<Category, Aspect[]> = {
  food: ['food', 'atmosphere', 'service', 'value'],
  coffee: ['coffee', 'atmosphere', 'service', 'value'],
  bars: ['drinks', 'atmosphere', 'service', 'value'],
  nightlife: ['sound', 'crowd', 'atmosphere', 'value'],
  music: ['sound', 'lineup', 'atmosphere', 'value'],
  culture: ['curation', 'atmosphere', 'value', 'upkeep'],
  art: ['curation', 'atmosphere', 'value', 'upkeep'],
  nature: ['scenery', 'quiet', 'upkeep', 'atmosphere'],
  sport: ['facilities', 'upkeep', 'service', 'value'],
  shopping: ['selection', 'service', 'value', 'atmosphere'],
  artisan: ['craft', 'selection', 'service', 'value'],
}

/** The union of criteria for a set of categories, in a stable order. */
export function aspectsForCategories(categories: Category[]): Aspect[] {
  const wanted = new Set<Aspect>()
  for (const c of categories) for (const a of CATEGORY_ASPECTS[c] ?? []) wanted.add(a)
  const ordered = ASPECTS.filter((a) => wanted.has(a))
  return ordered.length > 0 ? ordered : ['atmosphere', 'service', 'value']
}

export interface City {
  id: string
  name: string
  country: string
  centerLat: number
  centerLng: number
  defaultZoom: number
}

export interface Profile {
  id: string
  username: string
  displayName: string
  avatarColor: string
  bio: string
  interests: Category[]
  homeCity: string | null
  /** Home city centre — everything within HOME_RADIUS_KM is always unlocked. */
  homeLat: number | null
  homeLng: number | null
  isAdmin: boolean
  invitedBy: string | null
  onboarded: boolean
  isSeed: boolean
  createdAt: string
}

export interface InviteCode {
  id: string
  code: string
  ownerId: string
  usedBy: string | null
  usedAt: string | null
  createdAt: string
}

export interface Follow {
  followerId: string
  followeeId: string
}

export interface Place {
  id: string
  cityId: string
  /** Free-text locality shown under the name, e.g. "Antwerp, Belgium". */
  locality: string
  name: string
  categories: Category[]
  lat: number
  lng: number
  address: string
  description: string
  createdBy: string
  createdAt: string
}

/** Primary category — drives the pin colour and the leading badge. */
export const primaryCategory = (p: Pick<Place, 'categories'>): Category => p.categories[0] ?? 'food'

export interface Review {
  id: string
  placeId: string
  userId: string
  /** aspect key → 1–10. Only the aspects that applied to this place. */
  scores: Partial<Record<Aspect, number>>
  textReview: string
  isWarning: boolean
  warningReason: string | null
  createdAt: string
  updatedAt: string
}

export type CreditReason =
  | 'SIGNUP'
  | 'INVITE_JOINED'
  | 'REVIEW_FULL'
  | 'REVIEW_BASIC'
  | 'PLACE_ADDED'
  | 'PLACE_VALIDATED'
  | 'UNLOCK_SPEND'
  | 'CREDITS_PURCHASED'
  | 'VETERAN_BONUS'

export interface CreditEntry {
  id: string
  userId: string
  amount: number
  reason: CreditReason
  refId: string | null
  createdAt: string
}

export interface Session {
  userId: string
  email: string
}

export interface NewPlaceInput {
  cityId: string
  locality: string
  name: string
  categories: Category[]
  lat: number
  lng: number
  address: string
  description: string
}

export interface NewReviewInput {
  placeId: string
  scores: Partial<Record<Aspect, number>>
  textReview: string
  isWarning: boolean
  warningReason: string | null
}

export interface SignUpInput {
  email: string
  password: string
  username: string
  displayName: string
}

/**
 * Overall score, 1–10: the mean of whichever criteria were rated. Reviews
 * of different categories therefore stay comparable.
 */
export function overallScore(r: Pick<Review, 'scores'>): number {
  const vals = Object.values(r.scores).filter((v): v is number => typeof v === 'number')
  if (vals.length === 0) return 0
  return vals.reduce((s, v) => s + v, 0) / vals.length
}
