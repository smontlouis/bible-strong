import type { PrimitiveAtom } from 'jotai/vanilla'
import type { BibleTab } from '~state/tabs'
import type { BibleVersionCoverage } from '~helpers/biblesDb'
export type BibleVerseKeyboardDialogProps = {
  bibleAtom: PrimitiveAtom<BibleTab>
  coverage?: BibleVersionCoverage
  onNavigate: (verse: number) => void
}
export default function BibleVerseKeyboardDialog(_: BibleVerseKeyboardDialogProps) {
  return null
}
