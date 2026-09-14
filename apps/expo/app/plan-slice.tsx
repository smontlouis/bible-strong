import { Redirect, useLocalSearchParams } from 'expo-router'
import PlanSliceScreen from '~features/plans/PlanSliceScreen/PlanSliceScreen'
import { useReadingContent } from '~features/daily-reading/useDailyMeditation'
import { getEditorialKind } from '~features/plans/readingCalendar'
import { getLegacyReadingRouteLocation } from '~features/plans/planTabState'
export default function PlanSliceRoute() {
  const params = useLocalSearchParams<{
    planId?: string
    readingSliceId?: string
    readingSlice?: string
  }>()
  const legacy = getLegacyReadingRouteLocation(params.readingSlice)
  const id = params.planId ?? legacy?.planId ?? ''
  const readingId = params.readingSliceId ?? legacy?.readingSliceId
  const { collection } = useReadingContent(id)
  if (collection && getEditorialKind(collection) === 'daily-meditation')
    return (
      <Redirect
        href={{
          pathname: '/meditation',
          params: { collectionId: id, ...(readingId ? { readingId } : {}) },
        }}
      />
    )
  return <PlanSliceScreen />
}
