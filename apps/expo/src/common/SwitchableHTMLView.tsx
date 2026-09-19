import type { PreviewSource } from '~features/bibleReferencePreview/resourceTarget'
import { useReferencePreview } from '~features/bibleReferencePreview/state'
import { useState } from 'react'
import { Platform, View } from 'react-native'
import { useTheme } from '~themes/ThemeProvider'
import HTMLContentDOM from './HTMLContentDOM'
import StylizedHTMLViewNative from './StylizedHTMLViewNative'
import { useReadingTypography } from './useReadingTypography'
import type { HtmlEngine, ReadingTypography } from './readingHtml'
import type { HTMLViewLinkPayload } from './htmlContentTypes'

/** Web always uses DOM. On mobile, engine is a code-only override; native is the default. */
export default function SwitchableHTMLView({
  value,
  previewSource,
  compact = false,
  typography: typographyOverride,
  engine,
  padded = false,
  onLinkPress,
  onLinkClicked,
}: {
  value?: string
  previewSource?: PreviewSource
  compact?: boolean
  typography?: ReadingTypography
  engine?: HtmlEngine
  padded?: boolean
  onLinkPress?: (href: string) => void
  onLinkClicked?: (payload: HTMLViewLinkPayload) => void
}) {
  const preview = useReferencePreview()
  const readingTypography = useReadingTypography()
  const typography =
    typographyOverride ??
    (compact ? { ...readingTypography, fontSize: 16, lineHeight: 24 } : readingTypography)
  const theme = useTheme()
  const [height, setHeight] = useState(200)
  const colors = {
    background: theme.colors.reverse,
    text: theme.colors.default,
    link: theme.colors.primary,
    emphasis: theme.colors.quart,
  }
  const onLink = (payload: HTMLViewLinkPayload) => {
    const open = () => {
      onLinkClicked?.(payload)
      onLinkPress?.(payload.href)
    }
    if (!preview(payload, open, undefined, previewSource)) open()
  }
  if (!value) return null
  const padding = padded ? { paddingTop: 8, paddingHorizontal: 28, paddingBottom: 48 } : undefined
  return (
    <View style={padding}>
      {Platform.OS !== 'web' && (engine ?? 'native') === 'native' ? (
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
