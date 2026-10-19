import {
  getBibleColumnTextModes,
  getParallelColumnTextModes,
  type BibleColumnTextModesData,
} from '~helpers/bibleColumnTextModes'
import type { PendingBibleModeAcquisition } from '~helpers/bibleModeAcquisition'
import {
  isInterlinearCapableBibleVersion,
  isInterlinearModeEnabled,
} from '~helpers/interlinearBiblePublications'
import { isStrongCapableBibleVersion } from '~helpers/strongBiblePublications'
import type { ColumnTextModeControls } from './BibleDOM/BibleDOMWrapper'

/** The Strong and interlinear buttons of each column title, the main version first. */
export const getColumnTextModeControls = (
  data: BibleColumnTextModesData & { pendingModeAcquisition?: PendingBibleModeAcquisition }
): ColumnTextModeControls[] => {
  const mainModes = getBibleColumnTextModes(data, 0)
  const columns = mainModes ? [mainModes, ...getParallelColumnTextModes(data)] : []
  const acquisition = data.pendingModeAcquisition

  return columns.map((modes, column) => {
    const strongActive = (modes.strongMode ?? 'hidden') !== 'hidden'
    const interlinearActive = isInterlinearModeEnabled(modes.interlinearMode)
    // While its resources download, a column's button waits, as the header's does.
    const isAcquiring = (kind: PendingBibleModeAcquisition['kind']) =>
      acquisition?.kind === kind && (acquisition.column ?? 0) === column

    return {
      ...(isStrongCapableBibleVersion(modes.version) && {
        strong: {
          active: strongActive,
          downloading: !strongActive && isAcquiring('strong'),
        },
      }),
      ...(isInterlinearCapableBibleVersion(modes.version) && {
        interlinear: {
          active: interlinearActive,
          downloading: !interlinearActive && isAcquiring('interlinear'),
        },
      }),
    }
  })
}
