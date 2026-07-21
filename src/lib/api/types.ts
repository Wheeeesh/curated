export const CATEGORIES = [
  'food',
  'bars',
  'nature',
  'music',
  'culture',
  'nightlife',
  'shopping',
] as const

export type Category = (typeof CATEGORIES)[number]

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
  name: string
  category: Category
  lat: number
  lng: number
  address: string
  description: string
  createdBy: string
  createdAt: string
}

export const ASPECTS = ['quality', 'vibe', 'service', 'value'] as const
export type Aspect = (typeof ASPECTS)[number]

export interface Review {
  id: string
  placeId: string
  userId: string
  quality: number
  vibe: number
  service: number
  value: number
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
  name: string
  category: Category
  lat: number
  lng: number
  address: string
  description: string
}

export interface NewReviewInput {
  placeId: string
  quality: number
  vibe: number
  service: number
  value: number
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

/** Weighted overall score of a review on the 1–10 scale. */
export function overallScore(r: Pick<Review, 'quality' | 'vibe' | 'service' | 'value'>): number {
  return 0.4 * r.quality + 0.3 * r.vibe + 0.15 * r.service + 0.15 * r.value
}
