import { useAssistantResourceContext } from '~features/study-assistant/useAssistantResourceContext'
import { commentaryContext } from '~features/study-assistant/resourceContext'
import { useQuery } from '@tanstack/react-query'
import { staticResourceQueryOptions } from '~helpers/queryOptions'
import { useLocalSearchParams, useRouter } from 'expo-router'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { Linking } from 'react-native'
import countLsgChapters from '~assets/bible_versions/countLsgChapters'
import Header from '~common/Header'
import Loading from '~common/Loading'
import StylizedHTMLView from '~common/SwitchableHTMLView'
import { getCommentaryShare } from './shareCommentary'
import ScrollView from '~common/ui/ScrollView'
import Box, { usePageBottomInset } from '~common/ui/Box'
import Card from '~common/ui/Card'
import FormSheetScreen from '~common/ui/FormSheetScreen'
import ResourceUnavailableView from '~features/resources/ResourceUnavailableView'
import { useResourceAccess } from '~features/resources/resourceAccess'
import { resourceFailureFromAccessError } from '~features/resources/resourceFailure'
import { getCommentaryBookLabel } from './commentaryBookLabel'
import { IS_FORM_SHEET } from '~helpers/constants'
import { useCanGoBackInStack } from '~navigation/useCanGoBackInStack'
import CommentaryResourceHeaderActions from './CommentaryResourceHeaderActions'
import CommentaryRoomIntro from './CommentaryRoomIntro'
import {
  getCommentaryBibleViewRoute,
  getCommentaryPassageBibleViewRoute,
} from './commentaryReferenceNavigation'
import {
  commentaryHrefToOsis,
  parseCommentaryResourceParams,
  type CommentaryScreenRouteParams,
} from './commentaryResourceParams'
import CommentaryEntryNavigation from './CommentaryEntryNavigation'
import { groupCommentarySectionsForVerse } from './commentaryResourceNavigation'
import { usePushRouteOnce } from '~navigation/usePushRouteOnce'
import { useRecordHistory } from '~features/history/useRecordHistory'
import { getCommentaryResourceHistoryEntry } from './commentaryResourceHistory'
const CommentaryEntryScreen = ({
  routeParams,
  onOpenChapter,
  onSectionChange,
}: {
  routeParams?: CommentaryScreenRouteParams
  onOpenChapter?: () => void
  onSectionChange?: (sectionId: string) => void
} = {}) => {
  const localParams = useLocalSearchParams<CommentaryScreenRouteParams>()
  const params = routeParams ?? localParams
  const parsed = parseCommentaryResourceParams(params)
  const parsedFocusVerse = Number(params.focusVerse)
  const focusVerse =
    Number.isSafeInteger(parsedFocusVerse) && parsedFocusVerse > 0 ? parsedFocusVerse : undefined
  const resources = useResourceAccess()
  const router = useRouter()
  const pushRouteOnce = usePushRouteOnce()
  const { t } = useTranslation()
  const canGoBackInStack = useCanGoBackInStack()
  const bottomInset = usePageBottomInset()
  const scrollRef = React.useRef<React.ComponentRef<typeof ScrollView>>(null)
  const query = useQuery({
    queryKey: [
      'commentary-resource-chapter',
      parsed?.projection.projectionId,
      parsed?.book,
      parsed?.chapter,
    ],
    queryFn: () =>
      resources.commentary.loadResourceChapter({
        resourceId: parsed!.projection.resourceId,
        language: parsed!.projection.language,
        book: parsed!.book,
        chapter: parsed!.chapter,
      }),
    enabled: Boolean(parsed && params.sectionId),
    networkMode: 'always',
    retry: false,
    ...staticResourceQueryOptions,
  })

  useAssistantResourceContext(
    'panel',
    commentaryContext(
      params,
      query.data?.sections.find(item => item.id === params.sectionId)
    )
  )
  useRecordHistory(
    params.sectionId
      ? getCommentaryResourceHistoryEntry(
          parsed,
          params.sectionId,
          query.data?.sections.find(item => item.id === params.sectionId)
        )
      : null
  )

  if (!parsed || !params.sectionId) {
    return (
      <FormSheetScreen className="bg-canvas" isFormSheet={IS_FORM_SHEET}>
        <ResourceUnavailableView
          title={t('commentaries.resource.invalid')}
          failure={{ cause: 'not-found', recoveries: [] }}
        />
      </FormSheetScreen>
    )
  }

  const { entry, projection, book, chapter } = parsed
  const orderedSections = focusVerse
    ? (() => {
        const grouped = groupCommentarySectionsForVerse({
          sections: query.data?.sections ?? [],
          verse: focusVerse,
          chapterVerseCount: countLsgChapters[`${book}-${chapter}`],
        })
        return [...grouped.directSections, ...grouped.chapterContextSections]
      })()
    : (query.data?.sections ?? [])
  const section = query.data?.sections.find(candidate => candidate.id === params.sectionId)
  const sectionIndex = orderedSections.findIndex(candidate => candidate.id === params.sectionId)
  const previousSection = sectionIndex > 0 ? orderedSections[sectionIndex - 1] : undefined
  const nextSection = sectionIndex >= 0 ? orderedSections[sectionIndex + 1] : undefined
  const bookLabel = getCommentaryBookLabel(book)
  const passage = section
    ? `${bookLabel} ${chapter}:${section.rangeStartVerse}${
        section.rangeEndVerse !== section.rangeStartVerse ? `–${section.rangeEndVerse}` : ''
      }`
    : `${bookLabel} ${chapter}`

  return (
    <FormSheetScreen className="bg-canvas" isFormSheet={IS_FORM_SHEET}>
      <Box className="overflow-hidden border-continuous flex-[1] bg-canvas">
        <Header
          hasBackButton={IS_FORM_SHEET ? canGoBackInStack : true}
          title={entry.author}
          subTitle={passage}
          rightComponent={
            <Box className="overflow-hidden border-continuous mr-[4px]">
              <CommentaryResourceHeaderActions
                entry={entry}
                projectionId={projection.projectionId}
                language={projection.language}
                book={book}
                chapter={chapter}
                sectionId={params.sectionId}
                showAvatar={false}
                share={
                  section
                    ? getCommentaryShare({
                        entry,
                        passage,
                        sections: [section],
                        location: { language: projection.language, book, chapter },
                      })
                    : undefined
                }
              />
            </Box>
          }
        />
        {query.isPending ? (
          <Box className="overflow-hidden border-continuous flex-[1] items-center justify-center">
            <Loading />
          </Box>
        ) : query.isError ? (
          <ResourceUnavailableView
            title={t('commentaries.resource.unavailable')}
            failure={resourceFailureFromAccessError(query.error)}
            onRetry={() => void query.refetch()}
          />
        ) : !section ? (
          <ResourceUnavailableView
            title={t('commentaries.resource.sectionMissing')}
            failure={{ cause: 'not-found', recoveries: [] }}
          />
        ) : (
          <ScrollView
            ref={scrollRef}
            backgroundColor="canvas"
            contentContainerStyle={{ maxWidth: 600, padding: 18, paddingBottom: 44 + bottomInset }}
          >
            <CommentaryRoomIntro
              compact
              entry={entry}
              language={projection.language}
              onPress={() =>
                onOpenChapter
                  ? onOpenChapter()
                  : pushRouteOnce({
                      pathname: '/commentary-chapter',
                      params: {
                        projectionId: projection.projectionId,
                        book: String(book),
                        chapter: String(chapter),
                        focusVerse: focusVerse === undefined ? undefined : String(focusVerse),
                      },
                    })
              }
            />
            <Card className="px-[18px] py-[18px]">
              <CommentaryEntryNavigation
                hasPrevious={Boolean(previousSection)}
                hasNext={Boolean(nextSection)}
                reference={
                  section.rangeStartVerse === 0 && section.rangeEndVerse === 0
                    ? t('commentaries.resource.introduction')
                    : passage
                }
                referenceDisabled={section.rangeStartVerse === 0}
                onReferencePress={() => {
                  const route = getCommentaryPassageBibleViewRoute({
                    book,
                    chapter,
                    startVerse: section.rangeStartVerse,
                    endVerse: section.rangeEndVerse,
                  })
                  if (route) pushRouteOnce(route)
                }}
                onPrevious={() => {
                  if (!previousSection) return
                  if (onSectionChange) onSectionChange(previousSection.id)
                  else router.setParams({ sectionId: previousSection.id })
                  scrollRef.current?.scrollTo({ y: 0, animated: true })
                }}
                onNext={() => {
                  if (!nextSection) return
                  if (onSectionChange) onSectionChange(nextSection.id)
                  else router.setParams({ sectionId: nextSection.id })
                  scrollRef.current?.scrollTo({ y: 0, animated: true })
                }}
              />
              <Box className="overflow-hidden border-continuous mt-[14px]">
                <StylizedHTMLView
                  selectable
                  value={section.content}
                  onLinkPress={href => {
                    const osis = commentaryHrefToOsis(href)
                    const route = osis ? getCommentaryBibleViewRoute(osis) : undefined
                    if (route) pushRouteOnce(route)
                    else if (/^https?:\/\//iu.test(href)) void Linking.openURL(href)
                  }}
                />
              </Box>
            </Card>
          </ScrollView>
        )}
      </Box>
    </FormSheetScreen>
  )
}

export default CommentaryEntryScreen
