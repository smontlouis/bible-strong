import ContextualPanel from '~common/ContextualPanel'
import { useBibleBookmarkScreens } from './useBibleBookmarkScreens'
import type { BibleBookmarkTriggerProps } from './BibleBookmarkTrigger'

export default function BibleBookmarkTrigger({
  children,
  book,
  chapter,
  version,
  accessibilityLabel,
}: BibleBookmarkTriggerProps) {
  const panel = useBibleBookmarkScreens(book, chapter, version)
  return (
    <ContextualPanel
      trigger={children}
      accessibilityLabel={accessibilityLabel}
      initialScreen="bookmark"
      screens={panel.screens}
      onOpen={panel.prepare}
      width={430}
    />
  )
}
