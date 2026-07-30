import type React from 'react'
import { styled } from 'goober'
import { RootStyles } from './BibleDOMWrapper'
import { useDispatch } from './DispatchProvider'
import { SelectedCode } from '~common/types'
import { RootState } from '~redux/modules/reducer'
import { scaleFontSize } from './scaleFontSize'
import { isDarkTheme, noSelect } from './utils'
import { getDisabledStyles } from './disabledStyles'
import { scaleLineHeight } from './scaleLineHeight'
import { getStrongReferenceNumber, type StrongIdentity } from '~helpers/strongIdentities'
import { dispatchStrongSelection } from './strongSelectionAction'
import type { StrongSelectionMorphology } from '~helpers/strongSelection'
import UntranslatedStrongMarker from './UntranslatedStrongMarker'

const StyledReference = styled('span')<
  RootStyles & {
    isSelected: boolean
    isParallel?: boolean
    isDisabled?: boolean
    $isUntranslated?: boolean
  }
>(
  ({
    isSelected,
    isParallel,
    isDisabled,
    $isUntranslated,
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
    ...($isUntranslated
      ? {
          width: scaleFontSize(24, fontSizeScale),
          height: scaleFontSize(24, fontSizeScale),
          padding: 0,
          borderRadius: '50%',
          boxShadow: 'none',
          backgroundColor: 'transparent',
          verticalAlign: 'middle',
        }
      : {}),

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
  const isUntranslated = !word
  const colors = settings.colors[settings.theme]

  const openStrongSelection = (
    event: React.MouseEvent<HTMLSpanElement> | React.KeyboardEvent<HTMLSpanElement>
  ) => {
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
      onKeyDown={event => {
        if (event.key === 'Enter' || event.key === ' ') openStrongSelection(event)
      }}
      role="button"
      tabIndex={isDisabled ? -1 : 0}
      aria-label={
        isUntranslated ? identities.map(identity => identity.code).join(' · ') : undefined
      }
      data-ignore-verse-touch
      isSelected={isSelected}
      isParallel={isParallel}
      isDisabled={isDisabled}
      $isUntranslated={isUntranslated}
      settings={settings}
    >
      {isUntranslated ? (
        <UntranslatedStrongMarker
          color={isSelected ? colors.primary : 'transparent'}
          backgroundColor={colors.lightPrimary}
        />
      ) : (
        identities.map(identity => identity.code).join(' · ')
      )}
    </StyledReference>
  )
}
