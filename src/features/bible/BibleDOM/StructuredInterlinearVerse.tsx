import { useDispatch } from './DispatchProvider'
import { scaleFontSize } from './scaleFontSize'
import type { SelectedCode, Verse } from '~common/types'
import type { RootState } from '~redux/modules/reducer'
import { buildInterlinearVerseLayout } from '~helpers/interlinearVerseLayout'
import { normalizeInterlinearMode, type InterlinearMode } from '~helpers/interlinearDisplayMode'
import {
  getDisplayedStrongIdentities,
  getStrongReferenceNumber,
  type StrongIdentity,
} from '~helpers/strongIdentities'
import { dispatchStrongSelection } from './strongSelectionAction'

interface Props {
  verse: Verse
  version: string
  settings: RootState['user']['bible']['settings']
  isHebreu: boolean
  selectedCode?: SelectedCode | null
  mode?: InterlinearMode
}

const StructuredInterlinearVerse = ({
  verse,
  version,
  settings,
  isHebreu,
  selectedCode,
  mode,
}: Props) => {
  const dispatch = useDispatch()
  const colors = settings.colors[settings.theme]
  const tokens = verse.InterlinearTokens ?? []
  const openStrongSelection = (identities: StrongIdentity[], word: string) => {
    dispatchStrongSelection(dispatch, identities, isHebreu ? 1 : 40, version, {
      word,
      chapter: verse.Chapitre,
      verse: verse.Verset,
    })
  }
  const layout = buildInterlinearVerseLayout(verse.Texte, tokens)
  const displayMode = normalizeInterlinearMode(mode)
  const line = (values: string[]) => [...new Set(values.filter(Boolean))].join(' · ')

  return (
    <>
      {layout.pieces.map(({ prefix, surface, token }) => {
        const identities = token.segments.flatMap(segment => segment.identities)
        const displayedIdentities = getDisplayedStrongIdentities(identities)
        const preferredIdentity = displayedIdentities[0] ?? identities[0]
        const selectionIdentities = displayedIdentities.length
          ? displayedIdentities
          : preferredIdentity
            ? [preferredIdentity]
            : []
        const selectedReference = getStrongReferenceNumber(selectedCode?.reference ?? '')
        const selected =
          selectedReference !== undefined &&
          identities.some(identity => selectedReference === getStrongReferenceNumber(identity.code))
        const transliteration = line(token.segments.map(segment => segment.transliteration))
        const displayedStrongReferences = line(displayedIdentities.map(identity => identity.code))

        if (displayMode === 'strong') {
          return (
            <span key={`${token.ordinal}:${token.startOffset}`}>
              {prefix}
              <button
                type="button"
                data-ignore-verse-touch
                disabled={!preferredIdentity}
                onClick={() => openStrongSelection(selectionIdentities, surface)}
                style={{
                  appearance: 'none',
                  border: 0,
                  borderRadius: 4,
                  background: selected ? colors.primary : 'transparent',
                  color: selected ? colors.reverse : colors.default,
                  display: 'inline',
                  margin: 0,
                  padding: '1px 2px',
                  fontFamily: settings.fontFamily,
                  fontSize: 'inherit',
                }}
              >
                <span dir={isHebreu ? 'rtl' : 'ltr'}>{surface}</span>
                {displayedStrongReferences && (
                  <sup
                    style={{
                      color: selected ? colors.reverse : colors.primary,
                      fontFamily: 'Arial',
                      fontSize: scaleFontSize(9, settings.fontSizeScale),
                      marginInlineStart: 2,
                    }}
                  >
                    {displayedStrongReferences}
                  </sup>
                )}
              </button>
            </span>
          )
        }

        if (displayMode === 'transliteration') {
          return (
            <span key={`${token.ordinal}:${token.startOffset}`}>
              {prefix}
              <button
                type="button"
                data-ignore-verse-touch
                disabled={!preferredIdentity}
                onClick={() => openStrongSelection(selectionIdentities, surface)}
                style={{
                  appearance: 'none',
                  border: 0,
                  borderRadius: 4,
                  background: selected ? colors.primary : 'transparent',
                  color: selected ? colors.reverse : colors.default,
                  display: 'inline',
                  margin: 0,
                  padding: '1px 2px',
                  fontFamily: settings.fontFamily,
                  fontSize: 'inherit',
                }}
              >
                {transliteration || surface}
              </button>
            </span>
          )
        }

        return (
          <span key={`${token.ordinal}:${token.startOffset}`}>
            {prefix}
            <button
              type="button"
              data-ignore-verse-touch
              disabled={!preferredIdentity}
              onClick={() => openStrongSelection(selectionIdentities, surface)}
              style={{
                appearance: 'none',
                border: 0,
                borderRadius: 6,
                background: selected ? colors.primary : 'transparent',
                color: selected ? colors.reverse : colors.default,
                display: 'inline-flex',
                flexDirection: 'column',
                // The Hebrew reader sets the whole chapter to RTL. Force a stable
                // flex axis here so flex-end stays the physical right edge; the
                // original word keeps its own RTL direction on the child span.
                direction: 'ltr',
                alignItems: isHebreu ? 'flex-end' : 'flex-start',
                gap: 3,
                margin: '3px 2px 10px',
                padding: '5px 6px',
                verticalAlign: 'top',
                fontFamily: settings.fontFamily,
                textAlign: isHebreu ? 'right' : 'left',
              }}
            >
              <span
                dir={isHebreu ? 'rtl' : 'ltr'}
                style={{
                  color: selected ? colors.reverse : colors.primary,
                  fontSize: scaleFontSize(19, settings.fontSizeScale),
                  lineHeight: 1.2,
                }}
              >
                {surface}
              </span>
              <span
                style={{
                  fontSize: scaleFontSize(13, settings.fontSizeScale),
                  lineHeight: 1.2,
                }}
              >
                {line(token.segments.map(segment => segment.gloss))}
              </span>
              <span
                style={{
                  color: selected ? colors.reverse : colors.tertiary,
                  fontSize: scaleFontSize(11, settings.fontSizeScale),
                  lineHeight: 1.2,
                }}
              >
                {line(token.segments.map(segment => segment.transliteration))}
              </span>
              <span
                style={{
                  opacity: 0.55,
                  fontFamily: 'Arial',
                  fontSize: scaleFontSize(9, settings.fontSizeScale),
                  lineHeight: 1.2,
                }}
              >
                {line(token.segments.map(segment => segment.morphology))}
              </span>
              <span
                style={{
                  color: selected ? colors.reverse : colors.tertiary,
                  fontFamily: 'Arial',
                  fontSize: scaleFontSize(9, settings.fontSizeScale),
                  lineHeight: 1.2,
                }}
              >
                {line(displayedIdentities.map(identity => identity.code))}
              </span>
            </button>
          </span>
        )
      })}
      {layout.trailing}
    </>
  )
}

export default StructuredInterlinearVerse
