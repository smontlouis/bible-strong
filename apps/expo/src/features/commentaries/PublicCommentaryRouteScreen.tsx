import { Redirect, useLocalSearchParams, useRouter } from 'expo-router'

import ResourceUnavailableView from '~features/resources/ResourceUnavailableView'
import CommentaryChapterScreen from './CommentaryChapterScreen'
import CommentaryEntryScreen from './CommentaryEntryScreen'
import { createCommentaryProjectionId } from './commentarySelection'
import { buildPublicCommentaryPath, parsePublicCommentaryRoute } from './publicCommentaryRoutes'
import PublicPage from '~features/app/PublicPage'

export const PublicCommentaryRouteScreen = ({ entry }: { entry: boolean }) => {
  const router = useRouter()
  const params = useLocalSearchParams<{
    language?: string | string[]
    resource?: string | string[]
    book?: string | string[]
    chapter?: string | string[]
    section?: string | string[]
    verse?: string | string[]
  }>()
  const route = parsePublicCommentaryRoute(params)
  if (!route || (entry && !route.sectionId)) {
    return (
      <ResourceUnavailableView
        title="Commentaire introuvable"
        failure={{ cause: 'not-found', recoveries: [] }}
      />
    )
  }
  const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value)
  const requestedPath = `/commentary/${first(params.language)}/${first(params.resource)}/${first(
    params.book
  )}/${first(params.chapter)}${params.section ? `/${encodeURIComponent(first(params.section) ?? '')}` : ''}${
    params.verse ? `?verse=${encodeURIComponent(first(params.verse) ?? '')}` : ''
  }`
  const canonicalPath = buildPublicCommentaryPath(route)
  if (requestedPath !== canonicalPath) return <Redirect href={canonicalPath} />
  const routeParams = {
    projectionId: createCommentaryProjectionId(route.resourceId, route.language),
    book: String(route.book),
    chapter: String(route.chapter),
    ...(route.sectionId ? { sectionId: route.sectionId } : {}),
    ...(route.focusVerse ? { focusVerse: String(route.focusVerse) } : {}),
  }
  return (
    <PublicPage title={`${route.resourceId} · ${route.book}:${route.chapter}`}>
      {entry ? (
        <CommentaryEntryScreen
          routeParams={routeParams}
          onOpenChapter={() =>
            router.push(buildPublicCommentaryPath({ ...route, sectionId: undefined }))
          }
          onSectionChange={sectionId =>
            router.replace(buildPublicCommentaryPath({ ...route, sectionId }))
          }
        />
      ) : (
        <CommentaryChapterScreen
          routeParams={routeParams}
          onChapterChange={(book, chapter) =>
            router.push(
              buildPublicCommentaryPath({ ...route, book, chapter, focusVerse: undefined })
            )
          }
          onClearFocus={() =>
            router.replace(buildPublicCommentaryPath({ ...route, focusVerse: undefined }))
          }
          onOpenSection={sectionId =>
            router.push(buildPublicCommentaryPath({ ...route, sectionId }))
          }
        />
      )}
    </PublicPage>
  )
}
