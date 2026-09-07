import React from 'react'
import { type HTMLViewLinkPayload } from './htmlContentTypes'
import { useTheme } from '~themes/ThemeProvider'
import HTMLContentDOM from './HTMLContentDOM'

type Props = {
  html: string
  onLinkClicked: (payload: HTMLViewLinkPayload) => void
}

const HTMLViewContent = ({ html, onLinkClicked }: Props) => {
  const theme = useTheme()
  return (
    <HTMLContentDOM
      html={html}
      colors={{
        background: theme.colors.reverse,
        text: theme.colors.default,
        link: theme.colors.primary,
        emphasis: theme.colors.quart,
      }}
      onLinkClicked={async payload => {
        onLinkClicked(payload)
      }}
      dom={{
        matchContents: true,
        scrollEnabled: false,
        style: { width: '100%', backgroundColor: 'transparent' },
        contentInsetAdjustmentBehavior: 'never',
      }}
    />
  )
}

export default HTMLViewContent
