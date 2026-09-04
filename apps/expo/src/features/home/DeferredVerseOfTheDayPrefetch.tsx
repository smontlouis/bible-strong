import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { AppState } from 'react-native'
import { useSelector } from 'react-redux'
import { useResourceAccess } from '~features/resources/resourceAccess'
import type { RootState } from '~redux/modules/reducer'
import { useDefaultBibleVersion } from '~state/useDefaultBibleVersion'
import { getVerseOfTheDayPrefetchOffsets } from './verseOfTheDayPolicy'
import { createVerseOfTheDayQueryOptions } from './verseOfTheDayQuery'

const scheduleIdleTask = (task: () => void) => {
  if (typeof globalThis.requestIdleCallback === 'function') {
    const handle = globalThis.requestIdleCallback(task, { timeout: 3_000 })
    return () => globalThis.cancelIdleCallback(handle)
  }

  const handle = setTimeout(task, 0)
  return () => clearTimeout(handle)
}

const DeferredVerseOfTheDayPrefetch = () => {
  const queryClient = useQueryClient()
  const resources = useResourceAccess()
  const version = useDefaultBibleVersion()
  const notificationsEnabled = useSelector((state: RootState) =>
    Boolean(state.user.notifications.verseOfTheDay)
  )

  // The idle callback and AppState subscription are external systems whose lifecycle must follow
  // this component: https://react.dev/learn/synchronizing-with-effects#step-3-add-cleanup-if-needed
  useEffect(() => {
    const prefetch = () => {
      for (const addDay of getVerseOfTheDayPrefetchOffsets(notificationsEnabled)) {
        void queryClient.prefetchQuery(createVerseOfTheDayQueryOptions(resources, version, addDay))
      }
    }

    let cancelScheduledTask = scheduleIdleTask(prefetch)
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') {
        cancelScheduledTask()
        cancelScheduledTask = scheduleIdleTask(prefetch)
      }
    })

    return () => {
      cancelScheduledTask()
      subscription.remove()
    }
  }, [notificationsEnabled, queryClient, resources, version])

  return null
}

export default DeferredVerseOfTheDayPrefetch
