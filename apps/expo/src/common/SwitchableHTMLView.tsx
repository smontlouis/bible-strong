import type { PreviewSource } from '~features/bibleReferencePreview/resourceTarget'
import { useReferencePreview } from '~features/bibleReferencePreview/state'
import { useEffect, useState } from 'react'
import { Platform, View } from 'react-native'
import Animated from 'react-native-reanimated'
import { useTheme } from '~themes/ThemeProvider'
import HTMLContentDOM from './HTMLContentDOM'
import StylizedHTMLViewNative from './StylizedHTMLViewNative'
import { useReadingTypography } from './useReadingTypography'
import { estimateReadingHtmlHeight, type HtmlEngine, type ReadingTypography } from './readingHtml'
import type { HTMLViewLinkPayload } from './htmlContentTypes'

// Used for the height estimate until the reader reports its own width.
const DEFAULT_READER_WIDTH = 360
// Reveal the DOM reader even if it never reports a size, so text is never left hidden.
const DOM_REVEAL_FALLBACK_MS = 2000

/**
 * Web always uses DOM. On mobile, native is the default; `selectable` switches iOS to the DOM
 * engine, whose WebKit selection spans paragraphs (Android's native Text already allows
 * partial selection). `engine` remains a code-only override.
 */
export default function SwitchableHTMLView({
  value,
  previewSource,
  compact = false,
  typography: typographyOverride,
  engine,
  padded = false,
  selectable = false,
  onLinkPress,
  onLinkClicked,
}: {
  value?: string
  previewSource?: PreviewSource
  compact?: boolean
  typography?: ReadingTypography
  engine?: HtmlEngine
  padded?: boolean
  selectable?: boolean
  onLinkPress?: (href: string) => void
  onLinkClicked?: (payload: HTMLViewLinkPayload) => void
}) {
  const preview = useReferencePreview()
  const readingTypography = useReadingTypography()
  const typography =
    typographyOverride ??
    (compact ? { ...readingTypography, fontSize: 16, lineHeight: 24 } : readingTypography)
  const theme = useTheme()
  const [width, setWidth] = useState(DEFAULT_READER_WIDTH)
  const [measuredHeight, setMeasuredHeight] = useState<number>()
  const [revealed, setRevealed] = useState(false)
  const resolvedEngine = engine ?? (selectable && Platform.OS === 'ios' ? 'dom' : 'native')
  const usesNativeDOMReader = Platform.OS !== 'web' && resolvedEngine === 'dom'
  const height = measuredHeight ?? estimateReadingHtmlHeight(value ?? '', typography, width)
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
  useEffect(() => {
    if (!usesNativeDOMReader || revealed) return
    const timeoutId = setTimeout(() => setRevealed(true), DOM_REVEAL_FALLBACK_MS)
    return () => clearTimeout(timeoutId)
  }, [usesNativeDOMReader, revealed])

  if (!value) return null
  const padding = padded ? { paddingTop: 8, paddingHorizontal: 28, paddingBottom: 48 } : undefined
  return (
    <View style={padding}>
      {Platform.OS !== 'web' && resolvedEngine === 'native' ? (
        <StylizedHTMLViewNative
          html={value}
          typography={typography}
          colors={colors}
          onLinkClicked={onLink}
        />
      ) : (
        <Animated.View
          onLayout={event => setWidth(event.nativeEvent.layout.width)}
          // The webview paints empty, then at a provisional height: stay hidden until the
          // first measured height is applied, then fade in at the final size.
          style={
            usesNativeDOMReader && {
              opacity: revealed ? 1 : 0,
              transitionProperty: 'opacity',
              transitionDuration: 250,
            }
          }
        >
          <HTMLContentDOM
            html={value}
            typography={typography}
            colors={colors}
            padded={false}
            onLinkClicked={async payload => {
              onLink(payload)
            }}
            onSizeChange={async next => {
              if (!Number.isFinite(next) || next <= 0) return
              setMeasuredHeight(Math.ceil(next))
              setRevealed(true)
            }}
            dom={{
              useExpoDOMWebView: false,
              containerStyle: { height, flex: 0, width: '100%' },
              scrollEnabled: false,
              style: { width: '100%', backgroundColor: 'transparent' },
              contentInsetAdjustmentBehavior: 'never',
            }}
          />
        </Animated.View>
      )}
    </View>
  )
}
