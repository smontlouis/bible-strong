import React, { useEffect, useMemo } from 'react'

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
  const onTheFlyAtom = useMemo(
    () =>
      atom<CommentaryTab>({
        id: `commentary-${generateUUID()}`,
        title: 'Commentaire',
        isRemovable: true,
        hasBackButton: true,
        type: 'commentary',
        data: {
          verse,
        },
      } as CommentaryTab),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  const [commentaryTab] = useAtom(onTheFlyAtom)

  useEffect(() => {
    onChangeVerse(commentaryTab.data.verse)
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
