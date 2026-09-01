import { useTheme } from '@emotion/react'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator } from 'react-native'
import { useAtomValue } from 'jotai'
import Box from '~common/ui/Box'
import { useResourceAccess } from '~features/resources/resourceAccess'
import { useQuery } from '@tanstack/react-query'
import { resourcesLanguageAtom } from 'src/state/resourcesLanguage'
import NaveForVerse from './NaveModalForVerse'
import { SheetScrollView } from '~common/sheet'
import { resourceQueryKeys } from '~helpers/resourceQueryKeys'
import ResourceUnavailableView from '~features/resources/ResourceUnavailableView'
import {
  resourceFailureFromAccessError,
  resourceFailureFromAvailability,
} from '~features/resources/resourceFailure'
import Empty from '~common/Empty'
import useConnection from '~helpers/useConnection'
import ResourceVerseContext, {
  useResourceVerseContext,
} from '~features/bible/resources/ResourceVerseContext'

type Props = {
  selectedVerse: string
  selectedVersion: string
  updateVerse: (direction: number) => void
}

const NaveModalCard = ({ selectedVerse, selectedVersion, updateVerse }: Props) => {
  const { t } = useTranslation()
  const theme = useTheme()
  const resources = useResourceAccess()
  const isConnected = useConnection()

  // Get resource language from Jotai for cache key invalidation
  const resourcesLanguage = useAtomValue(resourcesLanguageAtom)
  const resourceLang = resourcesLanguage.NAVE
  const verseContext = useResourceVerseContext(selectedVerse, selectedVersion)
  const [navigationDirection, setNavigationDirection] = React.useState<-1 | 1>(1)
  const navigateVerse = (direction: -1 | 1) => {
    setNavigationDirection(direction)
    updateVerse(direction)
  }
  const availabilityQuery = useQuery({
    queryKey: [...resourceQueryKeys.offlineDatabaseAvailability('NAVE', resourceLang), isConnected],
    queryFn: () =>
      resources.nave.getAvailability?.(resourceLang) ??
      Promise.resolve({ status: 'available' as const }),
    networkMode: 'always',
    staleTime: Infinity,
  })

  const naveQuery = useQuery({
    queryKey: ['nave', selectedVerse, resourceLang, isConnected],
    queryFn: () => resources.nave.loadByVerse(selectedVerse, resourceLang),
  })
  const { isLoading, error, data } = naveQuery

  const content =
    availabilityQuery.data?.status === 'unavailable' ? (
      <ResourceUnavailableView
        identity={{ kind: 'database', databaseId: 'NAVE', language: resourceLang }}
        title={t('resource.nave.offlineCopyNeeded')}
        offlineTitle={t('resource.nave.temporarilyUnavailable')}
        fileSize={7}
        size="small"
        mt={100}
        failure={resourceFailureFromAvailability(availabilityQuery.data)}
        onRetry={() => {
          void availabilityQuery.refetch()
          void naveQuery.refetch()
        }}
      />
    ) : availabilityQuery.isError || error ? (
      <ResourceUnavailableView
        identity={{ kind: 'database', databaseId: 'NAVE', language: resourceLang }}
        title={t('resource.nave.temporarilyUnavailable')}
        fileSize={7}
        failure={resourceFailureFromAccessError(error ?? availabilityQuery.error)}
        size="small"
        mt={100}
        onRetry={() => {
          void availabilityQuery.refetch()
          void naveQuery.refetch()
        }}
      />
    ) : isLoading ? (
      <Box flex center height={150}>
        <ActivityIndicator color={theme.colors.grey} />
      </Box>
    ) : null

  if (!selectedVerse) {
    return null
  }

  const [naveItemsForVerse, naveItemsForChapter] = data || []
  const hasTopics = Boolean(naveItemsForVerse?.length || naveItemsForChapter?.length)

  return (
    <Box flex={1} bg="lightGrey">
      <ResourceVerseContext
        verse={selectedVerse}
        {...verseContext}
        navigationDirection={navigationDirection}
        updateVerse={navigateVerse}
      />
      {content ?? (
        <SheetScrollView>
          <Box px={20} pt={20} pb={32} gap={20}>
            {hasTopics ? (
              <>
                <NaveForVerse items={naveItemsForVerse} label={t('Concernant le verset')} />
                <NaveForVerse
                  items={naveItemsForChapter}
                  label={t('Concernant le chapitre entier')}
                />
              </>
            ) : (
              <Empty
                source={require('~assets/images/empty.json')}
                message={t('resource.nave.noTopicsForVerse')}
              />
            )}
          </Box>
        </SheetScrollView>
      )}
    </Box>
  )
}

export default NaveModalCard
