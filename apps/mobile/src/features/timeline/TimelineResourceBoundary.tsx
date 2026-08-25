import { createContext, useContext, type ReactNode } from 'react'
import { useAtomValue } from 'jotai/react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import Loading from '~common/Loading'
import Header from '~common/Header'
import Box from '~common/ui/Box'
import ResourceUnavailableView from '~features/resources/ResourceUnavailableView'
import { useResourceAccess } from '~features/resources/resourceAccess'
import { databases } from '~helpers/databases'
import { resourceQueryKeys } from '~helpers/resourceQueryKeys'
import { downloadCompletionSignalAtom } from '~state/downloadQueue'
import { resourcesLanguageAtom } from '~state/resourcesLanguage'
import type { TimelineEventSummary } from '~features/resources/timelineAccess'
import {
  resourceFailureFromAccessError,
  resourceFailureFromAvailability,
} from '~features/resources/resourceFailure'

const TimelineDetailsContext = createContext<TimelineEventSummary[]>([])

export const useTimelineDetails = () => useContext(TimelineDetailsContext)

const TimelineResourceBoundary = ({
  children,
  hasBackButton,
  onBackPress,
}: {
  children: ReactNode
  hasBackButton?: boolean
  onBackPress?: () => void
}) => {
  const { t } = useTranslation()
  const resources = useResourceAccess()
  const language = useAtomValue(resourcesLanguageAtom).TIMELINE
  const downloadCompletionSignal = useAtomValue(downloadCompletionSignalAtom)
  const query = useQuery({
    queryKey: [...resourceQueryKeys.timeline(language), downloadCompletionSignal],
    queryFn: () => resources.timeline.loadIndex(language),
    networkMode: 'always',
  })

  if (query.isPending) {
    return (
      <Box flex center>
        <Loading message={t('Chargement...')} />
      </Box>
    )
  }

  if (query.isError || !query.data || query.data.status === 'unavailable') {
    const reason =
      query.data?.status === 'unavailable' ? query.data.reason : 'temporary-unavailable'
    return (
      <Box flex bg="reverse">
        <Header
          hasBackButton={hasBackButton}
          title={t('La Chronologie biblique')}
          onCustomBackPress={onBackPress}
        />
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
