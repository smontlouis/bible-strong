import React from 'react'
import styled from '@emotion/native'
import { Icon } from 'expo'
import { pure } from 'recompose'

import Box from '~common/ui/Box'

const Container = styled.View({
  position: 'absolute',
  bottom: 0,
  left: 0,
  right: 0,
  height: 60,
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginLeft: 20,
  marginRight: 20
})

const IconButton = styled.TouchableOpacity({
  width: 30,
  height: 30,
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: 30,
  backgroundColor: 'white'
})

const BibleFooter = ({
  book,
  chapter,
  goToNextChapter,
  goToPrevChapter,
  disabled
}) => (
  <Container>
    {!(book.Numero === 1 && chapter === 1) && (
      <IconButton
        disabled={disabled}
        activeOpacity={0.5}
        onPress={goToPrevChapter}
      >
        <Icon.AntDesign name={'leftcircle'} size={30} color='rgb(98,113,122)' />
      </IconButton>
    )}
    <Box flex />
    {!(book.Numero === 66 && chapter === 22) && (
      <IconButton
        disabled={disabled}
        activeOpacity={0.5}
        onPress={goToNextChapter}
      >
        <Icon.AntDesign
          name={'rightcircle'}
          size={30}
          color='rgb(98,113,122)'
        />
      </IconButton>
    )}
  </Container>
)

export default pure(BibleFooter)
