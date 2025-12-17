import { useContext } from 'react'
import { styled } from 'goober'
import VerseContext from './VerseContext'
import { NAVIGATE_TO_STRONG } from './dispatch'
import { RootStyles } from './BibleDOMWrapper'
import { useDispatch } from './DispatchProvider'
import { Verse } from '../../../../../common/types'

const StyledReference = styled('div')<RootStyles & { isSelected: boolean }>(
  ({ isSelected, settings: { theme, colors } }) => ({
    display: 'inline-block',
    transition: 'background 0.3s ease',
    borderRadius: '4px',
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

const BibleStrongRef = ({ book, reference }: { book: string | number; reference: string }) => {
  const dispatch = useDispatch()
  const { selectedCode, settings, onTouchMove } = useContext(VerseContext)
  const isSelected = selectedCode?.reference == reference

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
}: Pick<Verse, 'Texte' | 'Livre'>): Promise<(string | JSX.Element)[]> =>
  new Promise(resolve => {
    // STRONG
    const splittedTexte = Texte.split(/(\d+[^{.|\s}]?\d+(?!\.?\d))/g).map((item, i) => {
      if (Number.isInteger(Number(item))) {
        return <BibleStrongRef book={Livre} reference={item} key={i} />
      }

      return item
    })
    return resolve(splittedTexte)
  })

export default verseToStrong
