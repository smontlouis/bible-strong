import { Redirect, useLocalSearchParams } from 'expo-router'
import PlanScreen from '~features/plans/PlanScreen/PlanScreen'
import { useReadingContent } from '~features/daily-reading/useDailyMeditation'
import { getEditorialKind } from '~features/plans/readingCalendar'
import { getLegacyPlanRouteId } from '~features/plans/planTabState'
export default function PlanRoute() {
  const params = useLocalSearchParams<{ planId?: string; plan?: string }>()
  const id = params.planId ?? getLegacyPlanRouteId(params.plan) ?? ''
  const { collection } = useReadingContent(id)
  if (collection && getEditorialKind(collection) === 'daily-meditation')
    return <Redirect href={{ pathname: '/meditation-collection', params: { collectionId: id } }} />
  return <PlanScreen planId={id} />
}
