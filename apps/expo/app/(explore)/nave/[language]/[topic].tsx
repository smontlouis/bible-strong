import { Redirect, useLocalSearchParams } from 'expo-router'

import { NaveRouteScreen } from '~features/nave/NaveDetailScreen'
import { buildPublicNavePath, parsePublicNaveRoute } from '~features/nave/publicNaveRoutes'
import ResourceUnavailableView from '~features/resources/ResourceUnavailableView'
import PublicPage from '~features/app/PublicPage'

const PublicNaveRoute = () => {
  const params = useLocalSearchParams<{
    language?: string | string[]
    topic?: string | string[]
  }>()
  const route = parsePublicNaveRoute(params.language, params.topic)
  if (route) {
    const language = Array.isArray(params.language) ? params.language[0] : params.language
    const topic = Array.isArray(params.topic) ? params.topic[0] : params.topic
    const requestedPath = `/nave/${language}/${encodeURIComponent(topic ?? '')}`
    const canonicalPath = buildPublicNavePath(route)
    if (requestedPath !== canonicalPath) return <Redirect href={canonicalPath} />
  }
  return route ? (
    <PublicPage title={route.topic}>
      <NaveRouteScreen nameLower={route.topic} language={route.language} />
    </PublicPage>
  ) : (
    <ResourceUnavailableView
      title="Thème Nave introuvable"
      failure={{ cause: 'not-found', recoveries: [] }}
    />
  )
}

export default PublicNaveRoute
