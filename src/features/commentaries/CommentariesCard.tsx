import React, { useEffect, useMemo } from 'react'

import { atom } from 'jotai/vanilla'
import generateUUID from '~helpers/generateUUID'
import { CommentaryTab } from '../../state/tabs'
import CommentariesTabScreen from './CommentariesTabScreen'
import { useAtom } from 'jotai/react'

const CommentariesCard = ({
  verse,
  onChangeVerse,
}: {
  verse: string | null
  onChangeVerse: (verse: string) => void
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
    []
  )

  const [commentaryTab] = useAtom(onTheFlyAtom)

  useEffect(() => {
    onChangeVerse(commentaryTab.data.verse)
  }, [commentaryTab.data.verse])

  return <CommentariesTabScreen hasHeader={false} commentaryAtom={onTheFlyAtom} />
}
export default CommentariesCard
