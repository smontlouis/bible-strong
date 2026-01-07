import React, { useMemo } from 'react'

import { atom } from 'jotai/vanilla'
import { useLocalSearchParams } from 'expo-router'
import { CommentaryTab } from '../../state/tabs'
import CommentariesTabScreen from './CommentariesTabScreen'

const CommentariesScreen = () => {
  const params = useLocalSearchParams<{ verse?: string }>()

  // Parse params from URL strings
  const verse = params.verse || ''

  const onTheFlyAtom = useMemo(
    () =>
      atom<CommentaryTab>({
        id: `commentary-${Date.now()}`,
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

  return <CommentariesTabScreen commentaryAtom={onTheFlyAtom} />
}
export default CommentariesScreen
