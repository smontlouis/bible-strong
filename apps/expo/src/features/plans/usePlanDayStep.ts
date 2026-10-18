import { type HrefObject, useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { useDispatch } from 'react-redux'
import { goBackOrHome } from '~navigation/goBackOrHome'
import { markAsRead, markEntitySliceAsRead } from '~redux/modules/plan'
import { getEntitySliceTitle } from './entitySliceTitle'
import { useComputedPlan } from './plan.hooks'
import { getPlanEntityRoute } from './planEntityRoute'
import { getPlanDayStep } from './planProgress'

export type PlanEntityLocation = { planId: string; readingSliceId: string; entitySliceId: string }

export type PlanDayStepAction =
  | { kind: 'next'; title: string; onPress: () => void }
  | { kind: 'finish'; onPress: () => void }

/**
 * Leads a reader through the elements of a day without going back to the plan: the next one
 * replaces the current page, so that going back always lands on the plan. Opening an element
 * reads it, as from the plan; finishing the day marks it read, and the plan celebrates it
 * once it is in view again.
 */
export const usePlanDayStep = (location?: PlanEntityLocation): PlanDayStepAction | undefined => {
  const { t } = useTranslation()
  const router = useRouter()
  const dispatch = useDispatch()
  const plan = useComputedPlan(location?.planId ?? '')
  if (!location || !plan) return undefined

  const reading = plan.sections
    .flatMap(section => section.data)
    .find(item => item.id === location.readingSliceId)
  const step = reading && getPlanDayStep(reading, location.entitySliceId)
  if (!reading || !step) return undefined

  if (step.kind === 'finish')
    return {
      kind: 'finish',
      onPress: () => {
        if (reading.status !== 'Completed')
          dispatch(markAsRead({ planId: plan.id, readingSliceId: reading.id }))
        goBackOrHome(router)
      },
    }

  const next = { ...location, entitySliceId: step.entitySliceId }
  const route = getPlanEntityRoute({ ...next, slice: step.slice })
  if (!route) return undefined
  return {
    kind: 'next',
    title: getEntitySliceTitle(step.slice, t),
    onPress: () => {
      dispatch(markEntitySliceAsRead(next))
      router.replace(route as HrefObject)
    },
  }
}
