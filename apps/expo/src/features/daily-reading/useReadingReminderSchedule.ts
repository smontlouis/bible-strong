import { useQueryClient } from '@tanstack/react-query'
import { useAtom } from 'jotai/react'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch, useSelector, useStore } from 'react-redux'
import { getCurrentAuthUser } from '~helpers/firebaseAuthRuntime'
import { addPlan, fetchPlan } from '~redux/modules/plan'
import type { RootState } from '~redux/modules/reducer'
import type { AppDispatch } from '~redux/store'
import type { createReadingReminderQueue } from './readingReminderReconciler'
import { buildReadingReminderSchedule } from './readingReminderSchedule'
import { readingReminderStateAtom } from './readingReminderState'
import { useLocalReadingDate } from './useDailyMeditation'

/**
 * Keeps the reminders the system holds in step with the reader's daily reading and plans: loads
 * the readings they need, then reconciles the next weeks through the platform's queue (Notifee on
 * iOS and Android, the shell on the desktop app). `activation` counts the app's returns to the
 * front, which may bring a new day or a new time zone.
 */
export const useReadingReminderSchedule = (
  readingReminderQueue: ReturnType<typeof createReadingReminderQueue>,
  activation: number
) => {
  const sourceId = useSelector((state: RootState) => state.user.bible.settings.dailyMeditationId)
  const time = useSelector((state: RootState) => state.user.notifications.verseOfTheDay)
  const plans = useSelector((state: RootState) => state.plan.myPlans)
  const ongoing = useSelector((state: RootState) => state.plan.ongoingPlans)
  const userId = useSelector((state: RootState) => state.user.id)
  const [runtime, setRuntime] = useAtom(readingReminderStateAtom)
  const today = useLocalReadingDate()
  const timezoneOffset = new Date().getTimezoneOffset()
  const store = useStore<RootState>()
  const dispatch = useDispatch<AppDispatch>()
  const queryClient = useQueryClient()
  const { t } = useTranslation()

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
    // The queue is one per platform, for the life of the app.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
}
