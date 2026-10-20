import {
  getBibleColumnTextModes,
  getParallelColumnTextModes,
  type BibleColumnTextModesData,
} from '~helpers/bibleColumnTextModes'
import {
  isInterlinearCapableBibleVersion,
  isInterlinearModeEnabled,
} from '~helpers/interlinearBiblePublications'
import { isStrongCapableBibleVersion } from '~helpers/strongBiblePublications'
import type { ColumnTextModeControls } from './BibleDOM/BibleDOMWrapper'

/** The Strong and interlinear buttons of each column title, the main version first. */
export const getColumnTextModeControls = (
  data: BibleColumnTextModesData
): ColumnTextModeControls[] => {
  const mainModes = getBibleColumnTextModes(data, 0)
  const columns = mainModes ? [mainModes, ...getParallelColumnTextModes(data)] : []

  return columns.map(modes => ({
    ...(isStrongCapableBibleVersion(modes.version) && {
      strong: { active: (modes.strongMode ?? 'hidden') !== 'hidden' },
    }),
    ...(isInterlinearCapableBibleVersion(modes.version) && {
      interlinear: { active: isInterlinearModeEnabled(modes.interlinearMode) },
    }),
  }))
}
