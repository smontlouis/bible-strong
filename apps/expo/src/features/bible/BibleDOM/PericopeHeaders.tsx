'use dom'

import { styled } from 'goober'
import type { PericopeChapter, RootStyles } from './BibleDOMWrapper'
import ExternalIcon from './ExternalIcon'
import { INTERFACE_FONT } from './interfaceFont'
import { scaleFontSize } from './scaleFontSize'
import { getCompactHeadingFontSize } from './verseTypography'
import {
  getCanonicalBibleHeadingReferences,
  type CanonicalBibleHeading,
} from '~helpers/canonicalBibleHeadings'
import { OPEN_CANONICAL_BIBLE_REFERENCE } from './dispatch'
import { useDispatch } from './DispatchProvider'
import { useTranslations } from './TranslationsContext'

const pericopeHeading = (tag: 'h1' | 'h2' | 'h3' | 'h4', level: 1 | 2 | 3 | 4, size: number) =>
  styled(tag)<RootStyles & { $compact?: boolean }>(({ settings: { fontSizeScale }, $compact }) => ({
    // The app's font, not the Bible text's
    fontFamily: INTERFACE_FONT,
    fontSize: $compact
      ? getCompactHeadingFontSize(level, fontSizeScale)
      : scaleFontSize(size, fontSizeScale),
    ...($compact ? { marginBlock: '0.5em 0.35em' } : {}),
    textAlign: 'start',
    position: 'relative',
    zIndex: 1,
  }))

const H1 = pericopeHeading('h1', 1, 28)
const H2 = pericopeHeading('h2', 2, 24)
const H3 = pericopeHeading('h3', 3, 20)
const H4 = pericopeHeading('h4', 4, 18)

export const hasPericopeHeadings = ({ h1, h2, h3, h4 }: ReturnType<typeof getPericopeVerse>) =>
  Boolean(h1 || h2 || h3 || h4)

export const getPericopeVerse = (pericopeChapter: PericopeChapter | undefined, verse: number) => {
  if (pericopeChapter && pericopeChapter[verse]) {
    return pericopeChapter[verse]
  }
  return {}
}

/**
 * Renders pericope headers (h1-h4) for a verse.
 * In normal mode, only canonical verse references and the external icon are clickable.
 * In annotation mode, headers are plain text.
 */
export function PericopeHeaders({
  pericope,
  headings,
  settings,
  annotationMode,
  navigateToPericope,
  isCompact,
}: {
  pericope: ReturnType<typeof getPericopeVerse>
  headings?: CanonicalBibleHeading[]
  settings: RootStyles['settings']
  annotationMode?: boolean
  navigateToPericope: () => void
  // Narrow parallel columns: sizes close to the text, tighter margins
  isCompact?: boolean
}): JSX.Element | null {
  const { h1, h2, h3, h4 } = pericope
  const dispatch = useDispatch()
  const translations = useTranslations()
  if (!h1 && !h2 && !h3 && !h4) return null

  const renderHeadingContent = (text: string) => {
    if (annotationMode) return text

    const canonicalHeading = headings?.find(heading => heading.text.trim() === text)
    if (!canonicalHeading) return text

    const references = getCanonicalBibleHeadingReferences(canonicalHeading)
    if (!references.length) return text

    let cursor = 0
    return (
      <>
        {references.map(reference => {
          const before = text.slice(cursor, reference.start)
          cursor = reference.end
          return (
            <span key={`${reference.start}-${reference.osis}`}>
              {before}
              <a
                href={`#${reference.osis}`}
                style={{
                  color: settings.colors[settings.theme].primary,
                  textDecoration: 'underline',
                }}
                onClick={event => {
                  event.preventDefault()
                  event.stopPropagation()
                  dispatch({
                    type: OPEN_CANONICAL_BIBLE_REFERENCE,
                    payload: reference.osis,
                  })
                }}
              >
                {reference.text}
              </a>
            </span>
          )
        })}
        {text.slice(cursor)}
      </>
    )
  }

  const renderExternalButton = () => (
    <button
      type="button"
      aria-label={translations.pericopeIndex}
      onClick={navigateToPericope}
      style={{
        appearance: 'none',
        background: 'transparent',
        border: 0,
        cursor: 'pointer',
        margin: 0,
        padding: 0,
      }}
    >
      <ExternalIcon style={{ marginLeft: 10, verticalAlign: 'middle' }} />
    </button>
  )
  const stopHeadingClick = (event: React.MouseEvent<HTMLHeadingElement>) => {
    event.stopPropagation()
  }

  return (
    <>
      {h1 && (
        <H1
          settings={settings}
          $compact={isCompact}
          data-ignore-verse-touch
          onClick={stopHeadingClick}
        >
          {renderHeadingContent(h1)}
          {!annotationMode && renderExternalButton()}
        </H1>
      )}
      {h2 && (
        <H2
          settings={settings}
          $compact={isCompact}
          data-ignore-verse-touch
          onClick={stopHeadingClick}
        >
          {renderHeadingContent(h2)}
          {!annotationMode && renderExternalButton()}
        </H2>
      )}
      {h3 && (
        <H3
          settings={settings}
          $compact={isCompact}
          data-ignore-verse-touch
          onClick={stopHeadingClick}
        >
          {renderHeadingContent(h3)}
          {!annotationMode && renderExternalButton()}
        </H3>
      )}
      {h4 && (
        <H4
          settings={settings}
          $compact={isCompact}
          data-ignore-verse-touch
          onClick={stopHeadingClick}
        >
          {renderHeadingContent(h4)}
          {!annotationMode && renderExternalButton()}
        </H4>
      )}
    </>
  )
}
