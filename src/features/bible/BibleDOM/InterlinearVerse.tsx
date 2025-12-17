import { useState } from 'react'
import { styled } from 'goober'

import { scaleFontSize } from './scaleFontSize'
import { useDispatch } from './DispatchProvider'
import { NAVIGATE_TO_STRONG } from './dispatch'
import { RootStyles } from './BibleDOMWrapper'
import { SelectedCode, Verse } from '~common/types'
import { RootState } from '~redux/modules/reducer'

const Wrapper = styled('div')<RootStyles>(({ settings: { textDisplay } }) => ({
  display: textDisplay,
}))

const Section = styled('div')<RootStyles & { isSelected?: boolean }>(
  ({ settings: { theme, colors } }) => ({
    display: 'inline-block',
    position: 'relative',
    transition: 'background 0.3s ease',
    borderRadius: '4px',
    padding: '2px 4px',
  })
)

const AbsoluteSection = styled('div')<RootStyles & { isSelected?: boolean }>(
  ({ isSelected, settings: { theme, colors } }) => ({
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translateX(-50%) translateY(-50%)',
    borderRadius: '8px',
    pointerEvents: 'none',
    transition: '0.5s ease',
    scale: 0.8,
    display: 'none',
    padding: '5px',
    background: colors[theme].reverse,
    minWidth: '50px',
    border: `3px solid ${colors[theme].primary}`,
    boxShadow: 'rgba(0, 0, 0, 0.1) 0px 10px 15px -3px, rgba(0, 0, 0, 0.05) 0px 4px 6px -2px',
    ...(isSelected
      ? {
          zIndex: 3,
          display: 'block',
          opacity: 1,
          scale: 1,
        }
      : {}),
  })
)

const NumberText = styled('span')<RootStyles & { isSelected?: boolean }>(
  ({ settings: { fontSizeScale, fontFamily } }) => ({
    fontSize: scaleFontSize(15, fontSizeScale),
    position: 'relative',
    // bottom: 20,
    fontFamily,
    padding: '0 5px',

    display: 'inline-flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
  })
)

const Hebreu = styled('div')<RootStyles & { isSelected?: boolean }>(
  ({ isSelected, settings: { fontSizeScale, theme, colors, fontFamily } }) => ({
    fontSize: scaleFontSize(18, fontSizeScale),
    fontFamily,
    color: colors[theme].tertiary,

    ...(isSelected
      ? {
          color: colors[theme].reverse,
        }
      : {}),
  })
)

const AbsoluteHebreu = styled('div')<RootStyles & { isSelected?: boolean }>(
  ({ settings: { fontSizeScale, theme, colors, fontFamily } }) => ({
    fontSize: scaleFontSize(16, fontSizeScale),
    fontFamily,
    color: colors[theme].primary,
  })
)

const Code = styled('div')<RootStyles & { isSelected?: boolean }>(
  ({ settings: { fontSizeScale, colors, theme } }) => ({
    fontSize: scaleFontSize(10, fontSizeScale),
    fontFamily: 'arial',
    color: colors[theme].default,
    opacity: 0.3,
  })
)

const VerseText = styled('div')<RootStyles & { isSelected?: boolean }>(
  ({ settings: { fontSizeScale, theme, colors, fontFamily } }) => ({
    fontSize: scaleFontSize(16, fontSizeScale),
    lineHeight: scaleFontSize(25, fontSizeScale),
    fontFamily,
    direction: 'ltr',
    textAlign: 'left',
    padding: '10px',
    margin: '10px 0',
    background: colors[theme].lightGrey,
    borderRadius: '4px',
    position: 'relative',
    paddingRight: '30px',
  })
)

const CloseVerseText = styled('div')(() => ({
  width: '30px',
  height: '30px',
  top: '5px',
  right: '5px',
  position: 'absolute',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '17px',
  webkitTouchCallout: 'none',
  mozUserSelect: 'none',
  msUserSelect: 'none',
  khtmlUserSelect: 'none',
  webkitUserSelect: 'none',
}))

const Mot = styled('div')<RootStyles & { isSelected?: boolean }>(
  ({ settings: { fontSizeScale, theme, colors, fontFamily } }) => ({
    fontSize: scaleFontSize(14, fontSizeScale),
    fontFamily,
    color: colors[theme].default,
  })
)

const Phonetique = styled('div')<RootStyles & { isSelected?: boolean }>(
  ({ settings: { fontSizeScale, theme, colors, fontFamily } }) => ({
    fontSize: scaleFontSize(14, fontSizeScale),
    fontFamily,
    color: colors[theme].tertiary,
  })
)

const ParsingTag = styled('div')<RootStyles & { isSelected?: boolean }>(
  ({ settings: { fontSizeScale, colors, theme } }) => ({
    fontSize: scaleFontSize(10, fontSizeScale),
    lineHeight: scaleFontSize(20, fontSizeScale),
    fontFamily: 'arial',
    color: colors[theme].default,
    opacity: 0.3,
  })
)

interface Props {
  verse: Verse
  settings: RootState['user']['bible']['settings']
  isHebreu: boolean
  secondaryVerse?: Verse | null
  selectedCode?: SelectedCode | null
}

const InterlinearVerse = ({ verse, settings, isHebreu, secondaryVerse, selectedCode }: Props) => {
  const dispatch = useDispatch()
  const [showSecondaryVerse, setShowSecondaryVerse] = useState(false)

  const navigateToStrong = (reference: string, isHebreu: boolean) => {
    dispatch({
      type: NAVIGATE_TO_STRONG,
      payload: { reference, book: isHebreu ? 1 : 40 },
    })
  }

  const sections = verse.Texte.split('@')
  return (
    <Wrapper settings={settings} id={`verset-${verse.Verset}`}>
      {secondaryVerse && showSecondaryVerse && (
        <VerseText settings={settings}>
          <CloseVerseText onClick={() => setShowSecondaryVerse(false)}>✕</CloseVerseText>
          {secondaryVerse.Verset} {secondaryVerse.Texte}
        </VerseText>
      )}
      <NumberText settings={settings}>{verse.Verset} </NumberText>
      {sections.map((section, i) => {
        const [code, hebreu, mot, parsingTag, phonetique] = section.split('#')
        const isSelected = selectedCode?.reference?.toString() === code

        return (
          <div key={i} style={{ position: 'relative', display: 'inline-block' }}>
            <AbsoluteSection settings={settings} isSelected={isSelected}>
              <Code settings={settings}>{code}</Code>
              <AbsoluteHebreu settings={settings}>{hebreu}</AbsoluteHebreu>
              <Mot settings={settings}>{mot}</Mot>
              {phonetique && <Phonetique settings={settings}>{phonetique}</Phonetique>}
              {parsingTag && <ParsingTag settings={settings}>{parsingTag}</ParsingTag>}
            </AbsoluteSection>
            <Section onClick={() => navigateToStrong(code, isHebreu)} settings={settings}>
              <Hebreu isSelected={isSelected} settings={settings}>
                {hebreu}
              </Hebreu>
            </Section>
          </div>
        )
      })}
    </Wrapper>
  )
}

export default InterlinearVerse
