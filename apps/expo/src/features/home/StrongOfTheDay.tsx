import { getSimpleStrongModuleId } from '@bible-strong/resource-domain/strong-lexicon'
import { getPrimaryStrongLexiconAvailability } from '~features/resources/layeredStrongLexiconAccess'
import ResourceDiscoveryEntry from './ResourceDiscoveryEntry'
import { useQuery } from '@tanstack/react-query'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { WidgetContainer, WidgetLoading } from './widget'
import { useResourceAccess } from '~features/resources/resourceAccess'
import type { StrongLexiconSearchResult } from '~features/resources/strongLexiconAccess'
import { localQueryOptions } from '~helpers/queryOptions'
import { useAtomValue } from 'jotai/react'
import { resourcesLanguageAtom } from '~state/resourcesLanguage'
import { resourceQueryKeys } from '~helpers/resourceQueryKeys'
import useConnection from '~helpers/useConnection'
import ResourceUnavailableView from '~features/resources/ResourceUnavailableView'
import {
  resourceFailureFromAccessError,
  resourceFailureFromStrongModuleAvailability,
} from '~features/resources/resourceFailure'
import ResourceDownloadWidget from './ResourceDownloadWidget'
type StrongOfTheDayProps = {
  type: 'grec' | 'hebreu'
}

const StrongOfTheDay = ({ type }: StrongOfTheDayProps) => {
  const { t } = useTranslation()
  const resources = useResourceAccess()
  const resourceLanguage = useAtomValue(resourcesLanguageAtom).STRONG
  const isConnected = useConnection()
  const resourceTitle = t('Lexique Strong')

  const availabilityQuery = useQuery({
    queryKey: [
      ...resourceQueryKeys.strongLexiconAvailability(getSimpleStrongModuleId(resourceLanguage)),
      isConnected,
    ],
    queryFn: async () => ({
      availability: await getPrimaryStrongLexiconAvailability(
        resources.strongLexicon,
        resourceLanguage
      ),
      recoveries: await resources.strongLexicon.getModuleRecoveryActions?.(
        getSimpleStrongModuleId(resourceLanguage)
      ),
    }),
    networkMode: 'always',
    staleTime: Infinity,
  })
  const strongQuery = useQuery({
    queryKey: ['home-strong-random', type, resourceLanguage, isConnected],
    queryFn: async (): Promise<StrongLexiconSearchResult | null> =>
      (await resources.strongLexicon.random(
        type === 'grec' ? 'greek' : 'hebrew',
        resourceLanguage
      )) ?? null,
    ...localQueryOptions,
    // A remount (the home switching layout as its width changes) keeps the draw; the shuffle
    // button draws again by refetching.
    staleTime: Infinity,
  })
  const strongReference = strongQuery.data
  if (availabilityQuery.isError) {
    return (
      <WidgetContainer>
        <ResourceUnavailableView
          title={resourceTitle}
          failure={resourceFailureFromAccessError(availabilityQuery.error)}
          size="small"
          onRetry={() => void availabilityQuery.refetch()}
        />
      </WidgetContainer>
    )
  }
  if (
    availabilityQuery.data &&
    ['missing', 'core-missing'].includes(availabilityQuery.data.availability.status)
  ) {
    return (
      <ResourceDownloadWidget
        identity={{
          kind: 'strong-lexicon-module',
          moduleId: getSimpleStrongModuleId(resourceLanguage),
        }}
        title={resourceTitle}
        fileSize={35}
        onRetry={() => {
          void availabilityQuery.refetch()
          void strongQuery.refetch()
        }}
      />
    )
  }
  if (availabilityQuery.data && availabilityQuery.data.availability.status !== 'available') {
    return (
      <WidgetContainer>
        <ResourceUnavailableView
          identity={{
            kind: 'strong-lexicon-module',
            moduleId: getSimpleStrongModuleId(resourceLanguage),
          }}
          title={resourceTitle}
          fileSize={35}
          failure={resourceFailureFromStrongModuleAvailability(
            availabilityQuery.data.availability,
            availabilityQuery.data.recoveries
          )}
          size="small"
        />
      </WidgetContainer>
    )
  }
  const error = strongQuery.isError
    ? true
    : strongQuery.isSuccess && !strongReference
      ? 'NOT_FOUND'
      : false

  if (error) {
    return (
      <WidgetContainer>
        <ResourceUnavailableView
          identity={{
            kind: 'strong-lexicon-module',
            moduleId: getSimpleStrongModuleId(resourceLanguage),
          }}
          title={resourceTitle}
          fileSize={35}
          failure={
            error === 'NOT_FOUND'
              ? { cause: 'not-found', recoveries: [] }
              : resourceFailureFromAccessError(strongQuery.error)
          }
          size="small"
          onRetry={() => void strongQuery.refetch()}
        />
      </WidgetContainer>
    )
  }

  if (strongQuery.isPending || !strongReference) {
    return <WidgetLoading />
  }

  const { original, gloss, stepCode, language } = strongReference
  const book = language === 'greek' ? 40 : 1

  return (
    <ResourceDiscoveryEntry
      category={t(type === 'hebreu' ? 'Hébreu' : 'Grec')}
      original={original}
      title={gloss}
      detail={{ route: 'Strong', params: { book, reference: stepCode } }}
      isRefreshing={strongQuery.isFetching}
      onShuffle={() => void strongQuery.refetch()}
    />
  )
}

export default StrongOfTheDay
