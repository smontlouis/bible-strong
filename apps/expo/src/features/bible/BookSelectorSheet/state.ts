import { atom } from 'jotai/vanilla'
import type { BibleTab, BibleTabActions } from '~state/tabs'
import type { BibleVersionCoverage } from '~helpers/biblesDb'
export const bookSelectorDataAtom = atom<{
  actions?: BibleTabActions
  data?: BibleTab['data']
  coverage?: BibleVersionCoverage
}>({})
