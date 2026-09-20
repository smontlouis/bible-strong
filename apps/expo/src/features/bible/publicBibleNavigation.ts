import type { StrongMode } from '~helpers/strongBiblePublications'
import type { BibleRouteNavigationAdapter } from '~state/bibleRouteNavigation'
import { getDefaultBibleTab, type BibleTab, type VersionCode } from '~state/tabs'
import {
  buildPublicBiblePath,
  isPublicBiblePresentationSupported,
  type PublicBiblePresentation,
  type PublicBibleRoute,
} from './publicBibleRoutes'

type PublicBibleRouter = {
  push: (path: string) => void
  replace: (path: string) => void
}

const presentationForStrongMode = (mode: StrongMode): PublicBiblePresentation =>
  mode === 'visible' ? 'strong' : mode === 'reverse-interlinear' ? 'reverse-interlinear' : 'text'

const strongModeForPresentation = (presentation: PublicBiblePresentation): StrongMode =>
  presentation === 'strong'
    ? 'visible'
    : presentation === 'reverse-interlinear'
      ? 'reverse-interlinear'
      : 'hidden'

export const createPublicBibleTab = (route: PublicBibleRoute, title: string): BibleTab => {
  const tab = getDefaultBibleTab(route.version as VersionCode)
  const selectedVerse = route.passage?.startVerse ?? 1
  const focusVerses = route.passage
    ? Array.from(
        { length: (route.passage.endVerse ?? selectedVerse) - selectedVerse + 1 },
        (_, index) => selectedVerse + index
      )
    : undefined
  tab.title = title
  tab.data.selectedBook = route.book
  tab.data.selectedChapter = route.chapter
  tab.data.selectedVerse = selectedVerse
  tab.data.temp = {
    selectedBook: route.book,
    selectedChapter: route.chapter,
    selectedVerse,
  }
  tab.data.focusVerses = focusVerses
  tab.data.contextDisplayMode = route.passage ? 'focused' : 'fullChapter'
  tab.data.strongMode = strongModeForPresentation(route.presentation)
  tab.data.interlinearLocale = route.glossLanguage
  return tab
}

export const createPublicBibleNavigation = (
  current: PublicBibleRoute,
  router: PublicBibleRouter
): BibleRouteNavigationAdapter => ({
  openChapter: (book, chapter) => {
    router.push(buildPublicBiblePath({ ...current, book, chapter, passage: undefined }))
  },
  replaceWithChapter: (book, chapter) => {
    router.replace(buildPublicBiblePath({ ...current, book, chapter, passage: undefined }))
  },
  changeVersion: version => {
    const presentation = isPublicBiblePresentationSupported(version, current.presentation)
      ? current.presentation
      : 'text'
    router.replace(buildPublicBiblePath({ ...current, version, presentation }))
  },
  changeStrongMode: mode => {
    const presentation = presentationForStrongMode(mode)
    router.replace(buildPublicBiblePath({ ...current, presentation }))
  },
})
