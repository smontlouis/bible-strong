import React, { useEffect } from 'react'
import { searchReference } from '~helpers/searchReference'
import useAsync from '~helpers/useAsync'
import Link from '~common/Link'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import { LinearGradient } from 'expo-linear-gradient'
import books from '~assets/bible_versions/books-desc'
import formatVerseContent from '~helpers/formatVerseContent'

interface Props {
  searchValue: string
}

const height = 40

const VerseResultWidget = ({ searchValue }: Props) => {
  const color1 = 'rgba(151,172,184,1)'
  const color2 = 'rgba(112,142,160,1)'
  const { data: reference } = useAsync(
    async () => await searchReference(searchValue),
    [searchValue]
  )
  if (!reference) return null

  const { book, chapter, verse } = reference
  const { title } = formatVerseContent([
    {
      Livre: book,
      Chapitre: chapter,
      Verset: verse,
    },
  ])

  return (
    <Link
      key="reference"
      route="BibleView"
      params={{
        isReadOnly: true,
        book: books[book - 1],
        chapter,
        verse,
        focusVerses: [verse],
      }}
    >
      <Box center rounded marginRight={10} marginBottom={10} height={height} paddingHorizontal={20}>
        <Box
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 0,
            height,
            borderRadius: 3,
          }}
        >
          <LinearGradient start={[0.1, 0.2]} style={{ height }} colors={[color1, color2]} />
        </Box>
        <Text title fontSize={14} style={{ color: 'white' }}>
          {title}
        </Text>
      </Box>
    </Link>
  )
}

export default VerseResultWidget
