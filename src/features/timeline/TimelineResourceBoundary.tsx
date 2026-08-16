import { createContext, useContext, type ReactNode } from 'react'
import { useAtomValue } from 'jotai/react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import Loading from '~common/Loading'
import Box from '~common/ui/Box'
import OfflineResourceRecovery from '~features/resources/OfflineResourceRecovery'
import { useResourceAccess } from '~features/resources/resourceAccess'
import { databases } from '~helpers/databases'
import { resourceQueryKeys } from '~helpers/resourceQueryKeys'
import { downloadCompletionSignalAtom } from '~state/downloadQueue'
import { resourcesLanguageAtom } from '~state/resourcesLanguage'
import type { TimelineEventDetail } from './types'

const TimelineDetailsContext = createContext<TimelineEventDetail[]>([])

export const useTimelineDetails = () => useContext(TimelineDetailsContext)

const TimelineResourceBoundary = ({ children }: { children: ReactNode }) => {
  const { t } = useTranslation()
  const resources = useResourceAccess()
  const language = useAtomValue(resourcesLanguageAtom).TIMELINE
  const downloadCompletionSignal = useAtomValue(downloadCompletionSignalAtom)
  const query = useQuery({
    queryKey: [...resourceQueryKeys.timeline(language), downloadCompletionSignal],
    queryFn: () => resources.timeline.loadDetails(language),
    networkMode: 'always',
  })

  if (query.isPending) {
    return (
      <Box flex center>
        <Loading message={t('Chargement...')} />
      </Box>
    )
  }

  if (!query.data || query.data.status === 'unavailable') {
    return (
      <Box flex center>
        <OfflineResourceRecovery
          identity={{ kind: 'database', databaseId: 'TIMELINE', language }}
          title={t('resource.timeline.offlineCopyNeeded')}
          fileSize={Math.round(databases(language).TIMELINE.fileSize / 1_000_000)}
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
