import { useQueries } from '@tanstack/react-query'
import { useAtomValue } from 'jotai/react'

import { mobileResourceCatalogAtom } from './mobileResourceCatalog'
import { resolveResourceCatalogStatus } from './resourcePublication'

const PUBLICATION_STALE_TIME = 6 * 60 * 60 * 1000

export const useResourcePublicationStatus = ({
  resourceId,
  isInstalled,
  relatedResources = [],
}: {
  resourceId: string
  isInstalled: boolean
  relatedResources?: { resourceId: string }[]
}) => {
  const catalog = useAtomValue(mobileResourceCatalogAtom)
  const resources = [{ resourceId }, ...relatedResources]
  const queries = useQueries({
    queries: resources.map(resource => ({
      queryKey: [
        'resource-publication',
        resource.resourceId,
        catalog.resources[resource.resourceId]?.archiveSha256,
      ],
      queryFn: () => resolveResourceCatalogStatus(resource.resourceId, { catalog }),
      enabled: isInstalled && Boolean(catalog.resources[resource.resourceId]),
      staleTime: PUBLICATION_STALE_TIME,
      refetchOnMount: 'always' as const,
      retry: false,
    })),
  })

  return {
    status:
      isInstalled && queries.some(query => query.data === 'update-available')
        ? ('update-available' as const)
        : isInstalled && queries.every(query => query.data === 'current')
          ? ('current' as const)
          : undefined,
  }
}
