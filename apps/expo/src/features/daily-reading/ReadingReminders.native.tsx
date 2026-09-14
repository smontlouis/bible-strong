import notifee, { EventType } from '@notifee/react-native'
import { useQueryClient } from '@tanstack/react-query'
import { useRootNavigationState, useRouter } from 'expo-router'
import { useAtom } from 'jotai/react'
import { useEffect, useState } from 'react'
import { AppState, Platform } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useDispatch, useSelector, useStore } from 'react-redux'
import { getCurrentAuthUser } from '~helpers/firebaseAuthRuntime'
import { addPlan, fetchPlan } from '~redux/modules/plan'
import type { RootState } from '~redux/modules/reducer'
import type { AppDispatch } from '~redux/store'
import { buildReadingReminderSchedule } from './readingReminderSchedule'
import { readingReminderQueue } from './readingReminderDriver.native'
import { getReadingReminderInbox } from './readingReminderInbox.native'
import { readingReminderStateAtom } from './readingReminderState'
import { useLocalReadingDate } from './useDailyMeditation'

const ReadingReminders = () => {
  const sourceId = useSelector((state: RootState) => state.user.bible.settings.dailyMeditationId)
  const time = useSelector((state: RootState) => state.user.notifications.verseOfTheDay)
  const plans = useSelector((state: RootState) => state.plan.myPlans)
  const ongoing = useSelector((state: RootState) => state.plan.ongoingPlans)
  const userId = useSelector((state: RootState) => state.user.id)
  const [runtime, setRuntime] = useAtom(readingReminderStateAtom)
  const [activation, setActivation] = useState(0)
  const today = useLocalReadingDate()
  const timezoneOffset = new Date().getTimezoneOffset()
  const router = useRouter()
  const navigation = useRootNavigationState()
  const store = useStore<RootState>()
  const dispatch = useDispatch<AppDispatch>()
  const queryClient = useQueryClient()
  const { t } = useTranslation()

  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') setActivation(value => value + 1)
    })
    return () => subscription.remove()
  }, [])

  useEffect(() => {
    const owner = getCurrentAuthUser()?.uid ?? ''
    if (owner !== userId) return
    let active = true
    const needed = new Set([
      ...(sourceId && time ? [sourceId] : []),
      ...ongoing.filter(plan => plan.startDate && plan.reminderTime).map(plan => plan.id),
    ])
    for (const id of needed) {
      if (plans.some(plan => plan.id === id)) continue
      void queryClient
        .fetchQuery({
          queryKey: ['reading-content', id],
          queryFn: () => dispatch(fetchPlan({ id, enroll: false })).unwrap(),
          staleTime: Infinity,
          retry: 1,
        })
        .then(plan => {
          if (
            active &&
            owner === (getCurrentAuthUser()?.uid ?? '') &&
            owner === store.getState().user.id
          )
            dispatch(addPlan(plan))
        })
        .catch(() => {
          if (active) setRuntime(current => ({ ...current, phase: 'error' }))
        })
    }
    return () => {
      active = false
    }
  }, [
    sourceId,
    time,
    ongoing,
    plans,
    userId,
    activation,
    runtime.retry,
    queryClient,
    dispatch,
    store,
    setRuntime,
  ])

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

  useEffect(() => {
    let active = true
    const owner = getCurrentAuthUser()?.uid ?? ''
    const desired =
      owner === userId
        ? buildReadingReminderSchedule({ sourceId, time, plans, ongoing, owner })
        : []
    setRuntime(current => ({ ...current, phase: 'busy' }))
    void readingReminderQueue
      .reconcile(
        desired.map(reminder => ({
          ...reminder,
          title: reminder.title ?? t('dailyReading.title'),
          body: t('dailyReading.reminderBody'),
        })),
        owner
      )
      .then(result => {
        if (!active || result.phase === 'superseded') return
        const phase = result.phase
        setRuntime(current => ({
          ...current,
          phase,
          permission: result.permission ?? current.permission,
          through: result.through,
        }))
      })
      .catch(() => {
        if (active) setRuntime(current => ({ ...current, phase: 'error', through: {} }))
      })
    return () => {
      active = false
      readingReminderQueue.invalidate()
    }
  }, [
    sourceId,
    time,
    plans,
    ongoing,
    today,
    timezoneOffset,
    userId,
    activation,
    runtime.retry,
    t,
    setRuntime,
  ])
  return null
}
export default ReadingReminders
