import { useOfflineResourceRegistry } from '~features/resources/useOfflineResourceRegistry'

export const useResourcePublicationStatus = ({
  resourceId,
  isInstalled,
  relatedResources = [],
}: {
  resourceId: string
  isInstalled: boolean
  relatedResources?: { resourceId: string }[]
}) => {
  const registry = useOfflineResourceRegistry()
  const resources = [{ resourceId }, ...relatedResources]
    .map(resource => registry.resources.get(resource.resourceId))
    .filter(resource => resource?.catalogRevision)

  return {
    status:
      isInstalled && resources.some(resource => resource?.updateAvailable)
        ? ('update-available' as const)
        : isInstalled && resources.length > 0
          ? ('current' as const)
          : undefined,
  }
}
