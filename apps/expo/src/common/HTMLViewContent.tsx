import type { PreviewSource } from '~features/bibleReferencePreview/resourceTarget'
import type { HTMLViewLinkPayload } from './htmlContentTypes'
import SwitchableHTMLView from './SwitchableHTMLView'

/** Compatibility adapter for editorial callers using the original link payload. */
export default function HTMLViewContent({
  html,
  previewSource,
  selectable,
  onLinkClicked,
}: {
  html: string
  previewSource?: PreviewSource
  selectable?: boolean
  onLinkClicked: (payload: HTMLViewLinkPayload) => void
}) {
  return (
    <SwitchableHTMLView
      previewSource={previewSource}
      value={html}
      padded
      selectable={selectable}
      onLinkClicked={onLinkClicked}
    />
  )
}
