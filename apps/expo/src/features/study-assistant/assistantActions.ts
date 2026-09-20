import type { AssistantAction } from '@bible-strong/ai-contract/contract'
import { createPassageTab } from '~features/app-switcher/tabOpenRequest'
import type { TabItem } from '~state/tabs'

export function createTabForAssistantAction(action: AssistantAction): TabItem | undefined {
  if (action.kind !== 'open_tab') return undefined
  return createPassageTab({
    tabType: action.tabType,
    book: action.target.book,
    chapter: action.target.chapter,
    startVerse: action.target.startVerse,
    endVerse: action.target.endVerse,
    version: action.target.version,
    isWholeChapter: action.target.isWholeChapter,
  })
}
