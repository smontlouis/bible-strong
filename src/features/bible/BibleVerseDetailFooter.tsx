import React from 'react'
import styled from '@emotion/native'
import * as Icon from '@expo/vector-icons'

import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import { useTranslation } from 'react-i18next'

const IconButton = styled.TouchableOpacity({
  alignItems: 'center',
  justifyContent: 'center',
  flexDirection: 'row',
})

const FeatherIcon = styled(Icon.Feather)(({ theme }) => ({
  color: theme.colors.default,
}))

const BibleVerseDetailFooter = ({
  verseNumber,
  goToNextVerse,
  goToPrevVerse,
  versesInCurrentChapter,
}) => {
  const { t } = useTranslation()
  return (
    <Box row paddingLeft={20} paddingRight={20} my={20}>
      {!(verseNumber == 1) && (
        <IconButton
          activeOpacity={0.5}
          onPress={() => goToPrevVerse(versesInCurrentChapter)}
        >
          <FeatherIcon name="arrow-left-circle" size={20} />
          <Text paddingLeft={10} color="darkGrey">
            {t('Verset précédent')}
          </Text>
        </IconButton>
      )}
      <Box flex />
      {!(verseNumber == versesInCurrentChapter) && (
        <IconButton
          activeOpacity={0.5}
          onPress={() => goToNextVerse(versesInCurrentChapter)}
        >
          <Text paddingRight={10} color="darkGrey">
            {t('Verset suivant')}
          </Text>
          <FeatherIcon name="arrow-right-circle" size={20} />
        </IconButton>
      )}
    </Box>
  )
}

export default BibleVerseDetailFooter
