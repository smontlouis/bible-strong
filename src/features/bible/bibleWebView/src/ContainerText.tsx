import { keyframes, styled } from 'goober'
import { convertHex } from './convertHex'
import { PropsWithDiv } from './types'

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

export const ContainerText = styled('span')(
  ({
    isFocused,
    isTouched,
    isSelected,
    highlightedColor,
    isVerseToScroll,
    settings: { theme, colors, fontFamily },
  }: PropsWithDiv<{
    isFocused: boolean
    isTouched: boolean
    isSelected: boolean
    highlightedColor: string
    isVerseToScroll: boolean
  }>) => {
    let background = 'transparent'

    if (highlightedColor && !isSelected) {
      const hexColor = colors[theme][highlightedColor]
      background = convertHex(hexColor, 50)
    }
    if (isTouched) {
      background = 'rgba(0,0,0,0.1)'
    }
    return {
      fontFamily,
      transition: 'background 0.3s ease',
      background,
      padding: '4px',
      borderBottom: isSelected ? '2px dashed rgb(52,73,94)' : 'none',
      WebkitTouchCallout: 'none',
      MozUserSelect: 'none',
      msUserSelect: 'none',
      KhtmlUserSelect: 'none',
      WebkitUserSelect: 'none',
      ...(isVerseToScroll
        ? {
            animation: `0.75s ease 0s 3 normal none running ${zoom}`,
          }
        : {}),
      ...(isFocused === false
        ? {
            opacity: 0.5,
          }
        : {}),
    }
  }
)
