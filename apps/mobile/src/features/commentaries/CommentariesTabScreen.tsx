import styled from '@emotion/native'
import { useQuery } from '@tanstack/react-query'
import { MenuView } from '~common/ui/MenuView'
import React, { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { ScrollView } from 'react-native'
import Animated, {
  LinearTransition,
  useReducedMotion,
  withTiming,
  type EntryAnimationsValues,
  type ExitAnimationsValues,
} from 'react-native-reanimated'
import Empty from '~common/Empty'
import Header from '~common/Header'
import Loading from '~common/Loading'
import Box from '~common/ui/Box'
import Paragraph from '~common/ui/Paragraph'
import formatVerseContent from '~helpers/formatVerseContent'
import { useResolvedBibleVerses, verseStringToObject } from '~features/resources/useBibleVerses'
import BibleVerseDetailFooter from '../bible/BibleVerseDetailFooter'

import { useTheme } from '@emotion/react'
import { produce } from 'immer'
import { useAtom } from 'jotai/react'
import { PrimitiveAtom } from 'jotai/vanilla'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import countLsgChapters from '~assets/bible_versions/countLsgChapters'
import { FeatherIcon } from '~common/ui/Icon'
import { useOpenInNewTab } from '~features/app-switcher/utils/useOpenInNewTab'
import generateUUID from '~helpers/generateUUID'
import { localQueryOptions } from '~helpers/queryOptions'
import { Theme } from '~themes'
import { CommentaryTab } from '../../state/tabs'
import { useBottomBarHeightInTab } from '~features/app-switcher/context/TabContext'
import { getChapterVerseCountFromCoverage } from '~helpers/bibleCoverage'
import { useResourceAccess } from '~features/resources/resourceAccess'
import { resourceQueryKeys } from '~helpers/resourceQueryKeys'
import { useDefaultBibleVersion } from '~state/useDefaultBibleVersion'
import ResourceUnavailableView from '~features/resources/ResourceUnavailableView'
import { createOfflineCopyDownloadItem } from '~helpers/downloadItemFactory'
import { resourceFailureFromAccessError } from '~features/resources/resourceFailure'
import CommentarySelectorSheet from './CommentarySelectorSheet'
import { parseCommentaryProjectionId } from './commentarySelection'
import type { SheetRef } from '~common/sheet'
import CommentaryAvailabilityList from './CommentaryAvailabilityList'
import { buildCommentaryVerseAvailability } from './commentaryVerseAvailability'
import { useSelector } from 'react-redux'
import type { RootState } from '~redux/modules/reducer'
import useRetainedCommentaryContent from './useRetainedCommentaryContent'
import { useSheetFooterInset } from '~common/sheet'
import { getCommentaryScrollBottomInset } from './commentaryScrollInsets'
import { getCommentaryResourceRoute } from './commentaryResourceNavigation'
import { usePushRouteOnce } from '~navigation/usePushRouteOnce'

const VersetWrapper = styled.View(() => ({
  width: 25,
  marginRight: 5,
  borderRightWidth: 3,
  borderRightColor: 'transparent',
  alignItems: 'flex-end',
}))

const NumberText = styled(Paragraph)({
  marginTop: 0,
  fontSize: 9,
  justifyContent: 'flex-end',
  marginRight: 3,
})

const StyledVerse = styled.View({
  paddingLeft: 0,
  paddingRight: 10,
  paddingBottom: 10,
  flexDirection: 'row',
})

const CONTENT_TRANSITION_DURATION = 180
const CONTENT_LAYOUT_TRANSITION = LinearTransition.duration(220)

const enterNextVerse = (_values: EntryAnimationsValues) => {
  'worklet'
  return {
    initialValues: { opacity: 0, transform: [{ translateX: 10 }] },
    animations: {
      opacity: withTiming(1, { duration: CONTENT_TRANSITION_DURATION }),
      transform: [{ translateX: withTiming(0, { duration: CONTENT_TRANSITION_DURATION }) }],
    },
  }
}

const exitNextVerse = (_values: ExitAnimationsValues) => {
  'worklet'
  return {
    initialValues: { opacity: 1, transform: [{ translateX: 0 }] },
    animations: {
      opacity: withTiming(0, { duration: CONTENT_TRANSITION_DURATION - 40 }),
      transform: [{ translateX: withTiming(-8, { duration: CONTENT_TRANSITION_DURATION - 40 }) }],
    },
  }
}

const enterPreviousVerse = (_values: EntryAnimationsValues) => {
  'worklet'
  return {
    initialValues: { opacity: 0, transform: [{ translateX: -10 }] },
    animations: {
      opacity: withTiming(1, { duration: CONTENT_TRANSITION_DURATION }),
      transform: [{ translateX: withTiming(0, { duration: CONTENT_TRANSITION_DURATION }) }],
    },
  }
}

const exitPreviousVerse = (_values: ExitAnimationsValues) => {
  'worklet'
  return {
    initialValues: { opacity: 1, transform: [{ translateX: 0 }] },
    animations: {
      opacity: withTiming(0, { duration: CONTENT_TRANSITION_DURATION - 40 }),
      transform: [{ translateX: withTiming(8, { duration: CONTENT_TRANSITION_DURATION - 40 }) }],
    },
  }
}

const useComments = (verse: string) => {
  const resources = useResourceAccess()
  const selectedProjectionIds = useSelector(
    (state: RootState) => state.user.bible.settings.commentarySelection
  )
  const selectedResources = selectedProjectionIds.flatMap(projectionId => {
    const projection = parseCommentaryProjectionId(projectionId)
    return projection ? [{ resourceId: projection.resourceId, language: projection.language }] : []
  })
  const [book, chapter, verseNumber] = verse.split('-').map(Number)
  const validVerse = [book, chapter, verseNumber].every(Number.isSafeInteger)
  const query = useQuery({
    queryKey: ['commentaries', book, chapter, selectedProjectionIds.join(',')],
    queryFn: () =>
      resources.commentary.loadChapter({
        book,
        chapter,
        resources: selectedResources,
      }),
    enabled: validVerse && selectedResources.length > 0,
    networkMode: 'always',
    retry: false,
  })

  return {
    commentsByVerse: query.data?.commentsByVerse ?? {},
    unavailableResources: query.data?.unavailableResources ?? [],
    selectedResourceIds: selectedProjectionIds,
    error: query.error,
    isPending: query.isPending && query.fetchStatus === 'fetching',
    isError: query.isError,
    retry: query.refetch,
  }
}

const useVerseInCurrentChapter = (
  book: string | number | undefined,
  chapter: string | number | undefined,
  preferredVersion?: string
) => {
  const defaultVersion = useDefaultBibleVersion()
  const version = preferredVersion || defaultVersion
  const resources = useResourceAccess()
  const { data: coverage } = useQuery({
    queryKey: resourceQueryKeys.bibleCoverage(version),
    queryFn: () => resources.bibleContent.loadCoverage(version),
    enabled: !!book && !!chapter,
    ...localQueryOptions,
  })
  const versesInCurrentChapter =
    getChapterVerseCountFromCoverage(coverage, Number(book), Number(chapter)) ||
    countLsgChapters[`${book}-${chapter}`]
  return { versesInCurrentChapter }
}

interface CommentariesScreenProps {
  hasHeader?: boolean
  commentaryAtom: PrimitiveAtom<CommentaryTab>
  preferredVersion?: string
  commentarySelectorRef?: React.RefObject<SheetRef | null>
}

const CommentariesTabScreen = ({
  hasHeader = true,
  commentaryAtom,
  preferredVersion,
  commentarySelectorRef: externalCommentarySelectorRef,
}: CommentariesScreenProps) => {
  const { t } = useTranslation()
  const theme: Theme = useTheme()

  const [commentaryTab, setCommentaryTab] = useAtom(commentaryAtom)

  const openInNewTab = useOpenInNewTab()
  const pushRouteOnce = usePushRouteOnce()
  const localCommentarySelectorRef = React.useRef<SheetRef>(null)
  const commentarySelectorRef = externalCommentarySelectorRef ?? localCommentarySelectorRef

  const {
    hasBackButton,
    data: { verse },
  } = commentaryTab

  const setVerse = (v: string) =>
    setCommentaryTab(
      produce(draft => {
        draft.data.verse = v
      })
    )

  const setTitle = (title: string) =>
    setCommentaryTab(
      produce(draft => {
        draft.title = title
      })
    )

  const {
    commentsByVerse,
    unavailableResources,
    selectedResourceIds,
    error,
    isPending,
    isError,
    retry,
  } = useComments(verse)
  const currentVerseNumber = Number(verse.split('-')[2])
  const commentaryAvailability = buildCommentaryVerseAvailability({
    selectedProjectionIds: selectedResourceIds,
    commentsByVerse,
    verseNumber: currentVerseNumber,
    unavailableResources,
  })
  const verseFormatted = verseStringToObject([verse])

  const { title: requestedHeaderTitle } = verseFormatted
    ? formatVerseContent([verse])
    : { title: t('Chargement') }

  const defaultVersion = useDefaultBibleVersion()
  const requestedVersion = preferredVersion || defaultVersion
  const verseResolution = useResolvedBibleVerses(verseFormatted, preferredVersion)
  const [verseText] = verseResolution.verses
  const { versesInCurrentChapter } = useVerseInCurrentChapter(
    verseText?.Livre,
    verseText?.Chapitre,
    preferredVersion
  )
  const unavailableBibleVersion =
    verse &&
    !verseResolution.isLoading &&
    verseResolution.recoveries?.includes('acquire-offline-copy')
      ? requestedVersion
      : null
  const bibleTemporarilyUnavailable = verseResolution.recoveries?.includes('retry')
  const requestedContent = {
    verse,
    headerTitle: requestedHeaderTitle,
    verseText,
    versesInCurrentChapter,
    requestedVersion,
    unavailableBibleVersion,
    bibleTemporarilyUnavailable,
    retryBible: verseResolution.retry,
    commentaryAvailability,
    selectedResourceIds,
    error,
    isPending,
    isError,
    retryCommentaries: retry,
  }
  const displayedContent = useRetainedCommentaryContent(
    requestedContent,
    !verseResolution.isLoading && !isPending
  )
  const [navigationDirection, setNavigationDirection] = React.useState<-1 | 1>(1)
  const reduceMotion = useReducedMotion()

  const updateVerse = (value: -1 | 1) => {
    const [b, c, v] = verse.split('-').map(Number)
    setNavigationDirection(value)
    setVerse(`${b}-${c}-${v + value}`)
  }

  const insets = useSafeAreaInsets()
  const { bottomBarHeight } = useBottomBarHeightInTab()
  const sheetFooterInset = useSheetFooterInset()
  const scrollBottomInset = getCommentaryScrollBottomInset({
    bottomBarHeight,
    sheetFooterInset,
  })
  useEffect(() => {
    setTitle(displayedContent.headerTitle)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayedContent.headerTitle])
  return (
    <>
      {hasHeader && (
        <>
          <Box background paddingTop={insets.top} />
          <Header
            background
            hasBackButton={hasBackButton}
            title={displayedContent.headerTitle}
            rightComponent={
              <MenuView
                actions={[
                  {
                    id: 'choose-commentaries',
                    title: t('commentaries.selector.title'),
                    image: 'checkmark.square',
                  },
                  {
                    id: 'open-tab',
                    title: t('tab.openInNewTab'),
                    image: 'arrow.up.forward.square',
                  },
                ]}
                onPressAction={({ nativeEvent }) => {
                  if (nativeEvent.event === 'choose-commentaries') {
                    commentarySelectorRef.current?.present()
                  }
                  if (nativeEvent.event === 'open-tab') {
                    openInNewTab({
                      id: `commentary-${generateUUID()}`,
                      title: t('tabs.new'),
                      isRemovable: true,
                      type: 'commentary',
                      data: {
                        verse,
                      },
                    })
                  }
                }}
              >
                <Box row center height={60} width={60}>
                  <FeatherIcon name="more-vertical" size={18} />
                </Box>
              </MenuView>
            }
          />
        </>
      )}

      <ScrollView
        style={{ backgroundColor: theme.colors.lightGrey }}
        contentContainerStyle={{ paddingBottom: scrollBottomInset }}
        scrollIndicatorInsets={{ right: 1 }}
      >
        <>
          <Box background paddingTop={10} borderBottomLeftRadius={30} borderBottomRightRadius={30}>
            <Animated.View layout={reduceMotion ? undefined : CONTENT_LAYOUT_TRANSITION}>
              <Animated.View
                key={displayedContent.verse}
                entering={
                  reduceMotion
                    ? undefined
                    : navigationDirection === 1
                      ? enterNextVerse
                      : enterPreviousVerse
                }
                exiting={
                  reduceMotion
                    ? undefined
                    : navigationDirection === 1
                      ? exitNextVerse
                      : exitPreviousVerse
                }
              >
                <StyledVerse>
                  <VersetWrapper>
                    <NumberText>{displayedContent.verseText?.Verset}</NumberText>
                  </VersetWrapper>
                  <Box flex>
                    {displayedContent.unavailableBibleVersion ? (
                      <ResourceUnavailableView
                        identity={{
                          kind: 'bible',
                          versionId: displayedContent.unavailableBibleVersion,
                        }}
                        title={t('resource.bible.referenceUnavailable', {
                          version: displayedContent.unavailableBibleVersion,
                        })}
                        fileSize={Math.max(
                          1,
                          Math.round(
                            createOfflineCopyDownloadItem({
                              kind: 'bible',
                              versionId: displayedContent.unavailableBibleVersion,
                            }).estimatedSize / 1_000_000
                          )
                        )}
                        failure={{
                          cause: 'offline-copy-required',
                          recoveries: ['acquire-offline-copy'],
                        }}
                        size="small"
                      />
                    ) : displayedContent.bibleTemporarilyUnavailable ? (
                      <ResourceUnavailableView
                        title={t('resource.bible.referenceUnavailable', {
                          version: displayedContent.requestedVersion,
                        })}
                        failure={{ cause: 'temporary-unavailable', recoveries: ['retry'] }}
                        size="small"
                        onRetry={displayedContent.retryBible}
                      />
                    ) : (
                      <Paragraph>{displayedContent.verseText?.Texte.replace(/\n/gi, '')}</Paragraph>
                    )}
                  </Box>
                </StyledVerse>
              </Animated.View>
            </Animated.View>
            <BibleVerseDetailFooter
              verseNumber={displayedContent.verseText?.Verset}
              goToNextVerse={() => updateVerse(+1)}
              goToPrevVerse={() => updateVerse(-1)}
              versesInCurrentChapter={displayedContent.versesInCurrentChapter}
            />
          </Box>
          {displayedContent.isPending ? (
            <Box height={100} center>
              <Loading />
            </Box>
          ) : displayedContent.isError ? (
            <ResourceUnavailableView
              title={t('resource.commentaries.temporarilyUnavailable')}
              failure={resourceFailureFromAccessError(displayedContent.error)}
              onRetry={() => void displayedContent.retryCommentaries()}
            />
          ) : displayedContent.selectedResourceIds.length === 0 ? (
            <Empty
              icon={require('~assets/images/empty-state-icons/comment.svg')}
              message={t('commentaries.selector.noneSelected')}
            />
          ) : (
            <>
              <CommentaryAvailabilityList
                items={displayedContent.commentaryAvailability}
                headerTitle={displayedContent.headerTitle}
                onManage={() => commentarySelectorRef.current?.present()}
                onOpen={item => {
                  const [book, chapter, verseNumber] = displayedContent.verse.split('-').map(Number)
                  const route = getCommentaryResourceRoute(item, {
                    book,
                    chapter,
                    verse: verseNumber,
                  })
                  if (route) pushRouteOnce(route)
                }}
              />
            </>
          )}
        </>
      </ScrollView>
      {!externalCommentarySelectorRef ? (
        <CommentarySelectorSheet sheetRef={localCommentarySelectorRef} />
      ) : null}
    </>
  )
}

export default CommentariesTabScreen
