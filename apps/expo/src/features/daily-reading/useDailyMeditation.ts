import { useConnectionStatus } from '~helpers/useConnection'
import { resolveMeditationOpening } from './meditationPassage'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { AppState } from 'react-native'
import { useDispatch, useSelector } from 'react-redux'
import { fetchPlan } from '~redux/modules/plan'
import type { RootState } from '~redux/modules/reducer'
import type { AppDispatch } from '~redux/store'
import {
  findMeditationForDate,
  normalizeMeditationCollection,
  toCivilDate,
} from '~features/plans/readingCalendar'

export const useLocalReadingDate = (offset = 0) => {
  const [clock, setClock] = useState(() => ({
    date: toCivilDate(new Date()),
    offset: new Date().getTimezoneOffset(),
  }))
  const today = clock.date
  useEffect(() => {
    const update = () => {
      const date = toCivilDate(new Date())
      const offset = new Date().getTimezoneOffset()
      setClock(current =>
        current.date === date && current.offset === offset ? current : { date, offset }
      )
    }
    const timer = setInterval(update, 30_000)
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') update()
    })
    return () => {
      clearInterval(timer)
      subscription.remove()
    }
  }, [])
  const [year, month, day] = today.split('-').map(Number)
  return toCivilDate(new Date(year, month - 1, day + offset, 12))
}

export const useReadingContent = (collectionId: string) => {
  const dispatch = useDispatch<AppDispatch>()
  const connection = useConnectionStatus()
  const storedCollection = useSelector((state: RootState) =>
    state.plan.myPlans.find(plan => plan.id === collectionId)
  )
  const hasLocalContent = Boolean(storedCollection?.sections.length)
  const query = useQuery({
    queryKey: ['reading-content', collectionId],
    queryFn: () => dispatch(fetchPlan({ id: collectionId, enroll: false })).unwrap(),
    enabled: !hasLocalContent && Boolean(collectionId) && connection !== 'offline',
    networkMode: 'online',
    // Redux content can be removed independently of the query cache.
    // Re-enabling the query must fetch and repopulate Redux.
    staleTime: 0,
    retry: 1,
  })
  const collection =
    storedCollection && (hasLocalContent || (query.isSuccess && connection !== 'offline'))
      ? storedCollection
      : undefined
  const isOffline = !collection && connection === 'offline'
  return {
    isOffline,
    collection: collection ? normalizeMeditationCollection(collection) : undefined,
    isError:
      !collection &&
      (!collectionId || isOffline || query.isError || query.fetchStatus === 'paused'),
    retry: query.refetch,
  }
}

export const useDailyMeditation = (collectionId: string, date: string) => {
  const { collection, isError, isOffline, retry } = useReadingContent(collectionId)
  const lookup = collection ? findMeditationForDate(collection, date) : undefined
  const reading = lookup?.status === 'available' ? lookup.reading : undefined
  const opening =
    reading && collection ? resolveMeditationOpening(reading, collection.lang) : undefined
  return { collection, reading, opening, lookup, isError, isOffline, retry }
}
