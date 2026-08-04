import { useQueries } from '@tanstack/react-query'

import {
  compareResourcePublications,
  fetchResourcePublication,
  resourcePublicationStore,
} from './resourcePublication'

const PUBLICATION_STALE_TIME = 6 * 60 * 60 * 1000

export const useResourcePublicationStatus = ({
  resourceId,
  url,
  isInstalled,
  relatedResources = [],
}: {
  resourceId: string
  url: string
  isInstalled: boolean
  relatedResources?: { resourceId: string; url: string }[]
}) => {
  const resources = [{ resourceId, url }, ...relatedResources]
  const queries = useQueries({
    queries: resources.map(resource => ({
      queryKey: ['resource-publication', resource.resourceId, resource.url],
      queryFn: () => fetchResourcePublication(resource.url),
      enabled: isInstalled,
      staleTime: PUBLICATION_STALE_TIME,
      refetchOnMount: 'always' as const,
      retry: 1,
    })),
  })

  return {
    status:
      isInstalled &&
      queries.some(
        (query, index) =>
          query.data &&
          compareResourcePublications(
            resourcePublicationStore.read(resources[index].resourceId),
            query.data
          ) === 'update-available'
      )
        ? ('update-available' as const)
        : isInstalled && queries.every(query => query.data)
          ? ('current' as const)
          : undefined,
  }
}
