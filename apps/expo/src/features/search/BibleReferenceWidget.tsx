import { resolveFontFamily } from '~themes/styleValues'
import { useTheme as useStylingTheme } from '~themes/ThemeProvider'
import { TouchableOpacity } from 'react-native'
import { getBook } from '~helpers/bibleBookCatalog'
import Box, { HStack } from '~common/ui/Box'
import { Chip } from '~common/ui/NewChip'
import Paragraph from '~common/ui/Paragraph'
import Text from '~common/ui/Text'
import { parseBibleReferenceSegments, type BibleReferenceSegment } from '~helpers/bcvParser'
import { useTranslation } from 'react-i18next'
import formatVerseContent from '~helpers/formatVerseContent'
import useBibleVerses from '~features/resources/useBibleVerses'
import { removeBreakLines } from '~helpers/utils'
import i18n from '~i18n'
import { useDefaultBibleVersion } from '~state/useDefaultBibleVersion'
import { usePushRouteOnce } from '~navigation/usePushRouteOnce'
import { getBibleViewParamsForReferenceSegment } from './searchNavigation'
interface Props {
  searchValue: string
}

const BibleReferenceWidget = ({ searchValue }: Props) => {
  const { i18n: translation } = useTranslation()
  const segments = parseBibleReferenceSegments(
    searchValue,
    translation.language.startsWith('fr') ? 'fr' : 'en'
  )

  if (segments.length === 0) return null

  return (
    <>
      {segments.map((segment, i) => (
        <ReferenceItem
          key={`${segment.book}-${segment.chapter}-${segment.startVerse}-${segment.endVerse}-${i}`}
          segment={segment}
        />
      ))}
    </>
  )
}

const ReferenceItem = ({ segment }: { segment: BibleReferenceSegment }) => {
  const stylingTheme = useStylingTheme()

  const pushRouteOnce = usePushRouteOnce()
  const version = useDefaultBibleVersion()

  const verseCount = segment.isWholeChapter
    ? Math.min(3, segment.endVerse)
    : segment.endVerse - segment.startVerse + 1
  const verseIds = Array.from({ length: verseCount }, (_, i) => ({
    Livre: segment.book,
    Chapitre: segment.chapter,
    Verset: segment.startVerse + i,
  }))

  const verses = useBibleVerses(verseIds)

  const title = segment.isWholeChapter
    ? `${i18n.t(getBook(segment.book)?.Nom || 'Livre {{bookNumber}}', {
        bookNumber: segment.book,
      })} ${segment.chapter}`
    : formatVerseContent(verseIds).title
  const content = verses.map(v => v.Texte).join(' ')

  return (
    <TouchableOpacity
      accessibilityRole="button"
      activeOpacity={0.7}
      onPress={() =>
        pushRouteOnce({
          pathname: '/bible-view',
          params: getBibleViewParamsForReferenceSegment(segment),
        })
      }
    >
      <Box className="border-continuous overflow-hidden pt-[15px] pb-[20px] border-b-[1px] border-border px-[20px]">
        <HStack className="overflow-hidden border-continuous items-center gap-[4px] mb-[4px]">
          <Text
            className="text-[14px]"
            style={{ fontFamily: resolveFontFamily(stylingTheme.fontFamily.title) }}
          >
            {title}
          </Text>
          <Chip>{version}</Chip>
        </HStack>
        {content ? (
          <Paragraph small>
            {removeBreakLines(content)}
            {segment.isWholeChapter ? '...' : ''}
          </Paragraph>
        ) : null}
      </Box>
    </TouchableOpacity>
  )
}

export default BibleReferenceWidget
