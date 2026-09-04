import { useEffect, useRef } from 'react'
import { useAppRating } from './useAppRating'

/**
 * Hook to track app opens and check for engagement-based rating triggers.
 * Should be called once at app startup (e.g., in InitHooks).
 * Returns whether the rating prompt should be shown.
 */
export function useAppRatingCheck() {
  const { trackAppOpen, shouldShowRatingPrompt } = useAppRating()
  const hasTracked = useRef(false)

  useEffect(() => {
    if (!hasTracked.current) {
      hasTracked.current = true
      trackAppOpen()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return {
    shouldShowEngagementRating: () => shouldShowRatingPrompt('engagement_milestone'),
  }
}
