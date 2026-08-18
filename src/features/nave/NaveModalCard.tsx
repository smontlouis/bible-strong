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

type Props = {
  selectedVerse: string
}

const NaveModalCard = ({ selectedVerse }: Props) => {
  const { t } = useTranslation()
  const theme = useTheme()
  const resources = useResourceAccess()

  // Get resource language from Jotai for cache key invalidation
  const resourcesLanguage = useAtomValue(resourcesLanguageAtom)
  const resourceLang = resourcesLanguage.NAVE
  const availabilityQuery = useQuery({
    queryKey: resourceQueryKeys.offlineDatabaseAvailability('NAVE', resourceLang),
    queryFn: () =>
      resources.nave.getAvailability?.(resourceLang) ??
      Promise.resolve({ status: 'available' as const }),
    networkMode: 'always',
    staleTime: Infinity,
  })

  const naveQuery = useQuery({
    queryKey: ['nave', selectedVerse, resourceLang],
    queryFn: () => resources.nave.loadByVerse(selectedVerse, resourceLang),
  })
  const { isLoading, error, data } = naveQuery

  if (availabilityQuery.data?.status === 'unavailable') {
    return (
      <ResourceUnavailableView
        identity={{ kind: 'database', databaseId: 'NAVE', language: resourceLang }}
        title={t('resource.nave.offlineCopyNeeded')}
        fileSize={7}
        size="small"
        failure={resourceFailureFromAvailability(availabilityQuery.data)}
      />
    )
  }

  if (availabilityQuery.isError || error) {
    return (
      <ResourceUnavailableView
        identity={{ kind: 'database', databaseId: 'NAVE', language: resourceLang }}
        title={t('resource.nave.temporarilyUnavailable')}
        fileSize={7}
        failure={resourceFailureFromAccessError(error ?? availabilityQuery.error)}
        size="small"
        onRetry={() => {
          void availabilityQuery.refetch()
          void naveQuery.refetch()
        }}
      />
    )
  }

  if (isLoading) {
    return (
      <Box flex center height={150}>
        <ActivityIndicator color={theme.colors.grey} />
      </Box>
    )
  }

  if (!selectedVerse) {
    return null
  }

  const [naveItemsForVerse, naveItemsForChapter] = data || []
  const hasTopics = Boolean(naveItemsForVerse?.length || naveItemsForChapter?.length)

  return (
    <SheetScrollView>
      <Box padding={20}>
        {hasTopics ? (
          <>
            <NaveForVerse items={naveItemsForVerse} label={t('Concernant le verset')} />
            <NaveForVerse items={naveItemsForChapter} label={t('Concernant le chapitre entier')} />
          </>
        ) : (
          <Empty
            source={require('~assets/images/empty.json')}
            message={t('resource.nave.noTopicsForVerse')}
          />
        )}
      </Box>
    </SheetScrollView>
  )
}

export default NaveModalCard
