import React from 'react'

import type { SheetRef } from '~common/sheet'
import type { Version } from '~helpers/bibleVersions'

export const useBibleOfflineDetails = () => {
  const sheetRef = React.useRef<SheetRef>(null)
  const [version, setVersion] = React.useState<(Version & { displayName?: string }) | undefined>()

  const open = (nextVersion: Version & { displayName?: string }) => {
    setVersion(nextVersion)
    requestAnimationFrame(() => sheetRef.current?.present())
  }

  return { sheetRef, version, open }
}
