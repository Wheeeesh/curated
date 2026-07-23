import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from './api'
import type { NewPlaceInput, NewReviewInput } from './api/types'
import { useUi } from './session'
import { buildTasteEngine, type TasteEngine } from './taste/match'
import { CREDITS } from './credits/rules'

export const useCities = () => useQuery({ queryKey: ['cities'], queryFn: () => api.listCities() })
export const useMembers = () => useQuery({ queryKey: ['members'], queryFn: () => api.listMembers() })
export const useFollows = () => useQuery({ queryKey: ['follows'], queryFn: () => api.listFollows() })
export const usePlaces = () => useQuery({ queryKey: ['places'], queryFn: () => api.listPlaces() })
export const useAllReviews = () => useQuery({ queryKey: ['reviews'], queryFn: () => api.listAllReviews() })

export const useMyProfile = () => {
  const session = useUi((s) => s.session)
  return useQuery({
    queryKey: ['profile', session?.userId],
    queryFn: () => api.getProfile(session!.userId),
    enabled: !!session,
  })
}

export const useLedger = (userId: string | undefined) =>
  useQuery({
    queryKey: ['ledger', userId],
    queryFn: () => api.listCreditLedger(userId!),
    enabled: !!userId,
  })

/** One memoized taste engine per data change. null while anything loads. */
export function useTasteEngine(): TasteEngine | null {
  const { data: me } = useMyProfile()
  const { data: members } = useMembers()
  const { data: follows } = useFollows()
  const { data: places } = usePlaces()
  const { data: reviews } = useAllReviews()
  return useMemo(() => {
    if (!me || !members || !follows || !places || !reviews) return null
    return buildTasteEngine({ me, members, follows, places, reviews })
  }, [me, members, follows, places, reviews])
}

export const useSavedPlaceIds = () => {
  const session = useUi((s) => s.session)
  return useQuery({
    queryKey: ['saved', session?.userId],
    queryFn: () => api.listSavedPlaceIds(),
    enabled: !!session,
  })
}

export function useSaveMutation() {
  const qc = useQueryClient()
  const showToast = useUi((s) => s.showToast)
  return useMutation({
    mutationFn: ({ placeId, saved }: { placeId: string; saved: boolean }) => api.setPlaceSaved(placeId, saved),
    onSuccess: (_d, { saved }) => {
      qc.invalidateQueries({ queryKey: ['saved'] })
      showToast(saved ? 'Saved to your list' : 'Removed from your list')
    },
  })
}

export function useFollowMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ userId, on }: { userId: string; on: boolean }) =>
      on ? api.follow(userId) : api.unfollow(userId),
    onSettled: () => qc.invalidateQueries({ queryKey: ['follows'] }),
  })
}

export function useReviewMutation() {
  const qc = useQueryClient()
  const showToast = useUi((s) => s.showToast)
  return useMutation({
    mutationFn: (input: NewReviewInput) => api.upsertReview(input),
    onSuccess: ({ creditsAwarded }) => {
      qc.invalidateQueries({ queryKey: ['reviews'] })
      qc.invalidateQueries({ queryKey: ['ledger'] })
      const mine = creditsAwarded.filter((c) => c.reason === 'REVIEW_FULL' || c.reason === 'REVIEW_BASIC')
      const total = mine.reduce((s, c) => s + c.amount, 0)
      if (total > 0) {
        showToast(
          mine.some((c) => c.reason === 'REVIEW_FULL')
            ? `+${total} credits — full review saved`
            : `+${total} credits — saved. ${CREDITS.REVIEW_FULL} for reviews of 80+ characters`,
          true,
        )
      } else {
        showToast('Review saved')
      }
    },
  })
}

export function useAddPlaceMutation() {
  const qc = useQueryClient()
  const showToast = useUi((s) => s.showToast)
  return useMutation({
    mutationFn: (input: NewPlaceInput) => api.addPlace(input),
    onSuccess: ({ creditsAwarded }) => {
      qc.invalidateQueries({ queryKey: ['places'] })
      qc.invalidateQueries({ queryKey: ['ledger'] })
      const total = creditsAwarded.reduce((s, c) => s + c.amount, 0)
      showToast(total > 0 ? `+${total} credits — pinned to the atlas` : 'Pinned to the atlas', total > 0)
    },
  })
}
