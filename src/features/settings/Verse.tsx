import { TouchableOpacity } from 'react-native'
import distanceInWords from 'date-fns/formatDistance'

import styled from '@emotion/native'
import { useTranslation } from 'react-i18next'

import EntityChipList from '~common/EntityChipList'
import { FeatherIcon } from '~common/ui/Icon'
import { LinkBox } from '~common/Link'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import Paragraph from '~common/ui/Paragraph'
import HighlightTypeIndicator from '~common/HighlightTypeIndicator'
import truncate from '~helpers/truncate'
import formatVerseContent from '~helpers/formatVerseContent'
import { getBook } from '~helpers/bibleBookCatalog'
import { useResolvedBibleVerses } from '~helpers/useBibleVerses'
import { removeBreakLines } from '~helpers/utils'
import useLanguage from '~helpers/useLanguage'
import { getDateLocale } from '~helpers/languageUtils'
import { useHighlightColors, useResolvedColor } from '~helpers/useHighlightColors'
import { usePushRouteOnce } from '~navigation/usePushRouteOnce'
import type { CustomColor, HighlightType } from '~redux/modules/user'
import type { TagsObj, Verse, VerseIds } from '~common/types'

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

export type HighlightSettingsData = {
  stringIds: VerseIds
  verseIds: Verse[]
  color: string
  date: number
  tags: TagsObj
  version?: string
}

type VerseComponentProps = Omit<HighlightSettingsData, 'stringIds'> & {
  stringIds?: VerseIds
  setSettings?: (settings: HighlightSettingsData) => void
}

const VerseComponent = ({
  color,
  date,
  verseIds,
  stringIds,
  tags,
  version: sourceVersion,
  setSettings,
}: VerseComponentProps) => {
  const pushRouteOnce = usePushRouteOnce()
  const { verses, version } = useResolvedBibleVerses(verseIds, sourceVersion)
  const { t } = useTranslation()
  const lang = useLanguage()

  const { customHighlightColors, defaultColorTypes } = useHighlightColors()
  const resolvedColor = useResolvedColor(color)

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

  const { title } = formatVerseContent(verseIds)
  const { content } = formatVerseContent(verses)
  const formattedDate = distanceInWords(Number(date), Date.now(), {
    locale: getDateLocale(lang),
  })
  const { Livre, Chapitre, Verset } = verseIds[0]
  const bibleViewParams = {
    contextDisplayMode: 'focused',
    book: JSON.stringify(getBook(Number(Livre))),
    chapter: String(Chapitre),
    verse: String(Verset),
    focusVerses: JSON.stringify(verseIds.map(v => Number(v.Verset))),
    ...(version && { version }),
  }
  const openBibleView = () => {
    pushRouteOnce({
      pathname: '/bible-view',
      params: bibleViewParams,
    })
  }

  return (
    <TouchableOpacity activeOpacity={0.7} onPress={openBibleView}>
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
          {setSettings && stringIds && (
            <LinkBox
              p={4}
              ml={10}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              onPress={() =>
                setSettings({
                  stringIds,
                  verseIds,
                  color,
                  date,
                  tags,
                  version: sourceVersion,
                })
              }
            >
              <FeatherIcon name="more-vertical" size={20} />
            </LinkBox>
          )}
        </Box>
        <Paragraph scale={-2} medium marginBottom={15}>
          {content
            ? truncate(removeBreakLines(content), 200)
            : t('bibleVerse.textUnavailableInstalled')}
        </Paragraph>
        <EntityChipList tags={tags} />
      </Container>
    </TouchableOpacity>
  )
}

export default VerseComponent
