import notifee from '@notifee/react-native'
import { useAtom } from 'jotai/react'
import { getCurrentAuthUser } from '~helpers/firebaseAuthRuntime'
import { readingReminderStateAtom } from './readingReminderState'
import {
  readReadingPermission,
  openReadingNotificationSettings,
} from './readingReminderDriver.native'

export const useReadingReminderPermission = () => {
  const [state, setState] = useAtom(readingReminderStateAtom)
  return {
    ...state,
    request: async () => {
      const owner = getCurrentAuthUser()?.uid ?? ''
      try {
        await notifee.requestPermission()
        const permission = await readReadingPermission()
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
