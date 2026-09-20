import { Redirect, useLocalSearchParams, useRouter } from 'expo-router'

import { BibleRouteScreen, type BibleRouteInput } from '~features/bible/BibleScreen'
import { buildPublicBiblePath, parsePublicBibleRoute } from '~features/bible/publicBibleRoutes'
import ResourceUnavailableView from '~features/resources/ResourceUnavailableView'
import {
  createPublicBibleNavigation,
  createPublicBibleTab,
} from '~features/bible/publicBibleNavigation'
import PublicPage from '~features/app/PublicPage'
import { useTranslation } from 'react-i18next'
import { useOpenInNewTab } from '~features/app-switcher/utils/useOpenInNewTab'

const firstString = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value

const PublicBibleRoute = () => {
  const { t } = useTranslation()
  const openInNewTab = useOpenInNewTab()
  const router = useRouter()
  const params = useLocalSearchParams<{
    segments?: string | string[]
    gloss?: string | string[]
  }>()
  const glossLanguage = firstString(params.gloss)
  const route = parsePublicBibleRoute(params.segments, glossLanguage)

  if (!route) {
    return (
      <ResourceUnavailableView
        title="Référence biblique introuvable"
        failure={{ cause: 'not-found', recoveries: [] }}
      />
    )
  }

  const requestedSegments = Array.isArray(params.segments)
    ? params.segments
    : (params.segments?.split('/').filter(Boolean) ?? [])
  const requestedPath = `/bible/${requestedSegments.join('/')}${
    glossLanguage ? `?gloss=${glossLanguage}` : ''
  }`
  const canonicalPath = buildPublicBiblePath(route)
  if (requestedPath !== canonicalPath) return <Redirect href={canonicalPath} />
  const routeNavigation = createPublicBibleNavigation(route, {
    push: path => router.push(path),
    replace: path => router.replace(path),
  })

  const passage = route.passage
  const focusVerses = passage
    ? Array.from(
        { length: (passage.endVerse ?? passage.startVerse) - passage.startVerse + 1 },
        (_, index) => passage.startVerse + index
      )
    : undefined
  const strongMode: BibleRouteInput['strongMode'] =
    route.presentation === 'strong'
      ? 'visible'
      : route.presentation === 'reverse-interlinear'
        ? 'reverse-interlinear'
        : 'hidden'

  const passageLabel = passage
    ? `:${passage.startVerse}${passage.endVerse ? `–${passage.endVerse}` : ''}`
    : ''
  const title = `${t(route.book.Nom)} ${route.chapter}${passageLabel} · ${route.version}`
  const openApp = () => {
    openInNewTab(createPublicBibleTab(route, title), {
      autoRedirect: true,
      navigation: 'push',
    })
  }

  return (
    <PublicPage title={title} onOpenApp={openApp}>
      <BibleRouteScreen
        input={{
          version: route.version,
          book: route.book,
          chapter: route.chapter,
          verse: passage?.startVerse,
          focusVerses,
          contextDisplayMode: passage ? 'focused' : 'fullChapter',
          strongMode,
          interlinearLocale: route.glossLanguage,
        }}
        routeNavigation={routeNavigation}
      />
    </PublicPage>
  )
}

export default PublicBibleRoute
