import { atom } from 'jotai/vanilla'
import { BibleTab } from '../../../../state/tabs'

export const selectBibleReferenceDataAtom = atom<{
  onSelect?: (data: BibleTab['data']['temp']) => void
}>({})

