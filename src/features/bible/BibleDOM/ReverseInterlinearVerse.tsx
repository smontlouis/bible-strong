import type { SelectedCode, Verse } from '~common/types'
import type { RootState } from '~redux/modules/reducer'
import { buildTokenizedVerseLayout } from '~helpers/interlinearVerseLayout'
import {
  getStrongReferenceNumber,
  resolveDisplayedStrongIdentities,
} from '~helpers/strongIdentities'

import { NAVIGATE_TO_STRONG } from './dispatch'
import { useDispatch } from './DispatchProvider'
import { scaleFontSize } from './scaleFontSize'

interface Props {
  verse: Verse
  settings: RootState['user']['bible']['settings']
  selectedCode?: SelectedCode | null
  isParallel: boolean
}

const ReverseInterlinearVerse = ({ verse, settings, selectedCode, isParallel }: Props) => {
  const dispatch = useDispatch()
  const colors = settings.colors[settings.theme]
  const isHebrew = Number(verse.Livre) <= 39
  const layout = buildTokenizedVerseLayout(verse.Texte, verse.ReverseInterlinearSpans ?? [])
  const uniqueLine = (values: string[], separator = ' · ') =>
    [...new Set(values.filter(Boolean))].join(separator)

  const navigateToStrong = (reference?: string) => {
    const numericReference = getStrongReferenceNumber(reference ?? '')
    if (!numericReference) return
    dispatch({
      type: NAVIGATE_TO_STRONG,
      payload: { reference: numericReference, book: isHebrew ? 1 : 40 },
    })
  }

  return (
    <>
      {layout.pieces.map(({ prefix, surface, token }) => {
        const segments = token.sourceTokens.flatMap(sourceToken => sourceToken.segments)
        const identities = segments.flatMap(segment => segment.identities)
        const displayedIdentities = resolveDisplayedStrongIdentities(token.identities, identities)
        const preferredIdentity = displayedIdentities[0] ?? token.identities[0]
        const selectedReference = getStrongReferenceNumber(selectedCode?.reference ?? '')
        const selected =
          selectedReference !== undefined &&
          [...identities, ...token.identities].some(
            identity => selectedReference === getStrongReferenceNumber(identity.code)
          )
        const original = uniqueLine(
          token.sourceTokens.map(sourceToken => sourceToken.surface),
          ' '
        )
        const transliteration = uniqueLine(segments.map(segment => segment.transliteration))
        const morphology = uniqueLine(segments.map(segment => segment.morphology))
        const strongReferences = uniqueLine(displayedIdentities.map(identity => identity.code))

        return (
          <span key={`${token.ordinal}:${token.startOffset}`}>
            {prefix}
            <button
              type="button"
              data-ignore-verse-touch
              disabled={!preferredIdentity}
              onClick={() => navigateToStrong(preferredIdentity?.code)}
              style={{
                appearance: 'none',
                border: 0,
                borderRadius: 6,
                background: selected ? colors.primary : 'transparent',
                color: selected ? colors.reverse : colors.default,
                display: 'inline-flex',
                flexDirection: 'column',
                direction: 'ltr',
                alignItems: 'flex-start',
                gap: 3,
                margin: '3px 2px 10px',
                padding: '5px 6px',
                verticalAlign: 'baseline',
                fontFamily: settings.fontFamily,
                fontSize: scaleFontSize(isParallel ? 16 : 17, settings.fontSizeScale),
                textAlign: 'left',
              }}
            >
              <span
                style={{
                  fontSize: 'inherit',
                  fontWeight: 600,
                  lineHeight: 1.2,
                }}
              >
                {surface}
              </span>
              {original && (
                <span
                  dir={isHebrew ? 'rtl' : 'ltr'}
                  style={{
                    color: selected ? colors.reverse : colors.primary,
                    fontSize: scaleFontSize(17, settings.fontSizeScale),
                    lineHeight: 1.2,
                  }}
                >
                  {original}
                </span>
              )}
              {transliteration && (
                <span
                  style={{
                    color: selected ? colors.reverse : colors.tertiary,
                    fontSize: scaleFontSize(11, settings.fontSizeScale),
                    lineHeight: 1.2,
                  }}
                >
                  {transliteration}
                </span>
              )}
              {morphology && (
                <span
                  style={{
                    opacity: 0.55,
                    fontFamily: 'Arial',
                    fontSize: scaleFontSize(9, settings.fontSizeScale),
                    lineHeight: 1.2,
                  }}
                >
                  {morphology}
                </span>
              )}
              {strongReferences && (
                <span
                  style={{
                    color: selected ? colors.reverse : colors.tertiary,
                    fontFamily: 'Arial',
                    fontSize: scaleFontSize(9, settings.fontSizeScale),
                    lineHeight: 1.2,
                  }}
                >
                  {strongReferences}
                </span>
              )}
            </button>
          </span>
        )
      })}
      {layout.trailing}
    </>
  )
}

export default ReverseInterlinearVerse
