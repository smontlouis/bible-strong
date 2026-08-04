import { getPericopeUrl, versionHasPericope } from './pericopes'
import { getRedWordsUrl, versionHasRedWords } from './redWords'
import { usesCanonicalBibleExtras } from './strongBiblePublications'
import { createOfflineCopyId } from './offlineCopyId'

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
            resourceId: createOfflineCopyId({ kind: 'bible-pericope', versionId }),
            url: getPericopeUrl(versionId),
          },
        ]
      : []),
    ...(versionHasRedWords(versionId)
      ? [
          {
            resourceId: createOfflineCopyId({ kind: 'bible-red-words', versionId }),
            url: getRedWordsUrl(versionId),
          },
        ]
      : []),
  ]
}
