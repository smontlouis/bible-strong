import { getPericopeUrl, versionHasPericope } from './pericopes'
import { getRedWordsUrl, versionHasRedWords } from './redWords'
import { usesCanonicalBibleExtras } from './strongBiblePublications'

export interface BibleRelatedPublicationResource {
  resourceId: string
  url: string
}

export const getBibleRelatedPublicationResources = (
  versionId: string
): BibleRelatedPublicationResource[] => {
  if (usesCanonicalBibleExtras(versionId)) return []

  return [
    ...(versionHasPericope(versionId)
      ? [
          {
            resourceId: `bible-pericope:${versionId}`,
            url: getPericopeUrl(versionId),
          },
        ]
      : []),
    ...(versionHasRedWords(versionId)
      ? [
          {
            resourceId: `bible-red-words:${versionId}`,
            url: getRedWordsUrl(versionId),
          },
        ]
      : []),
  ]
}
