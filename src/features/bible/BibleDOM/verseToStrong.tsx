import type React from 'react'
import { styled } from 'goober'
import { RootStyles } from './BibleDOMWrapper'
import { useDispatch } from './DispatchProvider'
import { SelectedCode, Verse } from '~common/types'
import { RootState } from '~redux/modules/reducer'
import { scaleFontSize } from './scaleFontSize'
import { isDarkTheme, noSelect } from './utils'
import { getDisabledStyles } from './disabledStyles'
import { scaleLineHeight } from './scaleLineHeight'
import { getStrongReferenceNumber } from '~helpers/strongIdentities'
import { dispatchStrongSelection } from './strongSelectionAction'

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
  version,
  references,
  isParallel,
  isDisabled,
  selectedCode,
  settings,
}: {
  book: string | number
  version: string
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
  const isSelected =
    numericReferences.length > 0 &&
    numericReferences.includes(getStrongReferenceNumber(selectedCode?.reference ?? '') ?? '')

  const openStrongSelection = (event: React.MouseEvent<HTMLSpanElement>) => {
    event.stopPropagation()
    dispatchStrongSelection(dispatch, references, book, version)
  }

  return (
    <StyledReference
      onClick={openStrongSelection}
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
  version,
  isParallel,
  isDisabled,
  selectedCode,
  settings,
}: Pick<Verse, 'Texte' | 'Livre'> & {
  version: string
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
          version={version}
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
