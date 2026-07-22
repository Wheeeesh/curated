import { useNavigate } from 'react-router-dom'

/**
 * Whole-screen state for loading, "not found" and empty results. Screens
 * used to `return null` in these cases, which left the user on a blank
 * white page with no way back.
 */
export function ScreenMessage({
  title,
  body,
  actionLabel,
  onAction,
}: {
  title: string
  body?: string
  actionLabel?: string
  onAction?: () => void
}) {
  const navigate = useNavigate()
  return (
    <div className="flex h-full flex-col items-center justify-center px-8 text-center">
      <h2 className="t-title">{title}</h2>
      {body && <p className="mt-2 max-w-[32ch] t-subhead text-label-2">{body}</p>}
      {(actionLabel || onAction) && (
        <button
          type="button"
          onClick={onAction ?? (() => navigate('/', { replace: true }))}
          className="pressable btn-secondary mt-6 !w-auto px-6"
        >
          {actionLabel ?? 'Back to the atlas'}
        </button>
      )}
    </div>
  )
}

export function ScreenLoading() {
  return (
    <div className="flex h-full items-center justify-center">
      <span className="t-subhead text-label-2">Loading…</span>
    </div>
  )
}
