import type { BibleTab, VersionCode } from '~state/tabs'
import { resolveStrongBibleVersion } from './strongBiblePublications'
import { isInterlinearCapableBibleVersion } from './interlinearBiblePublications'

export const selectBibleTabVersion = (
  data: BibleTab['data'],
  selectedVersion: VersionCode
): BibleTab['data'] => {
  const resolved = resolveStrongBibleVersion(selectedVersion)
  return {
    ...data,
    selectedVersion: resolved.versionId as VersionCode,
    strongMode: resolved.strongMode,
    interlinearMode: isInterlinearCapableBibleVersion(resolved.versionId) ? 'hidden' : undefined,
    ...(data.entityReference && {
      entityReference: {
        ...data.entityReference,
        preferredVersion: resolved.versionId as VersionCode,
      },
    }),
  }
}
