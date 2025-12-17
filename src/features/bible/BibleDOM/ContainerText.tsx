import { keyframes, styled } from 'goober'
import { convertHex } from './convertHex'
import { RootStyles } from './BibleDOMWrapper'
const zoom = keyframes({
  '0%': {
    background: convertHex('#95afc0', 0),
  },
  '50%': {
    background: convertHex('#95afc0', 30),
  },
  '100%': {
    background: convertHex('#95afc0', 0),
  },
})

export const ContainerText = styled('span')<
  RootStyles & {
    isFocused?: boolean
    isTouched?: boolean
    isSelected?: boolean
    highlightedColor?: keyof RootStyles['settings']['colors'][keyof RootStyles['settings']['colors']]
    isVerseToScroll?: boolean
  }
>(({
  isFocused,
  isTouched,
  isSelected,
  highlightedColor,
  isVerseToScroll,
  settings: { theme, colors, fontFamily },
}) => {
  let background = 'transparent'
  let borderRadius = '0px'

  if (highlightedColor && !isSelected) {
    const hexColor = colors[theme][highlightedColor]
    background = convertHex(hexColor, 50)
    borderRadius = '4px'
  }
  if (isTouched) {
    // background = 'rgba(0,0,0,0.05)'
  }
  return {
    fontFamily,
    transition: 'background 0.3s ease',
    background,
    borderRadius,
    padding: '4px',
    WebkitBoxDecorationBreak: 'clone',
    borderBottom: isSelected ? `2px dashed ${colors[theme]['default']}` : 'none',
    WebkitTouchCallout: 'none',
    MozUserSelect: 'none',
    msUserSelect: 'none',
    KhtmlUserSelect: 'none',
    WebkitUserSelect: 'none',
    // ...(highlightedColor && !isSelected
    //   ? {
    //       filter: 'url(#goo)',
    //     }
    //   : {}),
    ...(isVerseToScroll
      ? {
          animation: `0.75s ease 0s 3 normal none running ${zoom}`,
          borderRadius: '4px',
        }
      : {}),
    ...(isFocused === false
      ? {
          opacity: 0.5,
        }
      : {}),
  }
})
