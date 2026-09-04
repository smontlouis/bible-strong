import { resolveStrongBibleVersion } from './strongBiblePublications'
import type { BibleTab, VersionCode } from '~state/tabs'

export type BibleTabResourceState = Pick<
  BibleTab['data'],
  | 'selectedVersion'
  | 'strongMode'
  | 'interlinearMode'
  | 'interlinearLocale'
  | 'parallelVersions'
  | 'selectedBook'
  | 'selectedChapter'
  | 'selectedVerse'
>

export const resolveBibleTabResources = async (
  data: BibleTabResourceState
): Promise<BibleTabResourceState> => {
  const resolvedStrong = resolveStrongBibleVersion(data.selectedVersion, data.strongMode)
  let nextData =
    resolvedStrong.versionId === data.selectedVersion
      ? data
      : {
          ...data,
          selectedVersion: resolvedStrong.versionId as VersionCode,
        }

  const resolvedParallelVersions = nextData.parallelVersions.map(
    parallelVersion => resolveStrongBibleVersion(parallelVersion).versionId as VersionCode
  )

  const parallelVersionsUnchanged =
    resolvedParallelVersions.length === nextData.parallelVersions.length &&
    resolvedParallelVersions.every(
      (parallelVersion, index) => parallelVersion === nextData.parallelVersions[index]
    )

  if (parallelVersionsUnchanged) return nextData
  return {
    ...nextData,
    parallelVersions: resolvedParallelVersions,
  }
}
