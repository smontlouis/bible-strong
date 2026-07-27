import type React from 'react'
import { styled } from 'goober'
import { NAVIGATE_TO_STRONG } from './dispatch'
import { RootStyles } from './BibleDOMWrapper'
import { useDispatch } from './DispatchProvider'
import { SelectedCode, Verse } from '~common/types'
import { RootState } from '~redux/modules/reducer'
import { scaleFontSize } from './scaleFontSize'
import { isDarkTheme, noSelect } from './utils'
import { getDisabledStyles } from './disabledStyles'
import { scaleLineHeight } from './scaleLineHeight'
import { getStrongReferenceNumber } from '~helpers/strongIdentities'

const StyledReference = styled('span')<
  RootStyles & { isSelected: boolean; isParallel?: boolean; isDisabled?: boolean }
>(
  ({
    isSelected,
    isParallel,
    isDisabled,
    settings: { theme, colors, fontFamily, fontSizeScale, lineHeight },
  }) => ({
    fontFamily,
    ...noSelect,
    color: isSelected ? colors[theme].reverse : colors[theme].primary,
    backgroundColor: isSelected ? colors[theme].primary : 'inherit',
    fontSize: scaleFontSize(isParallel ? 14 : 16, fontSizeScale),
    lineHeight: scaleLineHeight(isParallel ? 24 : 30, lineHeight, fontSizeScale),
    boxShadow: isDarkTheme(theme)
      ? `0 0 10px 0 rgba(255, 255, 255, 0.1)`
      : `0 0 10px 0 rgba(0, 0, 0, 0.2)`,
    borderRadius: '8px',
    paddingInlineEnd: '4px',
    paddingInlineStart: '4px',
    paddingBlock: '4px',
    wordBreak: 'break-word',
    marginInline: '4px',

    cursor: 'pointer',
    '&:active': {
      opacity: 0.6,
    },
    ...getDisabledStyles(isDisabled),
  })
)

export const BibleStrongRef = ({
  book,
  references,
  isParallel,
  isDisabled,
  selectedCode,
  settings,
}: {
  book: string | number
  references: string[]
  isParallel?: boolean
  isDisabled?: boolean
  selectedCode?: SelectedCode | null
  settings: RootState['user']['bible']['settings']
}) => {
  const dispatch = useDispatch()
  const numericReferences = references.flatMap(reference => {
    const numericReference = getStrongReferenceNumber(reference)
    return numericReference ? [numericReference] : []
  })
  const numericReference = numericReferences[0]
  const isSelected =
    numericReferences.length > 0 &&
    numericReferences.includes(getStrongReferenceNumber(selectedCode?.reference ?? '') ?? '')

  const navigateToStrong = (event: React.MouseEvent<HTMLSpanElement>) => {
    event.stopPropagation()
    if (!numericReference) return
    dispatch({
      type: NAVIGATE_TO_STRONG,
      payload: { reference: numericReference, book },
    })
  }

  return (
    <StyledReference
      onClick={navigateToStrong}
      data-ignore-verse-touch
      isSelected={isSelected}
      isParallel={isParallel}
      isDisabled={isDisabled}
      settings={settings}
    >
      {references.join(' · ')}
    </StyledReference>
  )
}

const verseToStrong = ({
  Texte,
  Livre,
  isParallel,
  isDisabled,
  selectedCode,
  settings,
}: Pick<Verse, 'Texte' | 'Livre'> & {
  isParallel?: boolean
  isDisabled?: boolean
  selectedCode?: SelectedCode | null
  settings: RootState['user']['bible']['settings']
}): (string | JSX.Element)[] => {
  return Texte.split(/(\d+[^{.|\s}]?\d+(?!\.?\d))/g).map((item, i) => {
    if (Number.isInteger(Number(item))) {
      return (
        <BibleStrongRef
          book={Livre}
          references={[item]}
          key={i}
          isParallel={isParallel}
          isDisabled={isDisabled}
          selectedCode={selectedCode}
          settings={settings}
        />
      )
    }
    return item
  })
}

export default verseToStrong
