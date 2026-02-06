import { styled } from 'goober'

import { scaleFontSize } from './scaleFontSize'
import { RootStyles } from './BibleDOMWrapper'

export const Wrapper = styled('div')<RootStyles>(
  ({ settings: { textDisplay } }) => ({
    display: textDisplay,
  })
)

export const VerseText = styled('div')<RootStyles>(
  ({ settings: { fontSizeScale, theme, colors, fontFamily } }) => ({
    fontSize: scaleFontSize(16, fontSizeScale),
    lineHeight: scaleFontSize(25, fontSizeScale),
    fontFamily,
    direction: 'ltr',
    textAlign: 'left',
    padding: '10px',
    margin: '10px 0',
    background: colors[theme].lightGrey,
    borderRadius: '4px',
    position: 'relative',
    paddingRight: '30px',
  })
)

export const CloseVerseText = styled('div')(() => ({
  width: '30px',
  height: '30px',
  top: '5px',
  right: '5px',
  position: 'absolute',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '17px',
  webkitTouchCallout: 'none',
  mozUserSelect: 'none',
  msUserSelect: 'none',
  khtmlUserSelect: 'none',
  webkitUserSelect: 'none',
}))
