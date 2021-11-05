import { Component } from 'preact'
import { keyframes, styled } from 'goober'
import {
  Verse as VerseProps,
  Settings,
  Notes,
  SelectedCode,
  TagProps,
} from './types'

import {
  dispatch,
  NAVIGATE_TO_BIBLE_VERSE_DETAIL,
  NAVIGATE_TO_VERSE_NOTES,
  TOGGLE_SELECTED_VERSE,
  NAVIGATE_TO_BIBLE_NOTE,
  CONSOLE_LOG,
} from './dispatch'

import { scaleFontSize } from './scaleFontSize'
import NotesCount from './NotesCount'
import NotesText from './NotesText'
import VerseTextFormatting from './VerseTextFormatting'
import InterlinearVerseComplete from './InterlinearVerseComplete'
import InterlinearVerse from './InterlinearVerse'
import { PropsWithDiv } from './types'
import VerseTags from './VerseTags'

function convertHex(hex: string, opacity: number) {
  hex = hex.replace('#', '')
  const r = parseInt(hex.substring(0, 2), 16)
  const g = parseInt(hex.substring(2, 4), 16)
  const b = parseInt(hex.substring(4, 6), 16)

  const result = `rgba(${r},${g},${b},${opacity / 100})`
  return result
}

const VerseText = styled('span')(
  ({
    isParallel,
    settings: { fontSizeScale },
  }: PropsWithDiv<{ isParallel: boolean }>) => ({
    fontSize: scaleFontSize(isParallel ? 16 : 19, fontSizeScale),
    lineHeight: scaleFontSize(isParallel ? 26 : 32, fontSizeScale),
  })
)

const NumberText = styled('span')(
  ({
    isFocused,
    settings: { fontSizeScale },
  }: PropsWithDiv<{ isFocused: boolean }>) => ({
    fontSize: scaleFontSize(14, fontSizeScale),
  })
)

const zoom = keyframes({
  '0%': {
    background: convertHex('#95afc0', 0),
  },
  '50%': {
    background: convertHex('#95afc0', 30),
  },
  '100%': {
    background: convertHex('#95afc0', 0),
  },
})

export const ContainerText = styled('span')(
  ({
    isFocused,
    isTouched,
    isSelected,
    highlightedColor,
    isVerseToScroll,
    settings: { theme, colors, fontFamily },
  }: PropsWithDiv<{
    isFocused: boolean
    isTouched: boolean
    isSelected: boolean
    highlightedColor: string
    isVerseToScroll: boolean
  }>) => {
    let background = 'transparent'

    if (highlightedColor && !isSelected) {
      const hexColor = colors[theme][highlightedColor]
      background = convertHex(hexColor, 50)
    }
    if (isTouched) {
      background = 'rgba(0,0,0,0.1)'
    }
    return {
      fontFamily,
      transition: 'background 0.3s ease',
      background,
      padding: '4px',
      borderBottom: isSelected ? '2px dashed rgb(52,73,94)' : 'none',
      WebkitTouchCallout: 'none',
      MozUserSelect: 'none',
      msUserSelect: 'none',
      KhtmlUserSelect: 'none',
      WebkitUserSelect: 'none',
      ...(isVerseToScroll
        ? {
            animation: `0.75s ease 0s 3 normal none running ${zoom}`,
          }
        : {}),
      ...(isFocused === false
        ? {
            opacity: 0.5,
          }
        : {}),
    }
  }
)

export const Wrapper = styled('span')(
  ({ settings: { textDisplay } }: PropsWithDiv<{}>) => ({
    display: textDisplay,
    ...(textDisplay === 'block'
      ? {
          marginBottom: '5px',
        }
      : {}),
  })
)

const Spacer = styled('div')(() => ({
  marginTop: 5,
}))

interface Props {
  verse: VerseProps
  isSelectedMode: boolean
  isSelectionMode:
    | 'inline-verse'
    | 'block-verse'
    | 'inline-strong'
    | 'block-strong'
  settings: Settings

  parallelVerse?: { verse: VerseProps; version: string }[]
  secondaryVerse?: VerseProps
  isSelected: boolean
  highlightedColor: string
  notesCount: number
  isVerseToScroll: boolean
  notesText: Notes
  version: string
  isHebreu: boolean
  selectedCode: SelectedCode
  isFocused: boolean
  isParallel: boolean
  isParallelVerse?: boolean
  isINTComplete?: boolean
  tag: TagProps | undefined
}

class Verse extends Component<Props> {
  state = {
    isTouched: false,
  }

  detectScroll: any
  moved: boolean = false
  shouldShortPress: boolean = false
  buttonPressTimer: any

  componentDidMount() {
    this.detectScroll = window.addEventListener('scroll', () => {
      if (!this.moved) this.moved = true
    })
  }

  componentWillUnmount() {
    this.detectScroll = window.removeEventListener('scroll', this.detectScroll)
  }

  navigateToVerseNotes = () => {
    const {
      verse: { Livre, Chapitre, Verset },
    } = this.props
    dispatch({
      type: NAVIGATE_TO_VERSE_NOTES,
      payload: `${Livre}-${Chapitre}-${Verset}`,
    })
  }

  navigateToBibleVerseDetail = (additionnalParams = {}) => {
    dispatch({
      type: NAVIGATE_TO_BIBLE_VERSE_DETAIL,
      params: {
        ...additionnalParams,
        verse: this.props.verse,
      },
    })
  }

  navigateToNote = (id: string) => {
    dispatch({
      type: NAVIGATE_TO_BIBLE_NOTE,
      payload: id,
    })
  }

  onPress = () => {
    const {
      isSelectedMode,
      isSelectionMode,
      settings: { press },
    } = this.props

    // If selection mode verse, always toggle on press
    if (isSelectionMode && isSelectionMode.includes('verse')) {
      this.toggleSelectVerse()
      return
    }

    // If selection mode verse, always toggle on press
    if (isSelectionMode && isSelectionMode.includes('strong')) {
      this.navigateToBibleVerseDetail({ isSelectionMode })
      return
    }

    if (isSelectedMode || press === 'longPress') {
      this.toggleSelectVerse()
    } else {
      this.navigateToBibleVerseDetail()
    }
  }

  onLongPress = () => {
    const {
      settings: { press },
      isSelectionMode,
    } = this.props

    // If selection mode, do nothing on long press
    if (isSelectionMode) {
      return
    }

    this.shouldShortPress = false

    if (this.moved === false) {
      if (press === 'shortPress') {
        this.toggleSelectVerse()
      } else {
        this.setState({ isTouched: false })
        this.navigateToBibleVerseDetail()
      }
    }
  }

  toggleSelectVerse = () => {
    const {
      verse: { Livre, Chapitre, Verset },
    } = this.props
    dispatch({
      type: TOGGLE_SELECTED_VERSE,
      payload: `${Livre}-${Chapitre}-${Verset}`,
    })
  }

  onTouchStart = () => {
    this.shouldShortPress = true
    this.moved = false

    this.setState({ isTouched: true })

    // On long press
    this.buttonPressTimer = setTimeout(this.onLongPress, 400)
  }

  onTouchEnd = () => {
    this.setState({ isTouched: false })
    clearTimeout(this.buttonPressTimer)

    if (this.shouldShortPress && this.moved === false) {
      this.onPress()
    }
  }

  onTouchCancel = () => {
    clearTimeout(this.buttonPressTimer)
  }

  onTouchMove = () => {
    this.moved = true
    if (this.state.isTouched) this.setState({ isTouched: false })
  }

  render() {
    const {
      verse,
      parallelVerse,
      secondaryVerse,
      isSelected,
      highlightedColor,
      notesCount,
      settings,
      isVerseToScroll,
      notesText,
      isSelectionMode,
      version,
      isHebreu,
      selectedCode,
      isSelectedMode,
      isFocused,
      isParallel,
      isParallelVerse,
      isINTComplete,
      tag,
    } = this.props
    const { isTouched } = this.state

    const inlineNotedVerses = settings.notesDisplay === 'inline'

    if (isParallelVerse && parallelVerse) {
      return (
        <div style={{ display: 'flex' }}>
          {parallelVerse.map((p, i) => {
            if (!p.verse) {
              return null
            }
            return (
              <div
                key={i}
                style={{
                  flex: 1,
                  padding: '5px 0',
                  paddingLeft: i === 0 ? '0px' : '10px',
                }}
              >
                <Verse
                  isParallel
                  isHebreu={isHebreu}
                  verse={p.verse}
                  version={p.version}
                  settings={settings}
                  isSelected={isSelected}
                  isSelectedMode={isSelectedMode}
                  isSelectionMode={isSelectionMode}
                  highlightedColor={highlightedColor}
                  notesCount={notesCount}
                  notesText={notesText}
                  isVerseToScroll={isVerseToScroll}
                  selectedCode={selectedCode}
                  isFocused={isFocused}
                  tag={tag}
                />
              </div>
            )
          })}
        </div>
      )
    }

    if (version === 'LSGS' || version === 'KJVS') {
      return (
        <VerseTextFormatting
          isParallel={isParallel}
          selectedCode={selectedCode}
          verse={verse}
          settings={settings}
          isFocused={isFocused}
          isTouched={isTouched}
          isSelected={isSelected}
          isVerseToScroll={isVerseToScroll && Number(verse.Verset) !== 1}
          highlightedColor={highlightedColor}
          onTouchStart={this.onTouchStart}
          onTouchEnd={this.onTouchEnd}
          onTouchMove={this.onTouchMove}
          onTouchCancel={this.onTouchCancel}
          notesCount={notesCount}
          inlineNotedVerses={inlineNotedVerses}
          isSelectionMode={isSelectionMode}
          notesText={notesText}
          navigateToVerseNotes={this.navigateToVerseNotes}
          navigateToNote={this.navigateToNote}
          tag={tag}
        />
      )
    }

    if (version === 'INT') {
      if (isINTComplete) {
        return (
          <InterlinearVerseComplete
            secondaryVerse={secondaryVerse}
            isHebreu={isHebreu}
            settings={settings}
            verse={verse}
            selectedCode={selectedCode}
          />
        )
      }
      return (
        <InterlinearVerse
          secondaryVerse={secondaryVerse}
          isHebreu={isHebreu}
          settings={settings}
          verse={verse}
          selectedCode={selectedCode}
        />
      )
    }

    let array: (string | JSX.Element)[] = verse.Texte.split(/(\n)/g)

    if (array.length > 1) {
      array = array.map((c, i) => (c === '\n' ? <Spacer key={i} /> : c))
    }

    return (
      <Wrapper settings={settings} id={`verset-${verse.Verset}`}>
        <ContainerText
          isFocused={isFocused}
          settings={settings}
          isTouched={isTouched}
          isSelected={isSelected}
          isVerseToScroll={isVerseToScroll && Number(verse.Verset) !== 1}
          highlightedColor={highlightedColor}
        >
          <NumberText isFocused={isFocused} settings={settings}>
            {verse.Verset}{' '}
          </NumberText>
          {notesCount && !inlineNotedVerses && !isSelectionMode && (
            <NotesCount
              settings={settings}
              onClick={this.navigateToVerseNotes}
              count={notesCount}
            />
          )}
          <VerseText
            isParallel={isParallel}
            settings={settings}
            onTouchStart={this.onTouchStart}
            onTouchEnd={this.onTouchEnd}
            onTouchMove={this.onTouchMove}
            onTouchCancel={this.onTouchCancel}
          >
            {array}
          </VerseText>
          {tag && <VerseTags settings={settings} tag={tag} />}
        </ContainerText>
        {notesText && inlineNotedVerses && !isSelectionMode && (
          <NotesText
            isParallel={isParallel}
            settings={settings}
            onClick={this.navigateToNote}
            notesText={notesText}
          />
        )}
      </Wrapper>
    )
  }
}

export default Verse
