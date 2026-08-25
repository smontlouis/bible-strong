import { atom } from 'jotai/vanilla'

import type { BibleTab, BibleTabActions } from '~state/tabs'

export const versionSelectorDataAtom = atom<{
  actions?: Pick<BibleTabActions, 'setSelectedVersion' | 'setParallelVersion'>
  data?: BibleTab['data']
  parallelVersionIndex?: number
}>({})
