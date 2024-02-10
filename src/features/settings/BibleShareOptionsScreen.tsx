import React, { useEffect, useState } from 'react'
import { ScrollView } from 'react-native'
import { useDispatch, useSelector } from 'react-redux'

import { useTranslation } from 'react-i18next'
import Header from '~common/Header'
import Box from '~common/ui/Box'
import Container from '~common/ui/Container'
import Switch from '~common/ui/Switch'
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
          <Box flex>
            <Text>{t('bible.settings.hasAppName')}</Text>
          </Box>
          <Switch
            value={hasAppName}
            onValueChange={() => dispatch(toggleSettingsShareAppName())}
          />
        </Box>
        <Box p={20} m={20} borderRadius={20} bg="reverse">
          <Text>{message}</Text>
        </Box>
      </ScrollView>
    </Container>
  )
}
export default BibleShareOptionsScreen
