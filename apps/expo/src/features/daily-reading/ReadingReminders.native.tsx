import notifee, { EventType } from '@notifee/react-native'
import { useRootNavigationState, useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { AppState, Platform } from 'react-native'
import { useSelector, useStore } from 'react-redux'
import { getCurrentAuthUser } from '~helpers/firebaseAuthRuntime'
import type { RootState } from '~redux/modules/reducer'
import { readingReminderQueue } from './readingReminderDriver.native'
import { getReadingReminderInbox } from './readingReminderInbox.native'
import { useReadingReminderSchedule } from './useReadingReminderSchedule'

const ReadingReminders = () => {
  const userId = useSelector((state: RootState) => state.user.id)
  const [activation, setActivation] = useState(0)
  const router = useRouter()
  const navigation = useRootNavigationState()
  const store = useStore<RootState>()

  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') setActivation(value => value + 1)
    })
    return () => subscription.remove()
  }, [])

  useReadingReminderSchedule(readingReminderQueue, activation)

  useEffect(() => {
    if (!navigation?.key) return
    let active = true
    const inbox = getReadingReminderInbox()
    const flush = () => {
      const owner = getCurrentAuthUser()?.uid ?? ''
      if (!active || owner !== store.getState().user.id) return
      const destination = inbox.consume(owner)
      if (destination) router.push(destination)
    }
    flush()
    if (Platform.OS === 'android') {
      void notifee
        .getInitialNotification()
        .then(initial => {
          if (!active || !initial) return
          inbox.remember(initial.notification.id, initial.notification.data)
          flush()
        })
        .catch(() => {
          /* No initial event is also a normal launch. */
        })
    }
    const unsubscribe = notifee.onForegroundEvent(({ type, detail }) => {
      if (type !== EventType.PRESS) return
      inbox.remember(detail.notification?.id, detail.notification?.data)
      flush()
    })
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') flush()
    })
    return () => {
      active = false
      unsubscribe()
      subscription.remove()
    }
  }, [navigation?.key, router, store, userId])

  return null
}
export default ReadingReminders
