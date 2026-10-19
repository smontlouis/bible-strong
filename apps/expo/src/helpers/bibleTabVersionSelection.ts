import type { BibleTab, VersionCode } from '~state/tabs'
import { resolveStrongBibleVersion } from './strongBiblePublications'
import { isInterlinearCapableBibleVersion } from './interlinearBiblePublications'
import { materializeParallelTextModes } from './bibleColumnTextModes'

export const selectBibleTabVersion = (
  data: BibleTab['data'],
  selectedVersion: VersionCode
): BibleTab['data'] => {
  const resolved = resolveStrongBibleVersion(selectedVersion)
  return {
    // The parallel columns keep their modes when the main version and its modes change.
    ...materializeParallelTextModes(data),
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
