import { useEffect, useEffectEvent } from 'react'

import { useSheet } from '~helpers/useSheet'
import RatingPrompt from './RatingPrompt'
import { useAppRating } from './useAppRating'

/**
 * Global app rating modal that triggers on engagement milestones.
 * Mount this in the app root (e.g., _layout.tsx InnerApp).
 * It checks after a delay whether conditions are met and shows the prompt.
 */
const AppRatingModal = () => {
  const { ref, open, close } = useSheet()
  const { shouldShowRatingPrompt } = useAppRating()

  const readMountCheck = useEffectEvent(() => ({ shouldShowRatingPrompt, open }))

  useEffect(() => {
    // Check against the rating state read at mount, even if it changes during the delay.
    const mountCheck = readMountCheck()
    const timer = setTimeout(() => {
      if (mountCheck.shouldShowRatingPrompt('engagement_milestone')) {
        mountCheck.open()
      }
    }, 5000)

    return () => clearTimeout(timer)
  }, [])

  return <RatingPrompt modalRef={ref} onClose={close} />
}

export default AppRatingModal
