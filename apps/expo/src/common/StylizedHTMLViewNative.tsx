import RenderHtml, { defaultSystemFonts } from '@native-html/render'
import { DomUtils } from 'htmlparser2'
import { useState } from 'react'
import { View } from 'react-native'
import type { HTMLViewLinkPayload } from './htmlContentTypes'
import {
  cleanReadingHTML,
  readingHtmlStyles,
  type ReadingColors,
  type ReadingTypography,
} from './readingHtml'

export default function StylizedHTMLViewNative({
  html,
  typography,
  colors,
  onLinkClicked,
}: {
  html: string
  typography: ReadingTypography
  colors: ReadingColors
  onLinkClicked: (payload: HTMLViewLinkPayload) => void
}) {
  const [width, setWidth] = useState(0)
  const content = cleanReadingHTML(html)
  return (
    <View
      style={{ alignSelf: 'stretch' }}
      onLayout={event => {
        const next = event.nativeEvent.layout.width
        if (next > 0) setWidth(next)
      }}
    >
      {width > 0 && (
        <RenderHtml
          contentWidth={width}
          source={{ html: content }}
          baseStyle={{ ...typography, color: colors.text }}
          tagsStyles={readingHtmlStyles(typography, colors)}
          enableUserAgentStyles={false}
          enableExperimentalMarginCollapsing
          defaultTextProps={{ selectable: true, allowFontScaling: false }}
          systemFonts={[...defaultSystemFonts, typography.fontFamily]}
          domVisitors={{
            onElement: element => {
              if (element.name === 'a')
                element.attribs['data-reading-text'] = DomUtils.textContent(element)
            },
          }}
          renderersProps={{
            a: {
              onPress: (_event, href, attributes) =>
                onLinkClicked({
                  href,
                  content: attributes['data-reading-text'] ?? '',
                  type: attributes.class ?? '',
                }),
            },
          }}
        />
      )}
    </View>
  )
}
