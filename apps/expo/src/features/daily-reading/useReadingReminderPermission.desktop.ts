import { useAtom } from 'jotai/react'

import {
  openReadingNotificationSettings,
  requestReadingPermission,
} from '~desktop/readingReminders'
import { getCurrentAuthUser } from '~helpers/firebaseAuthRuntime'

import { readingReminderStateAtom } from './readingReminderState'

/** The desktop app asks the system as the mobile apps do (`reminders.rs`). */
export const useReadingReminderPermission = () => {
  const [state, setState] = useAtom(readingReminderStateAtom)
  return {
    ...state,
    request: async () => {
      const owner = getCurrentAuthUser()?.uid ?? ''
      try {
        const permission = await requestReadingPermission()
        setState(current => ({ ...current, permission, retry: current.retry + 1 }))
        return permission === 'allowed' && owner === (getCurrentAuthUser()?.uid ?? '')
      } catch {
        setState(current => ({ ...current, phase: 'error' }))
        return false
      }
    },
    openSettings: async () => {
      try {
        await openReadingNotificationSettings()
      } catch {
        setState(current => ({ ...current, phase: 'error' }))
      }
    },
    retry: () => setState(current => ({ ...current, retry: current.retry + 1 })),
  }
}
