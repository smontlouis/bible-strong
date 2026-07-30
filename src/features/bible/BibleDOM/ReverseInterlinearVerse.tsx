import type { SelectedCode, Verse } from '~common/types'
import type { RootState } from '~redux/modules/reducer'
import { buildTokenizedVerseLayout } from '~helpers/interlinearVerseLayout'
import {
  getStrongReferenceNumber,
  resolveDisplayedStrongIdentities,
  type StrongIdentity,
} from '~helpers/strongIdentities'
import {
  collectStrongSelectionMorphologies,
  type StrongSelectionMorphology,
} from '~helpers/strongSelection'

import { useDispatch } from './DispatchProvider'
import { scaleFontSize } from './scaleFontSize'
import {
  dispatchStrongSelection,
  getStrongSelectionWordFromTextSegment,
} from './strongSelectionAction'
import UntranslatedStrongMarker from './UntranslatedStrongMarker'

interface Props {
  verse: Verse
  version: string
  settings: RootState['user']['bible']['settings']
  selectedCode?: SelectedCode | null
  isParallel: boolean
}

const ReverseInterlinearVerse = ({ verse, version, settings, selectedCode, isParallel }: Props) => {
  const dispatch = useDispatch()
  const colors = settings.colors[settings.theme]
  const isHebrew = Number(verse.Livre) <= 39
  const layout = buildTokenizedVerseLayout(verse.Texte, verse.ReverseInterlinearSpans ?? [])
  const uniqueLine = (values: string[], separator = ' · ') =>
    [...new Set(values.filter(Boolean))].join(separator)

  const openStrongSelection = (
    identities: StrongIdentity[],
    word: string,
    morphologies: StrongSelectionMorphology[]
  ) => {
    dispatchStrongSelection(dispatch, identities, verse.Livre, version, {
      word,
      chapter: verse.Chapitre,
      verse: verse.Verset,
      morphologies,
    })
  }

  return (
    <>
      {layout.pieces.map(({ prefix, surface, token }) => {
        const segments = token.sourceTokens.flatMap(sourceToken => sourceToken.segments)
        const identities = segments.flatMap(segment => segment.identities)
        const displayedIdentities = resolveDisplayedStrongIdentities(token.identities, identities)
        const preferredIdentity = displayedIdentities[0] ?? token.identities[0]
        const selectionIdentities = displayedIdentities.length
          ? displayedIdentities
          : preferredIdentity
            ? [preferredIdentity]
            : []
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
        const selectionWord = surface
          ? (getStrongSelectionWordFromTextSegment(`${prefix}${surface}`) ?? surface)
          : ''
        const selectionMorphologies = collectStrongSelectionMorphologies(
          selectionIdentities,
          segments
        )

        return (
          <span key={`${token.ordinal}:${token.startOffset}`}>
            {prefix}
            <button
              type="button"
              aria-label={selectionIdentities.map(identity => identity.code).join(' · ')}
              data-ignore-verse-touch
              disabled={!preferredIdentity}
              onClick={() =>
                openStrongSelection(selectionIdentities, selectionWord, selectionMorphologies)
              }
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
                {surface || (
                  <UntranslatedStrongMarker
                    color={selected ? colors.primary : 'transparent'}
                    backgroundColor={colors.lightPrimary}
                  />
                )}
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
