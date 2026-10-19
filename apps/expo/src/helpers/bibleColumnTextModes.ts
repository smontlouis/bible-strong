import type { ResourceLanguage } from './databaseTypes'
import type { InterlinearMode } from './interlinearDisplayMode'
import { isInterlinearCapableBibleVersion } from './interlinearBiblePublications'
import { resolveStrongBibleVersion, type StrongMode } from './strongBiblePublications'
import type { PendingBibleModeAcquisition } from './bibleModeAcquisition'

/**
 * The text modes of one column of a Bible tab: Strong and interlinear.
 * The main version keeps them in the tab's own fields; each parallel version in `parallelTextModes`.
 */
export type BibleColumnTextModes = {
  /** The version the modes were set for: an entry is only worth anything while its column holds it. */
  version: string
  strongMode?: StrongMode
  interlinearMode?: InterlinearMode
  interlinearLocale?: ResourceLanguage
}

/** A column of the reader: 0 is the main version, n the n-th parallel version. */
export type BibleTextModeColumn = number

export type BibleColumnTextModesData = {
  selectedVersion: string
  strongMode?: StrongMode
  interlinearMode?: InterlinearMode
  interlinearLocale?: ResourceLanguage
  parallelVersions: readonly string[]
  parallelTextModes?: BibleColumnTextModes[]
}

export type BibleColumnTextModesPatch = Partial<Omit<BibleColumnTextModes, 'version'>>

export const getHiddenColumnTextModes = (version: string): BibleColumnTextModes => ({
  version,
  strongMode: 'hidden',
  interlinearMode: isInterlinearCapableBibleVersion(version) ? 'hidden' : undefined,
})

/** What a parallel column displayed when every column followed the modes of the tab. */
const getInheritedColumnTextModes = (
  data: BibleColumnTextModesData,
  version: string
): BibleColumnTextModes => {
  const strongMode = resolveStrongBibleVersion(version, data.strongMode).strongMode
  const interlinearLocale = data.interlinearLocale
  if (!isInterlinearCapableBibleVersion(version)) return { version, strongMode, interlinearLocale }

  return {
    version,
    strongMode,
    interlinearMode:
      data.strongMode === 'visible'
        ? 'strong'
        : data.strongMode === 'reverse-interlinear'
          ? 'interlinear'
          : (data.interlinearMode ?? 'hidden'),
    interlinearLocale,
  }
}

/**
 * The modes of every parallel column, by position. A tab written before modes belonged to columns
 * shows what it showed then; a column whose version changed elsewhere starts without any mode.
 */
export const getParallelColumnTextModes = (
  data: BibleColumnTextModesData
): BibleColumnTextModes[] =>
  data.parallelVersions.map((version, index) => {
    if (!data.parallelTextModes) return getInheritedColumnTextModes(data, version)
    const modes = data.parallelTextModes[index]
    return modes?.version === version ? modes : getHiddenColumnTextModes(version)
  })

export const getBibleColumnTextModes = (
  data: BibleColumnTextModesData,
  column: BibleTextModeColumn
): BibleColumnTextModes | undefined => {
  if (column === 0) {
    return {
      version: data.selectedVersion,
      strongMode: data.strongMode,
      interlinearMode: data.interlinearMode,
      interlinearLocale: data.interlinearLocale,
    }
  }
  return getParallelColumnTextModes(data)[column - 1]
}

/** Writes the modes of the parallel columns down, so that a change of the tab's modes leaves them be. */
export const materializeParallelTextModes = <Data extends BibleColumnTextModesData>(
  data: Data
): Data => {
  // Data persisted by older applications may lack the parallel versions altogether.
  if (!data.parallelVersions) return data
  const parallelTextModes = getParallelColumnTextModes(data)
  if (
    data.parallelTextModes &&
    data.parallelTextModes.length === parallelTextModes.length &&
    data.parallelTextModes.every((modes, index) => modes === parallelTextModes[index])
  ) {
    return data
  }
  if (!data.parallelVersions.length && !data.parallelTextModes) return data
  return { ...data, parallelTextModes: parallelTextModes.map(modes => ({ ...modes })) }
}

/** Sets the modes of one column, in place (an immer draft); the other columns keep theirs. */
export const setBibleColumnTextModes = (
  data: BibleColumnTextModesData,
  column: BibleTextModeColumn,
  patch: BibleColumnTextModesPatch
): void => {
  data.parallelTextModes = materializeParallelTextModes(data).parallelTextModes
  if (column === 0) {
    if ('strongMode' in patch) data.strongMode = patch.strongMode
    if ('interlinearMode' in patch) data.interlinearMode = patch.interlinearMode
    if ('interlinearLocale' in patch) data.interlinearLocale = patch.interlinearLocale
    return
  }
  const modes = data.parallelTextModes?.[column - 1]
  if (!modes) return
  Object.assign(modes, patch)
}

/** A parallel column takes a new version: it starts without any mode, as the main version does. */
export const resetParallelColumnTextModes = (
  data: BibleColumnTextModesData,
  index: number,
  version: string
): void => {
  data.parallelTextModes = materializeParallelTextModes(data).parallelTextModes ?? []
  data.parallelTextModes[index] = getHiddenColumnTextModes(version)
}

/**
 * A finished download turns its mode on in the column the reader acted on, in place (an immer
 * draft), provided that column still holds the version the mode was asked for.
 */
export const applyBibleModeAcquisition = (
  data: BibleColumnTextModesData,
  acquisition: PendingBibleModeAcquisition
): void => {
  const column = acquisition.column ?? 0
  const columnVersion = getBibleColumnTextModes(data, column)?.version
  if (acquisition.kind === 'strong' && columnVersion === acquisition.versionId) {
    setBibleColumnTextModes(data, column, { strongMode: acquisition.mode })
  }
  if (
    acquisition.kind === 'interlinear' &&
    columnVersion &&
    isInterlinearCapableBibleVersion(columnVersion)
  ) {
    setBibleColumnTextModes(data, column, {
      interlinearMode: acquisition.mode,
      interlinearLocale: acquisition.locale,
    })
  }
}
