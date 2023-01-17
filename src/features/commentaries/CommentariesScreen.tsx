import React, { useMemo } from 'react'

import { atom } from 'jotai'
import { NavigationStackScreenProps } from 'react-navigation-stack'
import { CommentaryTab } from '~state/tabs'
import CommentariesTabScreen from './CommentariesTabScreen'

interface CommentariesScreenProps {
  verse: string
}

const CommentariesScreen = ({
  navigation,
}: NavigationStackScreenProps<CommentariesScreenProps>) => {
  const verse = navigation.getParam('verse')

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

  return (
    <CommentariesTabScreen
      commentaryAtom={onTheFlyAtom}
      navigation={navigation}
    />
  )
}
export default CommentariesScreen
