import ResourceDiscoveryEntry from './ResourceDiscoveryEntry'
import { useQuery } from '@tanstack/react-query'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { useResourceAccess } from '~features/resources/resourceAccess'
import { WidgetContainer, WidgetLoading } from './widget'
import { localQueryOptions } from '~helpers/queryOptions'
import { useResourceLanguage } from '~state/resourcesLanguage'
import { resourceQueryKeys } from '~helpers/resourceQueryKeys'
import useConnection from '~helpers/useConnection'
import ResourceUnavailableView from '~features/resources/ResourceUnavailableView'
import {
  resourceFailureFromAccessError,
  resourceFailureFromAvailability,
} from '~features/resources/resourceFailure'
import ResourceDownloadWidget from './ResourceDownloadWidget'
const NaveOfTheDay = () => {
  const { t } = useTranslation()
  const resources = useResourceAccess()
  const [resourceLanguage] = useResourceLanguage('NAVE')
  const isConnected = useConnection()
  const resourceTitle = t('Thématique Nave')
  const availabilityQuery = useQuery({
    queryKey: [
      ...resourceQueryKeys.offlineDatabaseAvailability('NAVE', resourceLanguage),
      isConnected,
    ],
    queryFn: () =>
      resources.nave.getAvailability?.(resourceLanguage) ??
      Promise.resolve({ status: 'available' as const }),
    networkMode: 'always',
    staleTime: Infinity,
  })
  const naveQuery = useQuery({
    queryKey: ['home-nave-random', resourceLanguage, isConnected],
    queryFn: async () => (await resources.nave.loadRandom(resourceLanguage)) ?? null,
    ...localQueryOptions,
    // A remount (the home switching layout as its width changes) keeps the draw; the shuffle
    // button draws again by refetching.
    staleTime: Infinity,
  })
  const naveReference = naveQuery.data

  if (
    availabilityQuery.data?.status === 'unavailable' &&
    availabilityQuery.data.reason === 'offline-copy-required'
  ) {
    return (
      <ResourceDownloadWidget
        identity={{ kind: 'database', databaseId: 'NAVE', language: resourceLanguage }}
        title={resourceTitle}
        fileSize={7}
        onRetry={() => {
          void availabilityQuery.refetch()
          void naveQuery.refetch()
        }}
      />
    )
  }

  if (availabilityQuery.data?.status === 'unavailable') {
    return (
      <WidgetContainer>
        <ResourceUnavailableView
          identity={{ kind: 'database', databaseId: 'NAVE', language: resourceLanguage }}
          title={resourceTitle}
          fileSize={7}
          failure={resourceFailureFromAvailability(availabilityQuery.data)}
          size="small"
          onRetry={() => {
            void availabilityQuery.refetch()
            void naveQuery.refetch()
          }}
        />
      </WidgetContainer>
    )
  }

  if (availabilityQuery.isError || naveQuery.isError || (naveQuery.isSuccess && !naveReference)) {
    return (
      <WidgetContainer>
        <ResourceUnavailableView
          identity={{ kind: 'database', databaseId: 'NAVE', language: resourceLanguage }}
          title={resourceTitle}
          fileSize={7}
          failure={
            availabilityQuery.isError || naveQuery.isError
              ? resourceFailureFromAccessError(naveQuery.error ?? availabilityQuery.error)
              : { cause: 'not-found', recoveries: [] }
          }
          size="small"
          onRetry={() => {
            void availabilityQuery.refetch()
            void naveQuery.refetch()
          }}
        />
      </WidgetContainer>
    )
  }

  if (naveQuery.isPending || !naveReference) {
    return <WidgetLoading />
  }

  const { name, normalizedName } = naveReference

  return (
    <ResourceDiscoveryEntry
      category={t('tabs.nave')}
      title={name}
      detail={{ route: 'NaveDetail', params: { name, name_lower: normalizedName } }}
      isRefreshing={naveQuery.isFetching}
      onShuffle={() => void naveQuery.refetch()}
    />
  )
}

export default NaveOfTheDay
