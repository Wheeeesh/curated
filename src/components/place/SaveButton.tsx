import { useSaveMutation, useSavedPlaceIds } from '../../lib/hooks'

/**
 * "Want to go" — the lightweight counterpart to a review. Saving costs
 * nothing and commits to nothing, so it is the natural first action on a
 * place you have not visited yet.
 */
export function SaveButton({ placeId, variant = 'full' }: { placeId: string; variant?: 'full' | 'icon' }) {
  const { data: savedIds } = useSavedPlaceIds()
  const mutation = useSaveMutation()
  const saved = (savedIds ?? []).includes(placeId)

  const icon = (
    <svg width="20" height="20" viewBox="0 0 24 24" fill={saved ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.9">
      <path d="M6 4h12a1 1 0 0 1 1 1v15l-7-4.2L5 20V5a1 1 0 0 1 1-1Z" strokeLinejoin="round" />
    </svg>
  )

  if (variant === 'icon') {
    return (
      <button
        type="button"
        aria-label={saved ? 'Saved — tap to remove' : 'Save for later'}
        aria-pressed={saved}
        disabled={mutation.isPending}
        onClick={() => mutation.mutate({ placeId, saved: !saved })}
        className={`pressable flex h-[50px] w-[50px] shrink-0 items-center justify-center rounded-xl ${
          saved ? 'bg-accent text-white' : 'bg-fill text-label'
        }`}
      >
        {icon}
      </button>
    )
  }

  return (
    <button
      type="button"
      aria-pressed={saved}
      disabled={mutation.isPending}
      onClick={() => mutation.mutate({ placeId, saved: !saved })}
      className={`pressable btn-secondary gap-2 ${saved ? '!bg-accent !text-white' : ''}`}
    >
      {icon}
      {saved ? 'Saved' : 'Save for later'}
    </button>
  )
}
