import React, { useEffect } from 'react'
import { BottomSheetMethods } from '@gorhom/bottom-sheet/lib/typescript/types'

import RatingPrompt from './RatingPrompt'
import { useAppRating } from './useAppRating'

/**
 * Global app rating modal that triggers on engagement milestones.
 * Mount this in the app root (e.g., _layout.tsx InnerApp).
 * It checks after a delay whether conditions are met and shows the prompt.
 */
const AppRatingModal = () => {
  const ratingModalRef = React.useRef<BottomSheetMethods | null>(null)
  const { shouldShowRatingPrompt } = useAppRating()

  useEffect(() => {
    // Wait for the app to fully settle before checking
    const timer = setTimeout(() => {
      if (shouldShowRatingPrompt('engagement_milestone')) {
        ratingModalRef.current?.expand()
      }
    }, 5000)

    return () => clearTimeout(timer)
  }, [])

  return <RatingPrompt modalRef={ratingModalRef} />
}

export default AppRatingModal
