import type { BibleTab, VersionCode } from '~state/tabs'
import { resolveStrongBibleVersion } from './strongBiblePublications'

export const selectBibleTabVersion = (
  data: BibleTab['data'],
  selectedVersion: VersionCode
): BibleTab['data'] => {
  const resolved = resolveStrongBibleVersion(selectedVersion)
  return {
    ...data,
    selectedVersion: resolved.versionId as VersionCode,
    strongMode: resolved.strongMode,
    ...(data.entityReference && {
      entityReference: {
        ...data.entityReference,
        preferredVersion: resolved.versionId as VersionCode,
      },
    }),
  }
}
