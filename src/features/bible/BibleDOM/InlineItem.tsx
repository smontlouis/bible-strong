import { styled } from 'goober'
import { RootStyles } from './BibleDOMWrapper'
import { scaleFontSize } from './scaleFontSize'
import { isDarkTheme, noSelect } from './utils'
import { getDisabledStyles } from './disabledStyles'

export const InlineItemContainer = styled('span')<
  RootStyles & { isParallel?: boolean; isButton?: boolean; isDisabled?: boolean }
>(
  ({
    isParallel,
    isButton = false,
    isDisabled = false,
    settings: { fontSizeScale, theme, colors, fontFamily },
  }) => ({
    fontFamily,
    ...noSelect,
    color: colors[theme].default,
    fontSize: scaleFontSize(isParallel ? 10 : 16, fontSizeScale),
    lineHeight: scaleFontSize(isParallel ? 18 : 26, fontSizeScale),

    backgroundColor: colors[theme].reverse,
    boxShadow: isDarkTheme(theme)
      ? `0 0 10px 0 rgba(255, 255, 255, 0.1)`
      : `0 0 10px 0 rgba(0, 0, 0, 0.2)`,
    borderRadius: '8px',
    paddingInlineEnd: '8px',
    paddingInlineStart: '4px',
    paddingBlock: '4px',
    wordBreak: 'break-word',
    marginInline: '4px',
    transition: 'opacity 0.2s ease-in-out',

    ...(isButton && {
      cursor: 'pointer',
      '&:active': {
        opacity: 0.6,
      },
    }),
    ...getDisabledStyles(isDisabled),
  })
)

export const InlineItemIconWrapper = styled('span')<RootStyles & { isButton?: boolean }>(
  ({ isButton, settings: { theme, colors, fontFamily } }) => ({
    fontFamily,
    borderInlineEnd: `1px solid rgba(0, 0, 0, 0.2)`,
    paddingBlock: '0px',
    paddingInline: '4px',
    marginInlineEnd: '6px',
    ...(isButton && {
      cursor: 'pointer',
      '&:active': {
        opacity: 0.6,
      },
    }),
  })
)

export const InlineItemText = styled('span')<RootStyles>(({ settings: { fontFamily } }) => ({
  fontFamily,
  pointerEvents: 'none',
  ...noSelect,
}))
