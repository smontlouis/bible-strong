import React from 'react'
import StylizedHTMLView from '~common/StylizedHTMLView'
import Box from '~common/ui/Box'
import type { HTMLViewLinkPayload } from '~helpers/useHTMLView'

type Props = {
  html: string
  onLinkClicked: (payload: HTMLViewLinkPayload) => void
}

const HTMLViewContent = ({ html, onLinkClicked }: Props) => (
  <Box px={20} pb={40}>
    <StylizedHTMLView
      value={html}
      onLinkPress={(href, content, type) =>
        onLinkClicked({
          href,
          content: typeof content === 'string' ? content : String(content ?? ''),
          type: type ?? '',
        })
      }
    />
  </Box>
)

export default HTMLViewContent
