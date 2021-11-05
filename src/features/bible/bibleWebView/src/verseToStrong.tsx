import { useContext } from 'preact/hooks'
import { styled } from 'goober'
import VerseContext from './VerseContext'
import { dispatch, NAVIGATE_TO_STRONG } from './dispatch'
import { PropsWithDiv, Verse as VerseProps } from './types'
import Verse from './Verse'

const StyledReference = styled('div')(
  ({
    isSelected,
    settings: { theme, colors },
  }: PropsWithDiv<{ isSelected: boolean }>) => ({
    display: 'inline-block',
    transition: 'background 0.3s ease',
    borderRadius: 4,
    padding: '0 5px',
    background: colors[theme].lightPrimary,

    ...(isSelected
      ? {
          background: colors[theme].primary,
          color: 'white',
        }
      : {}),
  })
)

const BibleStrongRef = ({
  book,
  reference,
}: {
  book: string
  reference: string
}) => {
  const { selectedCode, settings, onTouchMove } = useContext(VerseContext)
  const isSelected =
    selectedCode?.reference?.toString() === reference ||
    selectedCode?.reference == Number(reference)

  const navigateToStrong = () => {
    dispatch({
      type: NAVIGATE_TO_STRONG,
      payload: { reference: `${Number(reference)}`, book },
    })
  }

  return (
    <StyledReference
      onTouchStart={onTouchMove}
      onTouchEnd={onTouchMove}
      onClick={navigateToStrong}
      isSelected={isSelected}
      settings={settings}
    >
      {reference}
    </StyledReference>
  )
}

const verseToStrong = ({
  Texte,
  Livre,
}: Pick<VerseProps, 'Texte' | 'Livre'>): Promise<(string | JSX.Element)[]> =>
  new Promise(resolve => {
    // STRONG
    const splittedTexte = Texte.split(/(\d+[^{.|\s}]?\d+(?!\.?\d))/g).map(
      (item, i) => {
        if (Number.isInteger(Number(item))) {
          return <BibleStrongRef book={Livre} reference={item} key={i} />
        }

        return item
      }
    )
    return resolve(splittedTexte)
  })

export default verseToStrong
