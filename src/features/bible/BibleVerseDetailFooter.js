import React from 'react'
import styled from '@emotion/native'
import { Icon } from 'expo'
import { pure } from 'recompose'

import Box from '~common/ui/Box'
import Text from '~common/ui/Text'

const IconButton = styled.TouchableOpacity({
  alignItems: 'center',
  justifyContent: 'center',
  flexDirection: 'row'
})

const BibleVerseDetailFooter = ({
  verseNumber,
  goToNextVerse,
  goToPrevVerse,
  versesInCurrentChapter
}) => (
  <Box row paddingLeft={20} paddingRight={20} marginTop={20}>
    {!(verseNumber === 1) && (
      <IconButton
        activeOpacity={0.5}
        onPress={() => goToPrevVerse(versesInCurrentChapter)}
      >
        <Icon.Feather name={'arrow-left-circle'} size={20} />
        <Text paddingLeft={10} darkGrey>
          Verset précédent
        </Text>
      </IconButton>
    )}
    <Box flex />
    {!(verseNumber === versesInCurrentChapter) && (
      <IconButton
        activeOpacity={0.5}
        onPress={() => goToNextVerse(versesInCurrentChapter)}
      >
        <Text paddingRight={10} darkGrey>
          Verset suivant
        </Text>
        <Icon.Feather name={'arrow-right-circle'} size={20} />
      </IconButton>
    )}
  </Box>
)

export default pure(BibleVerseDetailFooter)
