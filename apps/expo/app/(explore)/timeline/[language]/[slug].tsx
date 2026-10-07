import { Redirect, useLocalSearchParams } from 'expo-router'

import EventScreen from '~features/timeline/EventScreen'
import ResourceUnavailableView from '~features/resources/ResourceUnavailableView'
import {
  buildPublicTimelineEventPath,
  parsePublicTimelineRoute,
} from '~features/timeline/publicTimelineRoutes'

const PublicTimelineEventRoute = () => {
  const params = useLocalSearchParams<{
    language?: string | string[]
    slug?: string | string[]
  }>()
  const route = parsePublicTimelineRoute(params)
  if (!route?.slug) {
    return (
      <ResourceUnavailableView
        title="Événement introuvable"
        failure={{ cause: 'not-found', recoveries: [] }}
      />
    )
  }
  const language = Array.isArray(params.language) ? params.language[0] : params.language
  const slug = Array.isArray(params.slug) ? params.slug[0] : params.slug
  const requestedPath = `/timeline/${language}/${slug}`
  const canonicalPath = buildPublicTimelineEventPath({ language: route.language, slug: route.slug })
  if (requestedPath !== canonicalPath) return <Redirect href={canonicalPath} />

  return <EventScreen />
}

export default PublicTimelineEventRoute
