import type { ResourceLanguage } from '~helpers/databaseTypes'
import type { InterlinearMode } from '~helpers/interlinearDisplayMode'
import type { StrongMode } from '~helpers/strongBiblePublications'
import type { BibleRouteNavigationAdapter } from '~state/bibleRouteNavigation'
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
  // Only the interlinear display has a route; transliteration and Strong stay in the tab.
  changeInterlinearMode: (mode: InterlinearMode, locale?: ResourceLanguage) => {
    if (!isPublicBiblePresentationSupported(current.version, 'interlinear')) return false
    if (mode === 'interlinear') {
      router.replace(
        buildPublicBiblePath({
          ...current,
          presentation: 'interlinear',
          glossLanguage: locale ?? current.glossLanguage,
        })
      )
      return true
    }
    if (mode === 'hidden' && current.presentation === 'interlinear') {
      router.replace(
        buildPublicBiblePath({ ...current, presentation: 'text', glossLanguage: undefined })
      )
      return true
    }
    return false
  },
})
