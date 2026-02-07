import React from 'react'
import { TouchableOpacity } from 'react-native'
import { useRouter } from 'expo-router'

import { parseResponse } from '~helpers/bcvParser'
import booksDesc from '~assets/bible_versions/books-desc'
import formatVerseContent from '~helpers/formatVerseContent'
import i18n from '~i18n'
import useBibleVerses from '~helpers/useBibleVerses'
import { useDefaultBibleVersion } from '~state/useDefaultBibleVersion'
import { removeBreakLines } from '~helpers/utils'
import Box, { HStack } from '~common/ui/Box'
import Text from '~common/ui/Text'
import Paragraph from '~common/ui/Paragraph'
import { Chip } from '~common/ui/NewChip'

interface ParsedSegment {
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
  console.log(parsed)
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
  const router = useRouter()
  const version = useDefaultBibleVersion()

  const verseIds: { Livre: number; Chapitre: number; Verset: number }[] = []
  for (let v = segment.startVerse; v <= segment.endVerse; v++) {
    verseIds.push({ Livre: segment.book, Chapitre: segment.chapter, Verset: v })
  }

  const verses = useBibleVerses(verseIds)

  const title = segment.isWholeChapter
    ? `${i18n.t(booksDesc[segment.book - 1]?.Nom)} ${segment.chapter}`
    : formatVerseContent(verseIds).title
  const content = verses.map((v: any) => v.Texte).join(' ')

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={() =>
        router.push({
          pathname: '/bible-view',
          params: {
            isReadOnly: 'true',
            book: JSON.stringify(booksDesc[segment.book - 1]),
            chapter: String(segment.chapter),
            verse: String(segment.startVerse),
            ...(segment.isWholeChapter
              ? {}
              : { focusVerses: JSON.stringify(verseIds.map(v => v.Verset)) }),
          },
        })
      }
    >
      <Box paddingTop={15} paddingBottom={20} borderBottomWidth={1} borderColor="border">
        <HStack alignItems="center" gap={4} mb={4}>
          <Text title fontSize={14}>
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
