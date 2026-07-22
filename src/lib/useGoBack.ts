import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'

/**
 * Back, falling back to the map when there is nothing to go back to —
 * opening a shared place link, or launching the installed app straight
 * onto a deep route, both leave the history stack empty.
 */
export function useGoBack(fallback = '/') {
  const navigate = useNavigate()
  return useCallback(() => {
    const idx = (window.history.state as { idx?: number } | null)?.idx
    if (typeof idx === 'number' && idx > 0) navigate(-1)
    else navigate(fallback, { replace: true })
  }, [navigate, fallback])
}
