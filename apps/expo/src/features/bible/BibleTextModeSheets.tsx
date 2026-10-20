import { useAtomValue } from 'jotai/react'
import type { PrimitiveAtom } from 'jotai/vanilla'
import { useImperativeHandle, useRef, useState, type Ref } from 'react'

import type { SheetRef } from '~common/sheet'
import { isInterlinearCapableBibleVersion } from '~helpers/interlinearBiblePublications'
import { isStrongCapableBibleVersion } from '~helpers/strongBiblePublications'
import type { BibleTextModeColumn } from '~helpers/bibleColumnTextModes'
import type { BibleTab } from '~state/tabs'
import InterlinearModeSelectorSheet from './InterlinearModeSelectorSheet'
import StrongModeSelectorSheet from './StrongModeSelectorSheet'

export type BibleTextModeKind = 'strong' | 'interlinear'

export type BibleTextModeSheetsHandle = {
  /** Opens the sheet of a mode for one column: 0 is the main version, n the n-th parallel one. */
  open: (kind: BibleTextModeKind, column: BibleTextModeColumn) => void
}

type Props = {
  bibleAtom: PrimitiveAtom<BibleTab>
  ref?: Ref<BibleTextModeSheetsHandle>
}

/** The Strong and interlinear sheets of a Bible tab, opened from the header or a column title. */
const BibleTextModeSheets = ({ bibleAtom, ref }: Props) => {
  const bible = useAtomValue(bibleAtom)
  const strongModeSheetRef = useRef<SheetRef>(null)
  const interlinearModeSheetRef = useRef<SheetRef>(null)
  const [requestedColumn, setRequestedColumn] = useState<BibleTextModeColumn>(0)
  const { selectedVersion, parallelVersions } = bible.data
  const versions = [selectedVersion, ...parallelVersions]
  // Out of parallel reading, or once its column is gone, the sheets set the main version's modes.
  const column = requestedColumn < versions.length ? requestedColumn : 0

  useImperativeHandle(ref, () => ({
    open: (kind, nextColumn) => {
      setRequestedColumn(nextColumn)
      const sheetRef = kind === 'strong' ? strongModeSheetRef : interlinearModeSheetRef
      sheetRef.current?.present()
    },
  }))

  return (
    <>
      {versions.some(isInterlinearCapableBibleVersion) && (
        <InterlinearModeSelectorSheet
          bibleAtom={bibleAtom}
          sheetRef={interlinearModeSheetRef}
          column={column}
        />
      )}
      {versions.some(isStrongCapableBibleVersion) && (
        <StrongModeSelectorSheet
          bibleAtom={bibleAtom}
          sheetRef={strongModeSheetRef}
          column={column}
        />
      )}
    </>
  )
}

export default BibleTextModeSheets
