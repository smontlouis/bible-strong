import { useRootNavigationState, useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { useSelector, useStore } from 'react-redux'

import {
  readingReminderInbox,
  readingReminderQueue,
  subscribeReadingReminderClicks,
} from '~desktop/readingReminders'
import { getCurrentAuthUser } from '~helpers/firebaseAuthRuntime'
import type { RootState } from '~redux/modules/reducer'

import { useReadingReminderSchedule } from './useReadingReminderSchedule'

/**
 * The reading reminders of the desktop app (ADR-0119): the schedule of the mobile apps, kept by
 * the system through the shell, and the reading a clicked reminder opens.
 */
const ReadingReminders = () => {
  const userId = useSelector((state: RootState) => state.user.id)
  const [activation, setActivation] = useState(0)
  const router = useRouter()
  const navigation = useRootNavigationState()
  const store = useStore<RootState>()

  // The window coming back to the front plays the part of the mobile app becoming active.
  useEffect(() => {
    const activate = () => setActivation(value => value + 1)
    window.addEventListener('focus', activate)
    return () => window.removeEventListener('focus', activate)
  }, [])

  useReadingReminderSchedule(readingReminderQueue, activation)

  useEffect(() => {
    if (!navigation?.key) return
    const flush = () => {
      const owner = getCurrentAuthUser()?.uid ?? ''
      if (owner !== store.getState().user.id) return
      const destination = readingReminderInbox.consume(owner)
      if (destination) router.push(destination)
    }
    flush()
    const unsubscribe = subscribeReadingReminderClicks(flush)
    // The account may be restored after the click that launched the app.
    window.addEventListener('focus', flush)
    return () => {
      unsubscribe()
      window.removeEventListener('focus', flush)
    }
  }, [navigation?.key, router, store, userId])

  return null
}
export default ReadingReminders
