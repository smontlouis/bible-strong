import type { HTMLViewLinkPayload } from './htmlContentTypes'
import SwitchableHTMLView from './SwitchableHTMLView'

/** Compatibility adapter for editorial callers using the original link payload. */
export default function HTMLViewContent({
  html,
  onLinkClicked,
}: {
  html: string
  onLinkClicked: (payload: HTMLViewLinkPayload) => void
}) {
  return <SwitchableHTMLView value={html} padded onLinkClicked={onLinkClicked} />
}
