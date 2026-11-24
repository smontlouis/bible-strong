import { produce } from 'immer'
import { useRouter } from 'expo-router'
import { useStore } from 'jotai/react'
import { useOpenInNewTab } from '~features/app-switcher/utils/useOpenInNewTab'
import { useSlideNewTab } from '~features/app-switcher/utils/useSlideNewTab'
import { isInPlanPassage } from '~features/bible/planPassage'
import { selectBibleTabVersion } from '~helpers/bibleTabVersionSelection'
import i18n from '~i18n'
import { useSwitchGroup } from '~state/tabGroups'
import {
  getDefaultBibleTab,
  getGroupTabsAtomsAtom,
  tabGroupsAtom,
  type BibleTab,
} from '~state/tabs'
import {
  bibleAudioFollowingTabIdAtom,
  bibleAudioPlayerOpenAtom,
  bibleAudioSourceTabIdAtom,
  bibleAudioStateAtom,
} from './atoms'
import type { BibleAudioPassage } from './types'

const showPassage = (data: BibleTab['data'], passage: BibleAudioPassage): BibleTab['data'] => {
  // Choosing a version resets its Strong and interlinear modes: only when it changes.
  const next =
    data.selectedVersion === passage.version
      ? { ...data }
      : selectBibleTabVersion(data, passage.version)
  next.selectedBook = passage.book
  next.selectedChapter = passage.chapter
  next.selectedVerse = 1
  next.temp = { selectedBook: passage.book, selectedChapter: passage.chapter, selectedVerse: 1 }
  // A plan passage bounds the reader: the audio may have gone past it.
  if (!isInPlanPassage(next.planPassage, { book: passage.book.Numero, chapter: passage.chapter }))
    next.planPassage = undefined
  return next
}

/**
 * « Show the text »: the tab the listening started from turns to the passage the audio plays,
 * and follows it again. If that tab is gone, a new one opens.
 */
export const useShowBibleAudioText = () => {
  const store = useStore()
  const router = useRouter()
  const switchGroup = useSwitchGroup()
  const { triggerSlideNewTab } = useSlideNewTab()
  const openInNewTab = useOpenInNewTab()

  return () => {
    const { passage } = store.get(bibleAudioStateAtom)
    if (!passage) return
    store.set(bibleAudioPlayerOpenAtom, false)

    const tabId = store.get(bibleAudioSourceTabIdAtom)
    const group = store
      .get(tabGroupsAtom)
      .find(candidate => candidate.tabs.some(tab => tab.id === tabId && tab.type === 'bible'))

    if (group) {
      const tabAtom = store
        .get(getGroupTabsAtomsAtom(group.id))
        .find(candidate => store.get(candidate).id === tabId)
      if (tabAtom) {
        store.set(
          tabAtom,
          produce(store.get(tabAtom) as BibleTab, draft => {
            draft.data = showPassage(draft.data, passage)
          })
        )
      }
      store.set(bibleAudioFollowingTabIdAtom, tabId)
      switchGroup(group.id)
      router.dismissTo('/')
      triggerSlideNewTab(tabId)
      return
    }

    const tab = getDefaultBibleTab(passage.version)
    tab.data = showPassage(tab.data, passage)
    tab.title = `${i18n.t(passage.book.Nom)} ${passage.chapter}`
    store.set(bibleAudioSourceTabIdAtom, tab.id)
    store.set(bibleAudioFollowingTabIdAtom, tab.id)
    openInNewTab(tab, { autoRedirect: true })
  }
}
