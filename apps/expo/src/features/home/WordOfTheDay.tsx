import ResourceDiscoveryEntry from './ResourceDiscoveryEntry'
import { useQuery } from '@tanstack/react-query'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { useResourceAccess } from '~features/resources/resourceAccess'
import useLanguage from '~helpers/useLanguage'
import { WidgetContainer, WidgetLoading } from './widget'
import { localQueryOptions } from '~helpers/queryOptions'
import { resourceQueryKeys } from '~helpers/resourceQueryKeys'
import useConnection from '~helpers/useConnection'
import ResourceUnavailableView from '~features/resources/ResourceUnavailableView'
import {
  resourceFailureFromAccessError,
  resourceFailureFromAvailability,
} from '~features/resources/resourceFailure'
import ResourceDownloadWidget from './ResourceDownloadWidget'
import { loadDictionaryWidgetEntry, selectDictionaryWidgetWork } from './dictionaryWidgetEntry'
import { KNOWN_DICTIONARY_WORKS } from '~features/resources/dictionaryAccess'
import {
  useOfflineResourceRegistry,
  getOfflineResourceQuerySignal,
} from '~features/resources/useOfflineResourceRegistry'
const DictionnaireOfTheDay = () => {
  const { t } = useTranslation()
  const resources = useResourceAccess()
  const lang = useLanguage()
  const isConnected = useConnection()
  const registry = useOfflineResourceRegistry()
  const dictionary = selectDictionaryWidgetWork(lang, KNOWN_DICTIONARY_WORKS, registry)
  const work = dictionary.resource.work
  const resourceTitle = dictionary.title
  const resourceIdentity = {
    kind: 'dictionary' as const,
    work,
    resourceId: dictionary.resourceId,
    language: lang,
  }
  const resourceSignal = getOfflineResourceQuerySignal(registry, resourceIdentity)
  const availabilityQuery = useQuery({
    queryKey: [
      ...resourceQueryKeys.offlineDatabaseAvailability('DICTIONNAIRE', lang),
      work,
      resourceSignal,
      isConnected,
    ],
    queryFn: () =>
      resources.dictionary.getAvailability?.(lang, work) ??
      Promise.resolve({ status: 'available' as const }),
    networkMode: 'always',
    staleTime: Infinity,
  })
  const strongQuery = useQuery({
    queryKey: ['home-dictionary-random', lang, work, resourceSignal, isConnected],
    queryFn: () => loadDictionaryWidgetEntry(resources.dictionary, lang, work),
    ...localQueryOptions,
    // A remount (the home switching layout as its width changes) keeps the draw; the shuffle
    // button draws again by refetching.
    staleTime: Infinity,
  })
  const strongReference = strongQuery.data

  if (
    availabilityQuery.data?.status === 'unavailable' &&
    availabilityQuery.data.reason === 'offline-copy-required'
  ) {
    return (
      <ResourceDownloadWidget
        identity={resourceIdentity}
        title={resourceTitle}
        fileSize={22}
        onRetry={() => {
          void availabilityQuery.refetch()
          void strongQuery.refetch()
        }}
      />
    )
  }

  if (availabilityQuery.data?.status === 'unavailable') {
    return (
      <WidgetContainer>
        <ResourceUnavailableView
          identity={resourceIdentity}
          title={resourceTitle}
          fileSize={22}
          failure={resourceFailureFromAvailability(availabilityQuery.data)}
          size="small"
          onRetry={() => {
            void availabilityQuery.refetch()
            void strongQuery.refetch()
          }}
        />
      </WidgetContainer>
    )
  }

  if (
    availabilityQuery.isError ||
    strongQuery.isError ||
    (strongQuery.isSuccess && !strongReference)
  ) {
    return (
      <WidgetContainer>
        <ResourceUnavailableView
          identity={resourceIdentity}
          title={resourceTitle}
          fileSize={22}
          failure={
            availabilityQuery.isError || strongQuery.isError
              ? resourceFailureFromAccessError(strongQuery.error ?? availabilityQuery.error)
              : { cause: 'not-found', recoveries: [] }
          }
          size="small"
          onRetry={() => {
            void availabilityQuery.refetch()
            void strongQuery.refetch()
          }}
        />
      </WidgetContainer>
    )
  }

  if (strongQuery.isPending || !strongReference) {
    return <WidgetLoading />
  }

  const { word } = strongReference

  return (
    <ResourceDiscoveryEntry
      category={t('tabs.dictionary')}
      title={word}
      detail={{
        route: 'DictionnaryDetail',
        params: {
          word,
          entryId: String(strongReference.id),
          work,
          resourceId: dictionary.resourceId,
          dictionaryTitle: dictionary.title,
          language: lang,
        },
      }}
      isRefreshing={strongQuery.isFetching}
      onShuffle={() => void strongQuery.refetch()}
    />
  )
}

export default DictionnaireOfTheDay
