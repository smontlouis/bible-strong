import styled from '@emotion/native'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { MenuView } from '~common/ui/MenuView'
import React, { useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator, ScrollView } from 'react-native'
import Empty from '~common/Empty'
import Header from '~common/Header'
import { LinkBox } from '~common/Link'
import Loading from '~common/Loading'
import Box from '~common/ui/Box'
import Button from '~common/ui/Button'
import Paragraph from '~common/ui/Paragraph'
import RoundedCorner from '~common/ui/RoundedCorner'
import Text from '~common/ui/Text'
import formatVerseContent from '~helpers/formatVerseContent'
import { useResolvedBibleVerses, verseStringToObject } from '~features/resources/useBibleVerses'
import BibleVerseDetailFooter from '../bible/BibleVerseDetailFooter'
import Comment from './Comment'
import { Comment as CommentType, Comments } from './types'

import { useTheme } from '@emotion/react'
import { produce } from 'immer'
import { useAtom } from 'jotai/react'
import { PrimitiveAtom } from 'jotai/vanilla'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import countLsgChapters from '~assets/bible_versions/countLsgChapters'
import AdventistIcon from '~common/AdventistIcon'
import { FeatherIcon } from '~common/ui/Icon'
import { HStack } from '~common/ui/Stack'
import { useOpenInNewTab } from '~features/app-switcher/utils/useOpenInNewTab'
import generateUUID from '~helpers/generateUUID'
import { firebaseDb } from '~helpers/firebase'
import { localQueryOptions, remoteQueryOptions } from '~helpers/queryOptions'
import { Theme } from '~themes'
import { CommentaryTab } from '../../state/tabs'
import { useBottomBarHeightInTab } from '~features/app-switcher/context/TabContext'
import { getChapterVerseCountFromCoverage } from '~helpers/bibleCoverage'
import { useResourceAccess } from '~features/resources/resourceAccess'
import { resourceQueryKeys } from '~helpers/resourceQueryKeys'
import { useDefaultBibleVersion } from '~state/useDefaultBibleVersion'
import { createBibleDownloadItem } from '~helpers/downloadItemFactory'
import { useDownloadItemStatus, useDownloadQueue } from '~helpers/useDownloadQueue'
import { createOfflineCopyId } from '~helpers/offlineCopyId'

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
  flexDirection: 'row',
})

const fetchComments = async (verse: string) => {
  const verseCommentRef = await firebaseDb.collection('verse-commentaries').doc(verse).get()

  if (!verseCommentRef.exists) {
    throw new Error('NOT_FOUND')
  }

  const verseComment = verseCommentRef.data()

  const snapshot = await firebaseDb
    .collection('verse-commentaries')
    .doc(verse)
    .collection('commentaries')
    .orderBy('order')
    .where('isSDA', '==', false)
    .limit(3)
    .get()

  const comments = snapshot.docs.map(x => x.data())

  return { ...verseComment, comments } as Comments
}

const fetchMoreComments = async (verse: string, order: number) => {
  const snapshot = await firebaseDb
    .collection('verse-commentaries')
    .doc(verse)
    .collection('commentaries')
    .orderBy('order')
    .startAfter(order)
    .limit(8)
    .get()

  const comments = snapshot.docs.map(x => x.data()) as CommentType[]

  return comments
}

const useComments = (verse: string) => {
  const query = useInfiniteQuery({
    queryKey: ['commentaries', verse],
    initialPageParam: null as number | null,
    queryFn: async ({ pageParam }) => {
      if (!pageParam) return fetchComments(verse)

      return {
        id: verse,
        count: 0,
        comments: await fetchMoreComments(verse, pageParam),
      } satisfies Comments
    },
    getNextPageParam: (lastPage, pages) => {
      const loadedCommentCount = pages.reduce((count, page) => count + page.comments.length, 0)
      return lastPage.comments.length > 0 && loadedCommentCount < pages[0].count
        ? lastPage.comments.at(-1)?.order
        : undefined
    },
    ...remoteQueryOptions,
  })
  const data = query.data
    ? {
        ...query.data.pages[0],
        comments: query.data.pages.flatMap(page => page.comments),
      }
    : undefined

  return {
    data,
    error: query.error,
    loadMore: query.fetchNextPage,
    canLoad: query.hasNextPage,
    isPending: query.isPending && query.fetchStatus === 'fetching',
    isError: query.isError || query.fetchStatus === 'paused',
    isFetchingMore: query.isFetchingNextPage,
  }
}

const useVerseInCurrentChapter = (
  book: string | number | undefined,
  chapter: string | number | undefined
) => {
  const defaultVersion = useDefaultBibleVersion()
  const resources = useResourceAccess()
  const { data: coverage } = useQuery({
    queryKey: resourceQueryKeys.bibleCoverage(defaultVersion),
    queryFn: () => resources.bibleContent.loadCoverage(defaultVersion),
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
}

const CommentariesTabScreen = ({ hasHeader = true, commentaryAtom }: CommentariesScreenProps) => {
  const { t } = useTranslation()
  const theme: Theme = useTheme()

  const [commentaryTab, setCommentaryTab] = useAtom(commentaryAtom)

  const openInNewTab = useOpenInNewTab()

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

  const { data, error, loadMore, canLoad, isPending, isError, isFetchingMore } = useComments(verse)
  const verseFormatted = useMemo(() => verseStringToObject([verse]), [verse])

  const { title: headerTitle } = verseFormatted
    ? formatVerseContent([verse])
    : { title: t('Chargement') }

  const defaultVersion = useDefaultBibleVersion()
  const verseResolution = useResolvedBibleVerses(verseFormatted)
  const [verseText] = verseResolution.verses
  const { versesInCurrentChapter } = useVerseInCurrentChapter(verseText?.Livre, verseText?.Chapitre)
  const { enqueue } = useDownloadQueue()
  const unavailableBibleVersion =
    verse &&
    !verseResolution.isLoading &&
    verseResolution.recoveries?.includes('acquire-offline-copy')
      ? defaultVersion
      : null
  const unavailableBibleDownloadStatus = useDownloadItemStatus(
    unavailableBibleVersion
      ? createOfflineCopyId({ kind: 'bible', versionId: unavailableBibleVersion })
      : undefined
  )

  const updateVerse = (value: -1 | 1) => {
    const [b, c, v] = verse.split('-').map(Number)
    setVerse(`${b}-${c}-${v + value}`)
  }

  const insets = useSafeAreaInsets()
  const { bottomBarHeight } = useBottomBarHeightInTab()
  useEffect(() => {
    setTitle(headerTitle)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [headerTitle])

  return (
    <>
      {hasHeader && (
        <>
          <Box background paddingTop={insets.top} />
          <Header
            background
            hasBackButton={hasBackButton}
            title={headerTitle}
            rightComponent={
              <MenuView
                actions={[
                  {
                    id: 'open-tab',
                    title: t('tab.openInNewTab'),
                    image: 'arrow.up.forward.square',
                  },
                ]}
                onPressAction={({ nativeEvent }) => {
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
        contentContainerStyle={{ paddingBottom: 20 + bottomBarHeight }}
        scrollIndicatorInsets={{ right: 1 }}
      >
        <>
          <Box background paddingTop={10}>
            <StyledVerse>
              <VersetWrapper>
                <NumberText>{verseText?.Verset}</NumberText>
              </VersetWrapper>
              <Box flex>
                {unavailableBibleVersion ? (
                  <Box>
                    <Text fontSize={13} color="grey" mb={10}>
                      {t('resource.bible.referenceUnavailable', {
                        version: unavailableBibleVersion,
                      })}
                    </Text>
                    <Button
                      small
                      onPress={() => enqueue([createBibleDownloadItem(unavailableBibleVersion)])}
                      isLoading={
                        unavailableBibleDownloadStatus?.status === 'queued' ||
                        unavailableBibleDownloadStatus?.status === 'downloading' ||
                        unavailableBibleDownloadStatus?.status === 'inserting'
                      }
                    >
                      {t('resource.bible.makeAvailableOffline', {
                        version: unavailableBibleVersion,
                      })}
                    </Button>
                  </Box>
                ) : (
                  <Paragraph>{verseText?.Texte.replace(/\n/gi, '')}</Paragraph>
                )}
              </Box>
            </StyledVerse>
            <BibleVerseDetailFooter
              verseNumber={verseText?.Verset}
              goToNextVerse={() => updateVerse(+1)}
              goToPrevVerse={() => updateVerse(-1)}
              versesInCurrentChapter={versesInCurrentChapter}
            />
          </Box>
          <Box bg="lightGrey">
            <RoundedCorner />
          </Box>
          {isPending ? (
            <Box height={100} center>
              <Loading />
            </Box>
          ) : isError ? (
            <Empty
              icon={require('~assets/images/empty-state-icons/comment.svg')}
              message={
                error?.message === 'NOT_FOUND'
                  ? t('Aucun commentaire disponible pour ce verset.')
                  : t("Une erreur est survenue. Assurez-vous d'être connecté à Internet.")
              }
            />
          ) : (
            <>
              {data?.comments.map((comment, i) => {
                return <Comment comment={comment} key={i} />
              })}
              {canLoad && (
                <LinkBox
                  m={20}
                  height={50}
                  rounded
                  lightShadow
                  bg="reverse"
                  center
                  opacity={isFetchingMore ? 0.3 : 1}
                  onPress={() => {
                    if (!isFetchingMore) {
                      loadMore()
                    }
                  }}
                >
                  {isFetchingMore ? (
                    <ActivityIndicator />
                  ) : (
                    <HStack row center>
                      <Text color="primary" fontSize={15}>
                        {t('Plus de résultats')}
                      </Text>
                      <AdventistIcon color="primary" />
                    </HStack>
                  )}
                </LinkBox>
              )}
            </>
          )}
        </>
      </ScrollView>
    </>
  )
}

export default CommentariesTabScreen
