'use dom'

import { styled } from 'goober'
import { Verse as TVerse } from '~common/types'
import { WordToken } from '~helpers/wordTokenizer'
import { RootStyles, PericopeChapter } from '../BibleDOMWrapper'
import { scaleFontSize } from '../scaleFontSize'
import { scaleLineHeight } from '../scaleLineHeight'

const Wrapper = styled('span')<RootStyles>(({ settings: { textDisplay } }) => ({
  display: textDisplay,
  transition: 'opacity 0.3s ease',
  position: 'relative',
  zIndex: 1,
  ...(textDisplay === 'block' ? { marginBottom: '5px' } : {}),
}))

const ContainerText = styled('span')<RootStyles>(({ settings: { fontFamily } }) => ({
  fontFamily,
  transition: 'background 0.3s ease, color 0.3s ease',
  background: 'transparent',
  borderRadius: '0px',
  padding: '4px',
  WebkitBoxDecorationBreak: 'clone',
  WebkitTouchCallout: 'none',
  MozUserSelect: 'none',
  msUserSelect: 'none',
  KhtmlUserSelect: 'none',
  WebkitUserSelect: 'none',
}))

const NumberText = styled('span')<RootStyles>(({ settings: { fontSizeScale } }) => ({
  fontSize: scaleFontSize(14, fontSizeScale),
}))

const VerseTextContainer = styled('span')<RootStyles>(
  ({ settings: { fontSizeScale, lineHeight } }) => ({
    fontSize: scaleFontSize(19, fontSizeScale),
    lineHeight: scaleLineHeight(32, lineHeight, fontSizeScale),
    userSelect: 'none',
    WebkitUserSelect: 'none',
    cursor: 'pointer',
    background: 'transparent',
    position: 'relative',
    zIndex: 1,
  })
)

const Span = styled('span')({
  position: 'relative',
  zIndex: 1,
})

const H1 = styled('h1')<RootStyles & { isHebreu: boolean }>(
  ({ settings: { fontSizeScale, fontFamily }, isHebreu }) => ({
    fontFamily,
    fontSize: scaleFontSize(28, fontSizeScale),
    textAlign: isHebreu ? 'right' : 'left',
    position: 'relative',
    zIndex: 1,
  })
)

const H2 = styled('h2')<RootStyles & { isHebreu: boolean }>(
  ({ settings: { fontSizeScale, fontFamily }, isHebreu }) => ({
    fontFamily,
    fontSize: scaleFontSize(24, fontSizeScale),
    textAlign: isHebreu ? 'right' : 'left',
    position: 'relative',
    zIndex: 1,
  })
)

const H3 = styled('h3')<RootStyles & { isHebreu: boolean }>(
  ({ settings: { fontSizeScale, fontFamily }, isHebreu }) => ({
    fontFamily,
    fontSize: scaleFontSize(20, fontSizeScale),
    textAlign: isHebreu ? 'right' : 'left',
    position: 'relative',
    zIndex: 1,
  })
)

const H4 = styled('h4')<RootStyles & { isHebreu: boolean }>(
  ({ settings: { fontSizeScale, fontFamily }, isHebreu }) => ({
    fontFamily,
    fontSize: scaleFontSize(18, fontSizeScale),
    textAlign: isHebreu ? 'right' : 'left',
    position: 'relative',
    zIndex: 1,
  })
)

const getPericopeVerse = (pericopeChapter: PericopeChapter, verse: number) => {
  if (pericopeChapter && pericopeChapter[verse]) {
    return pericopeChapter[verse]
  }
  return {}
}

export interface VerseItemProps {
  verse: TVerse
  verseKey: string
  tokens: WordToken[]
  isHebreu: boolean
  settings: RootStyles['settings']
  pericopeChapter: PericopeChapter
  onVerseClick: (e: React.MouseEvent, verseKey: string, tokens: WordToken[]) => void
}

export function VerseItem({
  verse,
  verseKey,
  tokens,
  isHebreu,
  settings,
  pericopeChapter,
  onVerseClick,
}: VerseItemProps): JSX.Element | null {
  if (verse.Verset === 0) return null

  const { Verset, Texte } = verse
  const { h1, h2, h3, h4 } = getPericopeVerse(pericopeChapter, Number(Verset))
  const displayText = Texte.replace(/\n/g, ' ')

  return (
    <Span>
      {h1 && (
        <H1 isHebreu={isHebreu} settings={settings}>
          {h1}
        </H1>
      )}
      {h2 && (
        <H2 isHebreu={isHebreu} settings={settings}>
          {h2}
        </H2>
      )}
      {h3 && (
        <H3 isHebreu={isHebreu} settings={settings}>
          {h3}
        </H3>
      )}
      {h4 && (
        <H4 isHebreu={isHebreu} settings={settings}>
          {h4}
        </H4>
      )}
      <Wrapper settings={settings} id={`verset-${Verset}`}>
        <ContainerText settings={settings}>
          <NumberText settings={settings}>{Verset} </NumberText>
          <VerseTextContainer
            settings={settings}
            id={`verse-text-${verseKey}`}
            data-verse-key={verseKey}
            onClick={e => onVerseClick(e, verseKey, tokens)}
          >
            {displayText}
          </VerseTextContainer>
        </ContainerText>
      </Wrapper>
    </Span>
  )
}
