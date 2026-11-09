import { Redirect, useLocalSearchParams, useRouter } from 'expo-router'
import { Platform } from 'react-native'

import { BibleRouteScreen } from '~features/bible/BibleScreen'
import { bibleRouteInputFromPublicRoute } from '~features/bible/bibleRouteTab'
import { buildPublicBiblePath, parsePublicBibleRoute } from '~features/bible/publicBibleRoutes'
import ResourceUnavailableView from '~features/resources/ResourceUnavailableView'
import { createPublicBibleNavigation } from '~features/bible/publicBibleNavigation'

const firstString = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value

const PublicBibleRoute = () => {
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
  // The address follows the reading only where it is visible. In a native sheet, a route
  // per chapter stacks a screen for each one, so the reader keeps its own state there.
  const routeNavigation =
    Platform.OS === 'web'
      ? createPublicBibleNavigation(route, {
          push: path => router.push(path),
          replace: path => router.replace(path),
        })
      : undefined

  return (
    <BibleRouteScreen
      input={bibleRouteInputFromPublicRoute(route)}
      routeNavigation={routeNavigation}
    />
  )
}

export default PublicBibleRoute
