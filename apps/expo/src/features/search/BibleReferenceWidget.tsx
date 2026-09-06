import { resolveFontFamily } from '~themes/styleValues'
import { useTheme as useStylingTheme } from '~themes/ThemeProvider'
import { TouchableOpacity } from 'react-native'
import { getBook } from '~helpers/bibleBookCatalog'
import Box, { HStack } from '~common/ui/Box'
import { Chip } from '~common/ui/NewChip'
import Paragraph from '~common/ui/Paragraph'
import Text from '~common/ui/Text'
import { parseResponse } from '~helpers/bcvParser'
import formatVerseContent from '~helpers/formatVerseContent'
import useBibleVerses from '~features/resources/useBibleVerses'
import { removeBreakLines } from '~helpers/utils'
import i18n from '~i18n'
import { useDefaultBibleVersion } from '~state/useDefaultBibleVersion'
import { usePushRouteOnce } from '~navigation/usePushRouteOnce'
import { getBibleViewParamsForReferenceSegment } from './searchNavigation'
export interface ParsedSegment {
  book: number
  chapter: number
  startVerse: number
  endVerse: number
  isWholeChapter: boolean
}

/**
 * Parse the `parsed` string from `parseResponse` into structured segments.
 * Format: "bookNum_chapter", "bookNum_chapter:verse", "bookNum_chapter:startVerse-endVerse"
 * Multiple segments are comma-separated.
 */
function parseParsedString(parsed: string): ParsedSegment[] {
  if (!parsed) return []

  return parsed
    .split(',')
    .map(segment => {
      const [bookChapter, verseRange] = segment.split(':')
      const [bookStr, chapterStr] = bookChapter.split('_')
      const book = parseInt(bookStr, 10)
      const chapter = parseInt(chapterStr, 10)

      if (isNaN(book) || isNaN(chapter)) return null

      if (!verseRange) {
        return { book, chapter, startVerse: 1, endVerse: 3, isWholeChapter: true }
      }

      const [startStr, endStr] = verseRange.split('-')
      const start = parseInt(startStr, 10)
      const end = endStr ? parseInt(endStr, 10) : start

      return { book, chapter, startVerse: start, endVerse: end, isWholeChapter: false }
    })
    .filter((s): s is ParsedSegment => s !== null)
}

export function parseBibleReference(searchValue: string): ParsedSegment[] {
  const { parsed } = parseResponse(searchValue)
  return parseParsedString(parsed)
}

interface Props {
  searchValue: string
}

const BibleReferenceWidget = ({ searchValue }: Props) => {
  const segments = parseBibleReference(searchValue)

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

const ReferenceItem = ({ segment }: { segment: ParsedSegment }) => {
  const stylingTheme = useStylingTheme()

  const pushRouteOnce = usePushRouteOnce()
  const version = useDefaultBibleVersion()

  const verseCount = segment.endVerse - segment.startVerse + 1
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
