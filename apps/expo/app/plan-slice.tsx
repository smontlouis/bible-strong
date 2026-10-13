import { Redirect, useLocalSearchParams } from 'expo-router'
import { useReadingContent } from '~features/daily-reading/useDailyMeditation'
import { getEditorialKind } from '~features/plans/readingCalendar'
import { getLegacyReadingRouteLocation } from '~features/plans/planTabState'

/** A plan day has no page of its own any more: its link opens the plan on that day. */
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
  return (
    <Redirect
      href={{
        pathname: '/plan',
        params: { planId: id, ...(readingId ? { readingSliceId: readingId } : {}) },
      }}
    />
  )
}
