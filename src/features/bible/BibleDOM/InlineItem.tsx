import { styled } from 'goober'
import { RootStyles } from './BibleDOMWrapper'
import { scaleFontSize } from './scaleFontSize'
import { isDarkTheme } from './utils'

export const InlineItemContainer = styled('span')<
  RootStyles & { isParallel?: boolean; isButton?: boolean }
>(({ isParallel, isButton = false, settings: { fontSizeScale, theme, colors, fontFamily } }) => ({
  fontFamily,
  webkitTouchCallout: 'none',
  mozUserSelect: 'none',
  msUserSelect: 'none',
  khtmlUserSelect: 'none',
  webkitUserSelect: 'none',
  color: colors[theme].default,
  fontSize: scaleFontSize(isParallel ? 10 : 16, fontSizeScale),
  lineHeight: scaleFontSize(isParallel ? 18 : 26, fontSizeScale),

  backgroundColor: colors[theme].reverse,
  boxShadow: isDarkTheme(theme)
    ? `0 0 10px 0 rgba(255, 255, 255, 0.1)`
    : `0 0 10px 0 rgba(0, 0, 0, 0.2)`,
  borderRadius: '8px',
  padding: '4px 8px 4px 4px',
  wordBreak: 'break-word',
  marginRight: '4px',
  marginLeft: '4px',

  ...(isButton && {
    cursor: 'pointer',
    '&:active': {
      opacity: 0.6,
    },
  }),
}))

export const InlineItemIconWrapper = styled('span')<RootStyles & { isButton?: boolean }>(
  ({ isButton, settings: { theme, colors, fontFamily } }) => ({
    fontFamily,
    borderRight: `1px solid rgba(0, 0, 0, 0.2)`,
    padding: '0 4px',
    marginRight: '6px',
    ...(isButton && {
      cursor: 'pointer',
      '&:active': {
        opacity: 0.6,
      },
    }),
  })
)

export const InlineItemText = styled('span')<RootStyles>(
  ({ settings: { theme, colors, fontFamily } }) => ({
    fontFamily,
  })
)
