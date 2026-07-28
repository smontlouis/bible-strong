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
import { getStrongReferenceNumber, type StrongIdentity } from '~helpers/strongIdentities'
import {
  dispatchStrongSelection,
  getStrongSelectionWordFromTextSegment,
} from './strongSelectionAction'
import type { StrongSelectionMorphology } from '~helpers/strongSelection'

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
  identities,
  morphologies,
  word,
  chapter,
  verse,
  isParallel,
  isDisabled,
  selectedCode,
  settings,
}: {
  book: string | number
  version: string
  identities: StrongIdentity[]
  morphologies?: StrongSelectionMorphology[]
  word?: string
  chapter?: string | number
  verse?: string | number
  isParallel?: boolean
  isDisabled?: boolean
  selectedCode?: SelectedCode | null
  settings: RootState['user']['bible']['settings']
}) => {
  const dispatch = useDispatch()
  const numericReferences = identities.flatMap(identity => {
    const numericReference = getStrongReferenceNumber(identity.code)
    return numericReference ? [numericReference] : []
  })
  const isSelected =
    numericReferences.length > 0 &&
    numericReferences.includes(getStrongReferenceNumber(selectedCode?.reference ?? '') ?? '')

  const openStrongSelection = (event: React.MouseEvent<HTMLSpanElement>) => {
    event.stopPropagation()
    dispatchStrongSelection(dispatch, identities, book, version, {
      word,
      chapter,
      verse,
      morphologies,
    })
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
      {identities.map(identity => identity.code).join(' · ')}
    </StyledReference>
  )
}

const verseToStrong = ({
  Texte,
  Livre,
  Chapitre,
  Verset,
  version,
  isParallel,
  isDisabled,
  selectedCode,
  settings,
}: Pick<Verse, 'Texte' | 'Livre' | 'Chapitre' | 'Verset'> & {
  version: string
  isParallel?: boolean
  isDisabled?: boolean
  selectedCode?: SelectedCode | null
  settings: RootState['user']['bible']['settings']
}): (string | JSX.Element)[] => {
  const parts = Texte.split(/(\d+[^{.|\s}]?\d+(?!\.?\d))/g)
  return parts.map((item, i) => {
    if (Number.isInteger(Number(item))) {
      const word = getStrongSelectionWordFromTextSegment(parts[i - 1])
      return (
        <BibleStrongRef
          book={Livre}
          version={version}
          identities={[{ kind: 'strong', code: item }]}
          word={word}
          chapter={Chapitre}
          verse={Verset}
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
