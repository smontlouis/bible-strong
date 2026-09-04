import { useQuery } from '@tanstack/react-query'
import { MenuView } from '~common/ui/MenuView'
import React, { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { ScrollView } from 'react-native'
import Empty from '~common/Empty'
import Header from '~common/Header'
import Loading from '~common/Loading'
import Box from '~common/ui/Box'
import formatVerseContent from '~helpers/formatVerseContent'
import { verseStringToObject } from '~features/resources/useBibleVerses'

import { useTheme } from '@emotion/react'
import { produce } from 'immer'
import { useAtom } from 'jotai/react'
import { PrimitiveAtom } from 'jotai/vanilla'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { FeatherIcon } from '~common/ui/Icon'
import { useOpenInNewTab } from '~features/app-switcher/utils/useOpenInNewTab'
import generateUUID from '~helpers/generateUUID'
import { Theme } from '~themes'
import { CommentaryTab } from '../../state/tabs'
import { useBottomBarHeightInTab } from '~features/app-switcher/context/TabContext'
import { useResourceAccess } from '~features/resources/resourceAccess'
import ResourceUnavailableView from '~features/resources/ResourceUnavailableView'
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
import ResourceVerseContext, {
  useResourceVerseContext,
} from '~features/bible/resources/ResourceVerseContext'

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

  const verseContext = useResourceVerseContext(verse, preferredVersion)
  const requestedContent = {
    verse,
    headerTitle: requestedHeaderTitle,
    ...verseContext,
    commentaryAvailability,
    selectedResourceIds,
    error,
    isPending,
    isError,
    retryCommentaries: retry,
  }
  const displayedContent = useRetainedCommentaryContent(
    requestedContent,
    Boolean(verseContext.verseText) && !isPending
  )
  const [navigationDirection, setNavigationDirection] = React.useState<-1 | 1>(1)

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
          <ResourceVerseContext
            verse={displayedContent.verse}
            verseText={displayedContent.verseText}
            versesInCurrentChapter={displayedContent.versesInCurrentChapter}
            requestedVersion={displayedContent.requestedVersion}
            unavailableBibleVersion={displayedContent.unavailableBibleVersion}
            bibleTemporarilyUnavailable={displayedContent.bibleTemporarilyUnavailable}
            retryBible={displayedContent.retryBible}
            navigationDirection={navigationDirection}
            updateVerse={updateVerse}
          />
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
