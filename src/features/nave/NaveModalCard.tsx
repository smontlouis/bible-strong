import { useTheme } from '@emotion/react'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator } from 'react-native'
import { useAtomValue } from 'jotai'
import Empty from '~common/Empty'
import Box from '~common/ui/Box'
import { useResourceAccess } from '~features/resources/resourceAccess'
import { useQuery } from '@tanstack/react-query'
import { resourcesLanguageAtom } from 'src/state/resourcesLanguage'
import NaveForVerse from './NaveModalForVerse'
import { SheetScrollView } from '~common/sheet'
import OfflineResourceRecovery from '~features/resources/OfflineResourceRecovery'
import { resourceQueryKeys } from '~helpers/resourceQueryKeys'
import { ResourceAccessError } from '~features/resources/resourceAccessError'

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

  const { isLoading, error, data } = useQuery({
    queryKey: ['nave', selectedVerse, resourceLang],
    queryFn: () => resources.nave.loadByVerse(selectedVerse),
  })

  if (
    (availabilityQuery.data?.status === 'unavailable' &&
      availabilityQuery.data.recoveries.includes('acquire-offline-copy')) ||
    (error instanceof ResourceAccessError && error.recoveries.includes('acquire-offline-copy'))
  ) {
    return (
      <OfflineResourceRecovery
        identity={{ kind: 'database', databaseId: 'NAVE', language: resourceLang }}
        title={t('resource.nave.offlineCopyNeeded')}
        fileSize={7}
        size="small"
      />
    )
  }

  if (error) {
    return (
      <Empty
        source={require('~assets/images/empty.json')}
        message={t('Une erreur est survenue...')}
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

  return (
    <SheetScrollView>
      <Box padding={20}>
        {(!!naveItemsForChapter || !!naveItemsForVerse) && (
          <>
            <NaveForVerse items={naveItemsForVerse} label={t('Concernant le verset')} />
            <NaveForVerse items={naveItemsForChapter} label={t('Concernant le chapitre entier')} />
          </>
        )}
      </Box>
    </SheetScrollView>
  )
}

export default NaveModalCard
