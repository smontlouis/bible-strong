import type { LocalResourceRef, OfflineResourceRegistrySnapshot } from './resourceAvailability'

/** The pages that show the links, once the device can open them without a network. */
const showsStudyLinks = (resource: LocalResourceRef) => {
  switch (resource.kind) {
    case 'dictionary':
      return true
    case 'database':
      return (
        resource.databaseId === 'DICTIONNAIRE' ||
        resource.databaseId === 'NAVE' ||
        resource.databaseId === 'TIMELINE'
      )
    case 'strong-lexicon-module':
      return resource.moduleId === 'entities'
    default:
      return false
  }
}

export const holdsPageWithStudyLinks = (snapshot: OfflineResourceRegistrySnapshot) =>
  [...snapshot.resources.values()].some(
    entry => entry.availability.status === 'available' && showsStudyLinks(entry.resource)
  )

/**
 * The links have no Download row: they follow the Offline copies that show them, and an installed
 * copy is read even online, so it has to follow the catalog too (ADR-0094).
 */
export const needsStudyLinksCopy = (snapshot: OfflineResourceRegistrySnapshot) => {
  const links = snapshot.resources.get('study-links')
  if (!links) return false
  return (
    (links.availability.status !== 'available' || links.updateAvailable) &&
    holdsPageWithStudyLinks(snapshot)
  )
}
