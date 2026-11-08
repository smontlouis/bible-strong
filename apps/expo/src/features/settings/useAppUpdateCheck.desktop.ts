import { useState } from 'react'

import { desktopBootstrap } from '~desktop/bridge'
import { checkDesktopUpdate } from '~desktop/desktopUpdates'

import type { AppUpdateCheck } from './useAppUpdateCheck'

export type { AppUpdateCheck }

/** The desktop app's signed updater; the Mac App Store build is updated by the store. */
export const useAppUpdateCheck = (): AppUpdateCheck | null => {
  const [isChecking, setIsChecking] = useState(false)
  if (!desktopBootstrap().updater) return null

  const check = async () => {
    if (isChecking) return
    setIsChecking(true)
    try {
      await checkDesktopUpdate({ announce: true })
    } finally {
      setIsChecking(false)
    }
  }

  return { check, isChecking }
}
