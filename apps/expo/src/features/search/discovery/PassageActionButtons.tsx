import { HStack } from '~common/ui/Box'
import PassageActionButton from './PassageActionButton'
import type { SearchEntityResult } from '../shared/searchResultTypes'
import { useDefaultBibleVersion } from '~state/useDefaultBibleVersion'
import { useOpenInNewTab } from '~features/app-switcher/utils/useOpenInNewTab'
import { createScopedPassageTab } from '~features/app-switcher/commandPalette/scopes'

export default function PassageActionButtons({ item }: { item: SearchEntityResult }) {
  const version = useDefaultBibleVersion()
  const openTab = useOpenInNewTab()
  const passage = item.passage
  const referenceSegment =
    item.referenceSegment ??
    (passage
      ? {
          book: passage.book,
          chapter: passage.chapter,
          startVerse: passage.verse,
          endVerse:
            passage.endChapter === passage.chapter
              ? (passage.endVerse ?? passage.verse)
              : passage.verse,
          isWholeChapter: false,
        }
      : undefined)
  if (!referenceSegment) return null
  return (
    <HStack className="items-center shrink-0 gap-[4px]">
      {([false, true] as const).map(compare => (
        <PassageActionButton
          key={String(compare)}
          compare={compare}
          onPress={() => {
            const tab = createScopedPassageTab(
              compare ? 'compare' : 'bible',
              { ...item, referenceSegment },
              version
            )
            if (tab) openTab(tab, { autoRedirect: true })
          }}
        />
      ))}
    </HStack>
  )
}
