import { atom } from 'jotai/vanilla'

import type { BibleTab, BibleTabActions } from '~state/tabs'

/** Without `setSelectedVersionInInterlinear`, the list offers no interlinear shortcut. */
export type VersionSelectorActions = Pick<
  BibleTabActions,
  'setSelectedVersion' | 'setParallelVersion'
> &
  Partial<Pick<BibleTabActions, 'setSelectedVersionInInterlinear'>>

export const versionSelectorDataAtom = atom<{
  actions?: VersionSelectorActions
  data?: BibleTab['data']
  parallelVersionIndex?: number
}>({})
