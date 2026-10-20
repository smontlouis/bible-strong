import { styled } from 'goober'

import type { RootStyles } from './BibleDOMWrapper'
import { INTERFACE_FONT } from './interfaceFont'
import { scaleFontSize } from './scaleFontSize'

const PSALMS = 19

const Opening = styled('header')({
  textAlign: 'center',
  padding: '22px 0 30px',
  userSelect: 'none',
  WebkitUserSelect: 'none',
})

// Titles in the Bible text's font, labels in the app's
const Title = styled('h1')<RootStyles>(
  ({ settings: { fontFamily, fontSizeScale, colors, theme } }) => ({
    margin: 0,
    fontFamily,
    fontSize: scaleFontSize(38, fontSizeScale),
    fontWeight: 400,
    lineHeight: 1.15,
    color: colors[theme].default,
  })
)

// The title in the version's own language, under the book's name
const OriginalTitle = styled('p')<RootStyles>(
  ({ settings: { fontFamily, fontSizeScale, colors, theme } }) => ({
    margin: '6px 0 0',
    fontFamily,
    fontSize: scaleFontSize(19, fontSizeScale),
    lineHeight: 1.3,
    color: colors[theme].tertiary,
  })
)

const ChapterNumber = styled('span')<RootStyles>(({ settings: { fontFamily, fontSizeScale } }) => ({
  display: 'block',
  marginTop: '4px',
  fontFamily,
  fontSize: scaleFontSize(56, fontSizeScale),
  lineHeight: 1.05,
}))

const Label = styled('span')<RootStyles>(({ settings: { fontSizeScale, colors, theme } }) => ({
  display: 'block',
  fontFamily: INTERFACE_FONT,
  fontSize: scaleFontSize(12, fontSizeScale),
  fontWeight: 600,
  letterSpacing: '0.14em',
  lineHeight: 1.4,
  textTransform: 'uppercase',
  color: colors[theme].tertiary,
}))

const Rule = styled('div')<RootStyles & { $spaceAfter?: boolean }>(
  ({ settings: { colors, theme }, $spaceAfter }) => ({
    width: '28px',
    height: '2px',
    borderRadius: '999px',
    background: colors[theme].primary,
    margin: `16px auto ${$spaceAfter ? '12px' : '0'}`,
  })
)

/**
 * Opens a chapter: the book's name on its first chapter, the chapter number on the others.
 * A psalm is numbered as a psalm, and a book of one chapter shows its name alone.
 */
export default function ChapterOpening({
  settings,
  book,
  chapter,
  bookName,
  chapterLabel,
  psalmLabel,
  originalTitle,
}: RootStyles & {
  book: { Numero: number; Chapitres: number }
  chapter: number
  bookName: string
  chapterLabel: string
  psalmLabel: string
  originalTitle?: { title: string; lang: string; dir: 'rtl' | 'ltr' } | null
}) {
  const isPsalm = book.Numero === PSALMS
  const numberLabel = isPsalm ? psalmLabel : chapterLabel

  if (chapter === 1) {
    return (
      <Opening>
        <Title settings={settings}>{bookName}</Title>
        {originalTitle && (
          <OriginalTitle settings={settings} lang={originalTitle.lang} dir={originalTitle.dir}>
            {originalTitle.title}
          </OriginalTitle>
        )}
        <Rule settings={settings} $spaceAfter={book.Chapitres > 1} />
        {book.Chapitres > 1 && <Label settings={settings}>{`${numberLabel} 1`}</Label>}
      </Opening>
    )
  }

  return (
    <Opening>
      <Title settings={settings}>
        <Label settings={settings}>{isPsalm ? psalmLabel : bookName}</Label>{' '}
        <ChapterNumber settings={settings}>{chapter}</ChapterNumber>
      </Title>
      <Rule settings={settings} />
    </Opening>
  )
}
