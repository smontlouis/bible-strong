import React, { useState } from 'react'
import { type HTMLViewLinkPayload } from './htmlContentTypes'
import { useTheme } from '~themes/ThemeProvider'
import HTMLContentDOM from './HTMLContentDOM'
import { useReadingTypography } from './useReadingTypography'

type Props = {
  html: string
  onLinkClicked: (payload: HTMLViewLinkPayload) => void
}

const HTMLViewContent = ({ html, onLinkClicked }: Props) => {
  const theme = useTheme()
  const typography = useReadingTypography()
  const [contentHeight, setContentHeight] = useState(200)
  return (
    <HTMLContentDOM
      html={html}
      typography={typography}
      colors={{
        background: theme.colors.reverse,
        text: theme.colors.default,
        link: theme.colors.primary,
        emphasis: theme.colors.quart,
      }}
      onLinkClicked={async payload => {
        onLinkClicked(payload)
      }}
      onSizeChange={async height => {
        if (Number.isFinite(height) && height > 0) setContentHeight(Math.ceil(height))
      }}
      dom={{
        // Keep the same native WebView implementation as the Bible reader.
        useExpoDOMWebView: false,
        containerStyle: { height: contentHeight, flex: 0, width: '100%' },
        scrollEnabled: false,
        style: { width: '100%', backgroundColor: 'transparent' },
        contentInsetAdjustmentBehavior: 'never',
      }}
    />
  )
}

export default HTMLViewContent
