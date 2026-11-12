import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { useDispatch, useSelector } from 'react-redux'
import { useConfirmDialog } from '~common/ConfirmDialog/useConfirmDialog'
import type { OnlinePlan } from '~common/types'
import { useLocalReadingDate } from '~features/daily-reading/useDailyMeditation'
import { resetPlan, startPlan } from '~redux/modules/plan'
import type { RootState } from '~redux/modules/reducer'
import { useFireStorage } from './plan.hooks'
import { getParticipationJourney } from './planSchedule'
import { getJourneyDetail } from './planJourneyLabel'
import { getContinueLabel, useContinuePlan } from './PlanContinuePill'

export type ReadingPlanRowKind = 'active' | 'completed' | 'discover'

/**
 * What a plan shows in the list, whatever its form (a row, a tile, a cover card): its cover,
 * where its reader stands, the label of its button and what the button does.
 */
export const useReadingPlanRow = (plan: OnlinePlan, kind: ReadingPlanRowKind) => {
  const { t, i18n } = useTranslation()
  const router = useRouter()
  const dispatch = useDispatch()
  const confirm = useConfirmDialog()
  const continuePlan = useContinuePlan()
  const today = useLocalReadingDate()
  const image = useFireStorage(plan.image)
  const cached = useSelector((state: RootState) =>
    state.plan.myPlans.find(item => item.id === plan.id)
  )
  const progress = useSelector((state: RootState) =>
    state.plan.ongoingPlans.find(item => item.id === plan.id)
  )
  const readings = cached?.sections.flatMap(section => section.readingSlices) ?? []
  const journey = getParticipationJourney(readings, progress, today)
  const total = readings.length || plan.duration
  const open = () => router.push({ pathname: '/plan', params: { planId: plan.id } })
  const restart = async () => {
    if (
      await confirm({
        title: t('readingPlans.restart'),
        message: t('readingPlans.restartMessage'),
        cancelLabel: t('Annuler'),
        confirmLabel: t('readingPlans.restart'),
      })
    ) {
      dispatch(resetPlan(plan.id))
      dispatch(startPlan({ planId: plan.id, startDate: today }))
      open()
    }
  }
  const pill =
    kind === 'active' && readings.length
      ? getContinueLabel(journey)
      : kind === 'completed' && cached
        ? 'readingPlans.restart'
        : undefined
  const detail =
    kind !== 'discover' && readings.length
      ? getJourneyDetail(journey, t, { startDate: progress?.startDate, language: i18n.language })
      : total
        ? t('readingPlans.duration', { count: total })
        : t('readingPlans.journey')
  return {
    image,
    journey,
    /** Share of the plan's days that are read, from 0 to 1. */
    progress: readings.length ? journey.completed / readings.length : 0,
    hasReadings: readings.length > 0,
    detail,
    pill,
    open,
    onPill: () => (kind === 'completed' ? void restart() : continuePlan(plan.id)),
  }
}
