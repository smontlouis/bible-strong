'use dom'

import { styled } from 'goober'
import type { PericopeChapter, RootStyles } from './BibleDOMWrapper'
import ExternalIcon from './ExternalIcon'
import { scaleFontSize } from './scaleFontSize'
import {
  getCanonicalBibleHeadingReferences,
  type CanonicalBibleHeading,
} from '~helpers/canonicalBibleHeadings'
import { OPEN_CANONICAL_BIBLE_REFERENCE } from './dispatch'
import { useDispatch } from './DispatchProvider'
import { useTranslations } from './TranslationsContext'

const H1 = styled('h1')<RootStyles>(({ settings: { fontSizeScale, fontFamily } }) => ({
  fontFamily,
  fontSize: scaleFontSize(28, fontSizeScale),
  textAlign: 'start',
  position: 'relative',
  zIndex: 1,
}))

const H2 = styled('h2')<RootStyles>(({ settings: { fontSizeScale, fontFamily } }) => ({
  fontFamily,
  fontSize: scaleFontSize(24, fontSizeScale),
  textAlign: 'start',
  position: 'relative',
  zIndex: 1,
}))

const H3 = styled('h3')<RootStyles>(({ settings: { fontSizeScale, fontFamily } }) => ({
  fontFamily,
  fontSize: scaleFontSize(20, fontSizeScale),
  textAlign: 'start',
  position: 'relative',
  zIndex: 1,
}))

const H4 = styled('h4')<RootStyles>(({ settings: { fontSizeScale, fontFamily } }) => ({
  fontFamily,
  fontSize: scaleFontSize(18, fontSizeScale),
  textAlign: 'start',
  position: 'relative',
  zIndex: 1,
}))

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
}: {
  pericope: ReturnType<typeof getPericopeVerse>
  headings?: CanonicalBibleHeading[]
  settings: RootStyles['settings']
  annotationMode?: boolean
  navigateToPericope: () => void
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
        <H1 settings={settings} data-ignore-verse-touch onClick={stopHeadingClick}>
          {renderHeadingContent(h1)}
          {!annotationMode && renderExternalButton()}
        </H1>
      )}
      {h2 && (
        <H2 settings={settings} data-ignore-verse-touch onClick={stopHeadingClick}>
          {renderHeadingContent(h2)}
          {!annotationMode && renderExternalButton()}
        </H2>
      )}
      {h3 && (
        <H3 settings={settings} data-ignore-verse-touch onClick={stopHeadingClick}>
          {renderHeadingContent(h3)}
          {!annotationMode && renderExternalButton()}
        </H3>
      )}
      {h4 && (
        <H4 settings={settings} data-ignore-verse-touch onClick={stopHeadingClick}>
          {renderHeadingContent(h4)}
          {!annotationMode && renderExternalButton()}
        </H4>
      )}
    </>
  )
}
