import React, { useMemo } from 'react'

import { atom } from 'jotai/vanilla'
import { StackScreenProps } from '@react-navigation/stack'
import { CommentaryTab } from '../../state/tabs'
import CommentariesTabScreen from './CommentariesTabScreen'
import { MainStackProps } from '~navigation/type'

const CommentariesScreen = ({
  navigation,
  route,
}: StackScreenProps<MainStackProps, 'Commentaries'>) => {
  const verse = route.params.verse // navigation.getParam('verse')

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
