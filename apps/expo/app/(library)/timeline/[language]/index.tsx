import { Redirect, useLocalSearchParams, useRouter } from 'expo-router'

import TimelineStageScreen from '~features/timeline/TimelineStageScreen'
import ResourceUnavailableView from '~features/resources/ResourceUnavailableView'
import {
  buildPublicTimelineIndexPath,
  parsePublicTimelineRoute,
} from '~features/timeline/publicTimelineRoutes'

const PublicTimelineIndexRoute = () => {
  const router = useRouter()
  const params = useLocalSearchParams<{ language?: string | string[] }>()
  const route = parsePublicTimelineRoute(params)
  if (!route) {
    return (
      <ResourceUnavailableView
        title="Chronologie introuvable"
        failure={{ cause: 'not-found', recoveries: [] }}
      />
    )
  }
  const requestedLanguage = Array.isArray(params.language) ? params.language[0] : params.language
  const canonicalPath = buildPublicTimelineIndexPath(route.language)
  if (requestedLanguage !== route.language) return <Redirect href={canonicalPath} />

  return (
    <TimelineStageScreen
      languageOverride={route.language}
      onLanguageChange={language => router.replace(buildPublicTimelineIndexPath(language))}
    />
  )
}

export default PublicTimelineIndexRoute
