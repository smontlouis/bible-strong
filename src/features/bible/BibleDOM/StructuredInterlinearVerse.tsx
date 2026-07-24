import { NAVIGATE_TO_STRONG } from './dispatch'
import { useDispatch } from './DispatchProvider'
import { scaleFontSize } from './scaleFontSize'
import type { SelectedCode, Verse } from '~common/types'
import type { RootState } from '~redux/modules/reducer'
import { buildInterlinearVerseLayout } from '~helpers/interlinearVerseLayout'

interface Props {
  verse: Verse
  settings: RootState['user']['bible']['settings']
  isHebreu: boolean
  selectedCode?: SelectedCode | null
}

const StructuredInterlinearVerse = ({ verse, settings, isHebreu, selectedCode }: Props) => {
  const dispatch = useDispatch()
  const colors = settings.colors[settings.theme]
  const tokens = verse.InterlinearTokens ?? []
  const navigateToStrong = (reference?: string) => {
    if (!reference) return
    const numericReference = reference.match(/\d+/u)?.[0]
    if (!numericReference) return
    dispatch({
      type: NAVIGATE_TO_STRONG,
      payload: { reference: `${Number(numericReference)}`, book: isHebreu ? 1 : 40 },
    })
  }
  const layout = buildInterlinearVerseLayout(verse.Texte, tokens)

  return (
    <>
      {layout.pieces.map(({ prefix, surface, token }) => {
        const identities = token.segments.flatMap(segment => segment.identities)
        const preferredIdentity =
          identities.find(identity => identity.kind === 'strong') ??
          identities.find(identity => identity.kind === 'dstrong') ??
          identities[0]
        const selected = identities.some(
          identity => Number(selectedCode?.reference) === Number(identity.code.match(/\d+/u)?.[0])
        )
        const line = (values: string[]) => [...new Set(values.filter(Boolean))].join(' · ')

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
                alignItems: 'center',
                gap: 3,
                margin: '3px 2px 10px',
                padding: '5px 6px',
                verticalAlign: 'top',
                fontFamily: settings.fontFamily,
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
                {line(
                  identities.map(identity => {
                    const label = {
                      strong: 'S',
                      estrong: 'E',
                      dstrong: 'D',
                      ustrong: 'U',
                    }[identity.kind]
                    return `${label}:${identity.code}`
                  })
                )}
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
