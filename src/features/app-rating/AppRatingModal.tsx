import { useEffect } from 'react'

import { useBottomSheetModal } from '~helpers/useBottomSheet'
import RatingPrompt from './RatingPrompt'
import { useAppRating } from './useAppRating'

/**
 * Global app rating modal that triggers on engagement milestones.
 * Mount this in the app root (e.g., _layout.tsx InnerApp).
 * It checks after a delay whether conditions are met and shows the prompt.
 */
const AppRatingModal = () => {
  const { ref, open, close } = useBottomSheetModal()
  const { shouldShowRatingPrompt } = useAppRating()

  useEffect(() => {
    const timer = setTimeout(() => {
      if (shouldShowRatingPrompt('engagement_milestone')) {
        open()
      }
    }, 5000)

    return () => clearTimeout(timer)
  }, [])

  return <RatingPrompt modalRef={ref} onClose={close} />
}

export default AppRatingModal
