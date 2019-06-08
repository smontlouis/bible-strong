import React from 'react'
import styled from '@emotion/native'
import * as Icon from '@expo/vector-icons'
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
  marginLeft: 10,
  marginRight: 10
})

const IconButton = styled.TouchableOpacity({
  width: 30,
  height: 30,
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: 30
})

const StyledIcon = styled(Icon.Feather)(({ theme }) => ({
  color: theme.colors.tertiary
}))

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
        <StyledIcon name={'arrow-left-circle'} size={30} />
      </IconButton>
    )}
    <Box flex />
    {!(book.Numero === 66 && chapter === 22) && (
      <IconButton
        disabled={disabled}
        activeOpacity={0.5}
        onPress={goToNextChapter}
      >
        <StyledIcon
          name={'arrow-right-circle'}
          size={30}
        />
      </IconButton>
    )}
  </Container>
)

export default pure(BibleFooter)
