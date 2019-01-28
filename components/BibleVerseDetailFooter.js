import React from 'react'
import styled from '@emotion/native'
import { Icon } from 'expo'
import { pure } from 'recompose'

import Box from '@ui/Box'
import Text from '@ui/Text'

const IconButton = styled.TouchableOpacity({
  alignItems: 'center',
  justifyContent: 'center',
  flexDirection: 'row'
})

const BibleVerseDetailFooter = ({
  book,
  chapter,
  verse,
  goToNextVerse,
  goToPrevVerse
}) => (
  <Box row paddingLeft={20} paddingRight={20} marginTop={20}>
    {!(book.Numero === 1 && chapter === 1) && (
      <IconButton activeOpacity={0.5} onPress={goToPrevVerse}>
        <Icon.AntDesign name={'leftcircleo'} size={20} />
        <Text paddingLeft={10} darkGrey>
          Verset précédent
        </Text>
      </IconButton>
    )}
    <Box flex />
    {!(book.Numero === 66 && chapter === 22) && (
      <IconButton activeOpacity={0.5} onPress={goToNextVerse}>
        <Text paddingRight={10} darkGrey>
          Verset suivant
        </Text>
        <Icon.AntDesign name={'rightcircleo'} size={20} />
      </IconButton>
    )}
  </Box>
)

export default pure(BibleVerseDetailFooter)
