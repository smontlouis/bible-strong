import RenderHtml, { defaultSystemFonts, type MixedStyleDeclaration } from '@native-html/render'
import { withTheme } from '@emotion/react'
import { DomUtils } from 'htmlparser2'
import { useEffect, useRef, useState } from 'react'
import { Platform, useWindowDimensions } from 'react-native'

import Box from '~common/ui/Box'
import { Theme } from '~themes'
import {
  getLegacyLinkPressArguments,
  hasWidthSensitiveHtmlContent,
  LINK_TEXT_ATTRIBUTE,
  linkifyStrongReferences,
} from './stylizedHtmlUtils'

export { linkifyStrongReferences } from './stylizedHtmlUtils'

export const textStyle = {
  lineHeight: 29,
  fontSize: 19,
}

const monospaceFontFamily = Platform.OS === 'ios' ? 'Menlo' : 'monospace'

export const styles = (theme: Theme): Record<string, MixedStyleDeclaration> => ({
  h1: {
    fontWeight: 'bold',
    fontSize: 24,
    lineHeight: 25,
    color: theme.colors.default,
  },
  h2: {
    fontWeight: 'bold',
    fontSize: 24,
    lineHeight: 25,
    color: theme.colors.default,
  },
  h3: {
    fontWeight: 'bold',
    fontSize: 24,
    lineHeight: 25,
    color: theme.colors.default,
  },
  p: {
    color: theme.colors.default,
    ...textStyle,
    fontFamily: theme.fontFamily.paragraph,
  },
  em: {
    ...textStyle,
    fontFamily: theme.fontFamily.paragraph,
    color: theme.colors.quart,
    fontStyle: 'italic',
    fontWeight: 'bold',
  },
  i: {
    ...textStyle,
    fontFamily: theme.fontFamily.paragraph,
    color: theme.colors.quart,
    fontStyle: 'italic',
    fontWeight: 'bold',
  },
  a: {
    color: theme.colors.default,
    borderStyle: 'solid',
    borderWidth: 2,
    borderColor: theme.colors.primary,
    textDecorationLine: 'underline',
    textDecorationStyle: 'solid',
    textDecorationColor: theme.colors.primary,
    fontFamily: theme.fontFamily.paragraph,
    ...textStyle,
  },
  strong: {
    fontWeight: 'bold',
    color: theme.colors.quart,
    fontFamily: theme.fontFamily.paragraph,
    ...textStyle,
  },
  b: {
    fontWeight: 'bold',
    color: theme.colors.quart,
    fontFamily: theme.fontFamily.paragraph,
    ...textStyle,
  },
  pre: {
    fontFamily: monospaceFontFamily,
  },
  code: {
    fontFamily: monospaceFontFamily,
  },
  li: {
    color: theme.colors.default,
    fontFamily: theme.fontFamily.paragraph,
    ...textStyle,
  },
  ol: {
    color: theme.colors.default,
    fontFamily: theme.fontFamily.paragraph,
    ...textStyle,
  },
  ul: {
    color: theme.colors.default,
    fontFamily: theme.fontFamily.paragraph,
    ...textStyle,
  },
})

type LinkPressHandler = {
  bivarianceHack(href: string, second?: string | number, third?: string): void
}['bivarianceHack']

type StylizedHTMLViewProps = {
  value?: string
  onLinkPress?: LinkPressHandler
  htmlStyle?: Record<string, MixedStyleDeclaration>
  theme: Theme
}

const StylizedHTMLView = ({ value, htmlStyle, onLinkPress, theme }: StylizedHTMLViewProps) => {
  const { width } = useWindowDimensions()
  const [measuredContentWidth, setMeasuredContentWidth] = useState<number | null>(null)
  const lastLayoutWidth = useRef<number | null>(null)
  const tagStyles = { ...styles(theme), ...htmlStyle }

  const html = value && onLinkPress ? linkifyStrongReferences(value) : (value ?? '')
  const needsMeasuredContentWidth = hasWidthSensitiveHtmlContent(html)
  const contentWidth = measuredContentWidth ?? (needsMeasuredContentWidth ? null : width)

  useEffect(() => {
    if (needsMeasuredContentWidth && measuredContentWidth === null && lastLayoutWidth.current) {
      setMeasuredContentWidth(lastLayoutWidth.current)
    }
  }, [measuredContentWidth, needsMeasuredContentWidth])

  if (!value) return null

  return (
    <Box
      alignSelf="stretch"
      onLayout={({ nativeEvent }) => {
        const measuredWidth = nativeEvent.layout.width
        lastLayoutWidth.current = measuredWidth
        if (
          (needsMeasuredContentWidth || measuredContentWidth !== null) &&
          measuredWidth > 0 &&
          measuredWidth !== measuredContentWidth
        ) {
          setMeasuredContentWidth(measuredWidth)
        }
      }}
    >
      {contentWidth !== null && (
        <RenderHtml
          contentWidth={contentWidth}
          source={{ html }}
          tagsStyles={tagStyles}
          baseStyle={tagStyles.p}
          defaultTextProps={{ selectable: true }}
          enableUserAgentStyles={false}
          systemFonts={[
            ...defaultSystemFonts,
            monospaceFontFamily,
            ...Object.values(theme.fontFamily),
          ]}
          domVisitors={{
            onElement: element => {
              if (element.name === 'a') {
                element.attribs[LINK_TEXT_ATTRIBUTE] = DomUtils.textContent(element)
              }
            },
          }}
          renderersProps={
            onLinkPress
              ? {
                  a: {
                    onPress: (_event, href, attributes) => {
                      onLinkPress(...getLegacyLinkPressArguments(href, attributes))
                    },
                  },
                }
              : undefined
          }
        />
      )}
    </Box>
  )
}

export default withTheme(StylizedHTMLView)
