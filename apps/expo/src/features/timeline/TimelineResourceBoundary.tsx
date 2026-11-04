import { createContext, useContext, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import Loading from '~common/Loading'
import Box from '~common/ui/Box'
import ResourceUnavailableView from '~features/resources/ResourceUnavailableView'
import { useResourceAccess } from '~features/resources/resourceAccess'
import { databases } from '~helpers/databases'
import type { ResourceLanguage } from '~helpers/databaseTypes'
import { resourceQueryKeys } from '~helpers/resourceQueryKeys'
import {
  getOfflineResourceQuerySignal,
  useOfflineResourceRegistry,
} from '~features/resources/useOfflineResourceRegistry'
import type { TimelineEventSummary } from '~features/resources/timelineAccess'
import {
  resourceFailureFromAccessError,
  resourceFailureFromAvailability,
} from '~features/resources/resourceFailure'
const TimelineDetailsContext = createContext<TimelineEventSummary[]>([])

export const useTimelineDetails = () => useContext(TimelineDetailsContext)

/** The query of the events of the Timeline publication in one language. */
export const useTimelineIndexQuery = (language: ResourceLanguage) => {
  const resources = useResourceAccess()
  const resourceRegistry = useOfflineResourceRegistry()
  return useQuery({
    queryKey: [
      ...resourceQueryKeys.timeline(language),
      getOfflineResourceQuerySignal(resourceRegistry, {
        kind: 'database',
        databaseId: 'TIMELINE',
        language,
      }),
    ],
    queryFn: () => resources.timeline.loadIndex(language),
    networkMode: 'always',
  })
}

/** Draws its children once the events of the publication are there, or says why they are not. */
const TimelineResourceBoundary = ({
  children,
  language,
}: {
  children: ReactNode
  language: ResourceLanguage
}) => {
  const { t } = useTranslation()
  const query = useTimelineIndexQuery(language)

  if (query.isPending) {
    return (
      <Box className="overflow-hidden border-continuous flex-[1] items-center justify-center">
        <Loading message={t('Chargement...')} />
      </Box>
    )
  }

  if (query.isError || !query.data || query.data.status === 'unavailable') {
    return (
      <Box className="overflow-hidden border-continuous flex-[1] bg-reverse">
        <ResourceUnavailableView
          identity={{ kind: 'database', databaseId: 'TIMELINE', language }}
          title={t('La Chronologie biblique')}
          fileSize={Math.round(databases(language).TIMELINE.fileSize / 1_000_000)}
          failure={
            query.data?.status === 'unavailable'
              ? resourceFailureFromAvailability(query.data)
              : resourceFailureFromAccessError(query.error)
          }
          onRetry={() => void query.refetch()}
        />
      </Box>
    )
  }

  return (
    <TimelineDetailsContext.Provider value={query.data.details}>
      {children}
    </TimelineDetailsContext.Provider>
  )
}

export default TimelineResourceBoundary
