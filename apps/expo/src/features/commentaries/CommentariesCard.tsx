import React, { useEffect, useEffectEvent, useState } from 'react'

import { atom } from 'jotai/vanilla'
import type { SheetRef } from '~common/sheet'
import generateUUID from '~helpers/generateUUID'
import { CommentaryTab } from '../../state/tabs'
import CommentariesTabScreen from './CommentariesTabScreen'
import { useAtom } from 'jotai/react'

const CommentariesCard = ({
  verse,
  preferredVersion,
  onChangeVerse,
  commentarySelectorRef,
}: {
  verse: string | null
  preferredVersion?: string
  onChangeVerse: (verse: string) => void
  commentarySelectorRef?: React.RefObject<SheetRef | null>
}) => {
  const [onTheFlyAtom] = useState(() =>
    atom<CommentaryTab>({
      id: `commentary-${generateUUID()}`,
      title: 'Commentaire',
      isRemovable: true,
      hasBackButton: true,
      type: 'commentary',
      data: {
        verse,
      },
    } as CommentaryTab)
  )

  const [commentaryTab] = useAtom(onTheFlyAtom)

  const reportVerse = useEffectEvent((value: string) => {
    onChangeVerse(value)
  })
  useEffect(() => {
    reportVerse(commentaryTab.data.verse)
  }, [commentaryTab.data.verse])

  return (
    <CommentariesTabScreen
      hasHeader={false}
      commentaryAtom={onTheFlyAtom}
      preferredVersion={preferredVersion}
      commentarySelectorRef={commentarySelectorRef}
    />
  )
}
export default CommentariesCard
