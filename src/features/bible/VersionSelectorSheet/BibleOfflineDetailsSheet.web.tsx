import type { RefObject } from 'react'

import type { SheetRef } from '~common/sheet'
import type { Version } from '~helpers/bibleVersions'

type Props = {
  sheetRef: RefObject<SheetRef | null>
  version?: Version & { displayName?: string }
}

const BibleOfflineDetailsSheet = (_props: Props) => null

export default BibleOfflineDetailsSheet
