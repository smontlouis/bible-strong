import React, { useEffect, useState } from 'react'
import { ScrollView } from 'react-native'
import { useDispatch, useSelector } from 'react-redux'

import { useTheme } from '@emotion/react'
import { useTranslation } from 'react-i18next'
import { Switch } from 'react-native-paper'
import Header from '~common/Header'
import Box from '~common/ui/Box'
import Container from '~common/ui/Container'
import Text from '~common/ui/Text'
import getVersesContent from '~helpers/getVersesContent'
import { RootState } from '~redux/modules/reducer'
import {
  toggleSettingsShareAppName,
  toggleSettingsShareLineBreaks,
  toggleSettingsShareQuotes,
  toggleSettingsShareVerseNumbers,
} from '~redux/modules/user'

export const useShareOptions = () => {
  const hasVerseNumbers = useSelector(
    (state: RootState) => state.user.bible.settings.shareVerses.hasVerseNumbers
  )
  const hasInlineVerses = useSelector(
    (state: RootState) => state.user.bible.settings.shareVerses.hasInlineVerses
  )
  const hasQuotes = useSelector(
    (state: RootState) => state.user.bible.settings.shareVerses.hasQuotes
  )
  const hasAppName = useSelector(
    (state: RootState) => state.user.bible.settings.shareVerses.hasAppName
  )

  return {
    hasVerseNumbers,
    hasInlineVerses,
    hasQuotes,
    hasAppName,
  }
}

const BibleShareOptionsScreen = () => {
  const { t } = useTranslation()
  const theme = useTheme()
  const dispatch = useDispatch()
  const [message, setMessage] = useState('')

  const {
    hasVerseNumbers,
    hasInlineVerses,
    hasQuotes,
    hasAppName,
  } = useShareOptions()

  useEffect(() => {
    ;(async () => {
      const { all } = await getVersesContent({
        verses: {
          '1-1-1': true,
          '1-1-2': true,
        },
        version: 'LSG',
        hasVerseNumbers,
        hasInlineVerses,
        hasQuotes,
        hasAppName,
      })

      setMessage(all)
    })()
  }, [hasVerseNumbers, hasInlineVerses, hasQuotes, hasAppName])

  return (
    <Container>
      <Header hasBackButton title={t('bible.settings.shareOptions')} />
      <ScrollView>
        <Box
          paddingHorizontal={20}
          paddingVertical={10}
          row
          alignItems="center"
        >
          <Text flex>{t('bible.settings.hasVerseNumbers')}</Text>
          <Switch
            color={theme.colors.primary}
            value={hasVerseNumbers}
            onValueChange={() => dispatch(toggleSettingsShareVerseNumbers())}
          />
        </Box>
        <Box
          paddingHorizontal={20}
          paddingVertical={10}
          row
          alignItems="center"
        >
          <Text flex>{t('bible.settings.hasInlineVerses')}</Text>
          <Switch
            color={theme.colors.primary}
            value={hasInlineVerses}
            onValueChange={() => dispatch(toggleSettingsShareLineBreaks())}
          />
        </Box>
        <Box
          paddingHorizontal={20}
          paddingVertical={10}
          row
          alignItems="center"
        >
          <Text flex>{t('bible.settings.hasQuotes')}</Text>
          <Switch
            color={theme.colors.primary}
            value={hasQuotes}
            onValueChange={() => dispatch(toggleSettingsShareQuotes())}
          />
        </Box>
        <Box
          paddingHorizontal={20}
          paddingVertical={10}
          row
          alignItems="center"
        >
          <Text flex>{t('bible.settings.hasAppName')}</Text>
          <Switch
            color={theme.colors.primary}
            value={hasAppName}
            onValueChange={() => dispatch(toggleSettingsShareAppName())}
          />
        </Box>
        <Box p={20}>
          <Text>{message}</Text>
        </Box>
      </ScrollView>
    </Container>
  )
}
export default BibleShareOptionsScreen
