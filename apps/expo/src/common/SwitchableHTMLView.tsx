import { useAtomValue } from 'jotai/react'
import { useState } from 'react'
import { Platform, View } from 'react-native'
import { useTheme } from '~themes/ThemeProvider'
import { readingHtmlEngineAtom } from '~state/readingHtmlEngine'
import HTMLContentDOM from './HTMLContentDOM'
import StylizedHTMLViewNative from './StylizedHTMLViewNative'
import { useReadingTypography } from './useReadingTypography'
import type { HtmlEngine } from './readingHtml'
import type { HTMLViewLinkPayload } from './htmlContentTypes'

/** Web always uses DOM. On mobile, engine overrides the persisted preference. */
export default function SwitchableHTMLView({
  value,
  engine,
  padded = false,
  onLinkPress,
  onLinkClicked,
}: {
  value?: string
  engine?: HtmlEngine
  padded?: boolean
  onLinkPress?: (href: string) => void
  onLinkClicked?: (payload: HTMLViewLinkPayload) => void
}) {
  const preferredEngine = useAtomValue(readingHtmlEngineAtom)
  const typography = useReadingTypography()
  const theme = useTheme()
  const [height, setHeight] = useState(200)
  const colors = {
    background: theme.colors.reverse,
    text: theme.colors.default,
    link: theme.colors.primary,
    emphasis: theme.colors.quart,
  }
  const onLink = (payload: HTMLViewLinkPayload) => {
    onLinkClicked?.(payload)
    onLinkPress?.(payload.href)
  }
  if (!value) return null
  const padding = padded ? { paddingTop: 8, paddingHorizontal: 28, paddingBottom: 48 } : undefined
  return (
    <View style={padding}>
      {Platform.OS !== 'web' && (engine ?? preferredEngine) === 'native' ? (
        <StylizedHTMLViewNative
          html={value}
          typography={typography}
          colors={colors}
          onLinkClicked={onLink}
        />
      ) : (
        <HTMLContentDOM
          html={value}
          typography={typography}
          colors={colors}
          padded={false}
          onLinkClicked={async payload => {
            onLink(payload)
          }}
          onSizeChange={async next => {
            if (Number.isFinite(next) && next > 0) setHeight(Math.ceil(next))
          }}
          dom={{
            useExpoDOMWebView: false,
            containerStyle: { height, flex: 0, width: '100%' },
            scrollEnabled: false,
            style: { width: '100%', backgroundColor: 'transparent' },
            contentInsetAdjustmentBehavior: 'never',
          }}
        />
      )}
    </View>
  )
}
