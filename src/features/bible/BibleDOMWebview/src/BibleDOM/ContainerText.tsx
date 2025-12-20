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

// Resolve a color ID to its hex value
const resolveHighlightColor = (
  colorId: string,
  themeColors: Record<string, string>,
  customHighlightColors: Array<{ id: string; hex: string }> = []
): string => {
  // Default colors (color1-color5)
  if (colorId.startsWith('color')) {
    return themeColors[colorId] || 'transparent'
  }
  // Custom colors
  const customColor = customHighlightColors.find(c => c.id === colorId)
  return customColor?.hex || 'transparent'
}

export const ContainerText = styled('span')<
  RootStyles & {
    isFocused?: boolean
    isTouched?: boolean
    isSelected?: boolean
    highlightedColor?: string
    isVerseToScroll?: boolean
  }
>(({
  isFocused,
  isTouched,
  isSelected,
  highlightedColor,
  isVerseToScroll,
  settings: { theme, colors, fontFamily, customHighlightColors },
}) => {
  let background = 'transparent'
  let borderRadius = '0px'

  if (highlightedColor && !isSelected) {
    const hexColor = resolveHighlightColor(highlightedColor, colors[theme], customHighlightColors)
    background = hexColor !== 'transparent' ? convertHex(hexColor, 50) : 'transparent'
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
