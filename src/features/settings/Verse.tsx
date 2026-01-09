import React from 'react'
import { TouchableOpacity } from 'react-native'
import distanceInWords from 'date-fns/formatDistance'

import styled from '@emotion/native'
import { useRouter } from 'expo-router'
import { shallowEqual, useSelector } from 'react-redux'

import TagList from '~common/TagList'
import { FeatherIcon } from '~common/ui/Icon'
import { LinkBox } from '~common/Link'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import Paragraph from '~common/ui/Paragraph'
import HighlightTypeIndicator from '~common/HighlightTypeIndicator'
import truncate from '~helpers/truncate'
import formatVerseContent from '~helpers/formatVerseContent'
import books from '~assets/bible_versions/books-desc'
import useBibleVerses from '~helpers/useBibleVerses'
import { removeBreakLines } from '~helpers/utils'
import { useTranslation } from 'react-i18next'
import useLanguage from '~helpers/useLanguage'
import { getDateLocale } from '~helpers/languageUtils'
import useCurrentThemeSelector from '~helpers/useCurrentThemeSelector'
import { RootState } from '~redux/modules/reducer'
import { CustomColor, HighlightType } from '~redux/modules/user'
import { resolveHighlightColor } from '~helpers/highlightColors'
import { EMPTY_ARRAY, EMPTY_OBJECT } from '~helpers/emptyReferences'

const DateText = styled.Text(({ theme }) => ({
  color: theme.colors.tertiary,
}))

const Container = styled(Box)(({ theme }) => ({
  margin: 20,
  paddingBottom: 20,
  marginBottom: 0,
  borderBottomColor: theme.colors.border,
  borderBottomWidth: 1,
}))

const VerseComponent = ({
  color,
  date,
  verseIds,
  stringIds,
  tags,
  setSettings,
}: any) => {
  const router = useRouter()
  const verses = useBibleVerses(verseIds)
  const { t } = useTranslation()
  const lang = useLanguage()
  const { theme: currentTheme } = useCurrentThemeSelector()

  // Use separate selectors to avoid reference instability
  const themeColors = useSelector(
    (state: RootState) => state.user.bible.settings.colors[currentTheme]
  )
  const customHighlightColors = useSelector(
    (state: RootState) => state.user.bible.settings.customHighlightColors ?? EMPTY_ARRAY
  )
  const defaultColorTypes = useSelector(
    (state: RootState) => state.user.bible.settings.defaultColorTypes ?? EMPTY_OBJECT
  )

  const resolvedColor = resolveHighlightColor(color, themeColors, customHighlightColors)

  // Resolve highlight type based on color ID
  const resolveHighlightType = (colorId: string): HighlightType => {
    // Default colors (color1, color2, etc.)
    if (colorId.startsWith('color')) {
      return defaultColorTypes[colorId as keyof typeof defaultColorTypes] || 'background'
    }
    // Custom colors
    const customColor = customHighlightColors.find((c: CustomColor) => c.id === colorId)
    return customColor?.type || 'background'
  }

  const highlightType = resolveHighlightType(color)

  if (!verses.length) {
    return null
  }

  const { title, content } = formatVerseContent(verses)
  const formattedDate = distanceInWords(Number(date), Date.now(), {
    locale: getDateLocale(lang),
  })
  // @ts-ignore
  const { Livre, Chapitre, Verset } = verses[0]
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={() =>
        router.push({
          pathname: '/bible-view',
          params: {
            isReadOnly: 'true',
            book: JSON.stringify(books[Livre - 1]),
            chapter: String(Chapitre),
            verse: String(Verset),
            focusVerses: JSON.stringify(verses.map(v => Number(v.Verset))),
          },
        })
      }
    >
      <Container>
        <Box row style={{ marginBottom: 10 }} alignItems="center">
          <Box flex row alignItems="center">
            <HighlightTypeIndicator color={resolvedColor} type={highlightType} size={15} />
            <Text fontSize={14} marginLeft={10} title>
              {title}
            </Text>
          </Box>
          <DateText style={{ fontSize: 10 }}>
            {t('Il y a {{formattedDate}}', { formattedDate })}
          </DateText>
          {setSettings && (
            <LinkBox
              p={4}
              ml={10}
              // @ts-ignore
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              onPress={() =>
                setSettings({
                  stringIds,
                  verseIds,
                  color,
                  date,
                  tags,
                })
              }
            >
              <FeatherIcon name="more-vertical" size={20} />
            </LinkBox>
          )}
        </Box>
        <Paragraph scale={-2} medium marginBottom={15}>
          {truncate(removeBreakLines(content), 200)}
        </Paragraph>
        {/* @ts-ignore */}
        <TagList tags={tags} />
      </Container>
    </TouchableOpacity>
  )
}

export default VerseComponent
