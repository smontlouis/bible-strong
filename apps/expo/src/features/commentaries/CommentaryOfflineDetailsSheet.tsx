import type { CommentaryCatalogEntry } from '@bible-strong/resource-catalog/commentaries'
import React from 'react'

import { SheetScrollView, type SheetRef } from '~common/sheet'
import Sheet from '~common/ContextualPanel/ContextualSheet'
import type { ResourceLanguage } from '~helpers/databaseTypes'
import CommentaryOfflineDetails from './CommentaryOfflineDetails'

type CommentaryProjection = {
  entry: CommentaryCatalogEntry
  language: ResourceLanguage
}

type Props = {
  sheetRef: React.RefObject<SheetRef | null>
  projection?: CommentaryProjection
}

const CommentaryOfflineDetailsSheet = ({ sheetRef, projection }: Props) => {
  if (!projection) return null

  return (
    <Sheet ref={sheetRef}>
      <SheetScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 22, paddingBottom: 32 }}
      >
        <CommentaryOfflineDetails projection={projection} />
      </SheetScrollView>
    </Sheet>
  )
}

export default CommentaryOfflineDetailsSheet
