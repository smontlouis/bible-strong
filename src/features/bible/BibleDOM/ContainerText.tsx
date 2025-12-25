import { keyframes, styled } from 'goober'
import { convertHex } from './convertHex'
import { RootStyles } from './BibleDOMWrapper'
import { HIGHLIGHT_BACKGROUND_OPACITY, getContrastTextColor } from '../../../helpers/highlightUtils'

type HighlightType = 'background' | 'textColor' | 'underline'

interface HighlightInfo {
  hex: string
  type: HighlightType
}

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

// Resolve a color ID to its hex value and type
const resolveHighlightInfo = (
  colorId: string,
  themeColors: Record<string, string>,
  customHighlightColors: Array<{ id: string; hex: string; type?: HighlightType }> = [],
  defaultColorTypes: Record<string, HighlightType> = {}
): HighlightInfo => {
  // Default colors (color1-color5)
  if (colorId.startsWith('color')) {
    return {
      hex: themeColors[colorId] || 'transparent',
      type: defaultColorTypes[colorId] || 'background',
    }
  }
  // Custom colors
  const customColor = customHighlightColors.find(c => c.id === colorId)
  return {
    hex: customColor?.hex || 'transparent',
    type: customColor?.type || 'background',
  }
}

// Generate styles based on highlight type
const getHighlightStyles = (hex: string, type: HighlightType, theme: string) => {
  switch (type) {
    case 'background': {
      const isDarkTheme = theme === 'dark' || theme === 'black' || theme === 'night'
      const textColor = getContrastTextColor(hex, isDarkTheme)

      return {
        background: convertHex(hex, HIGHLIGHT_BACKGROUND_OPACITY),
        borderRadius: '4px',
        color: textColor,
      }
    }
    case 'textColor':
      return {
        background: 'transparent',
        borderRadius: '0px',
        color: hex,
      }
    case 'underline':
      // Partial background at bottom - like a real highlighter marker
      return {
        background: `linear-gradient(to top, ${convertHex(hex, 60)} 20%, transparent 20%)`,
        borderRadius: '0px',
        color: undefined,
      }
    default:
      return {
        background: 'transparent',
        borderRadius: '0px',
        color: undefined,
      }
  }
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
  settings: { theme, colors, fontFamily, customHighlightColors, defaultColorTypes },
}) => {
  let highlightStyles = {
    background: 'transparent',
    borderRadius: '0px',
    color: undefined as string | undefined,
  }

  if (highlightedColor) {
    const { hex, type } = resolveHighlightInfo(
      highlightedColor,
      colors[theme],
      customHighlightColors,
      defaultColorTypes || {}
    )
    if (hex !== 'transparent') {
      highlightStyles = getHighlightStyles(hex, type, theme)
    }
  }
  if (isTouched) {
    // background = 'rgba(0,0,0,0.05)'
  }
  return {
    fontFamily,
    transition: 'background 0.3s ease, color 0.3s ease',
    background: highlightStyles.background,
    borderRadius: highlightStyles.borderRadius,
    color: highlightStyles.color,
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
