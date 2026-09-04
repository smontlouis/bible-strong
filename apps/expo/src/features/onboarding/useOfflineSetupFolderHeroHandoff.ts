import { useRef } from 'react'
import type { View } from 'react-native'

import type { OfflineSetupReviewFolderContext } from './offlineSetupReview'
import type { OfflineSetupFrame } from './offlineSetupPresentation'

const useOfflineSetupFolderHeroHandoff = ({
  context,
  onCloseSheet,
}: {
  context?: OfflineSetupReviewFolderContext
  onCloseSheet: () => void
}) => {
  const folderBadgeRef = useRef<View | null>(null)

  const measureFolderBadge = (onMeasured: (frame?: OfflineSetupFrame) => void) => {
    if (!folderBadgeRef.current) {
      onMeasured(undefined)
      return
    }

    folderBadgeRef.current.measureInWindow((x, y, width, height) => {
      onMeasured({ x, y, width, height })
    })
  }

  const reportFolderHeroTarget = () => {
    if (!context) return
    measureFolderBadge(frame => {
      if (frame) context.onHeroTargetLayout(frame)
    })
  }

  const closeFolder = () => {
    if (!context) return
    measureFolderBadge(frame => {
      context.onClose(frame)
      onCloseSheet()
    })
  }

  return {
    closeFolder,
    folderBadgeRef,
    reportFolderHeroTarget,
  }
}

export default useOfflineSetupFolderHeroHandoff
